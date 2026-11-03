import express from 'express';
import mongoose from 'mongoose';
import { Comment } from '../models/Comment.js';
import { CommentHistory } from '../models/CommentHistory.js';
import { ModerationLog } from '../models/ModerationLog.js';
import { Report } from '../models/Report.js';
import { User } from '../models/User.js';
import { authRequired, optionalAuth } from '../middleware/auth.js';
import { commentLimiter, reportLimiter } from '../middleware/rateLimiters.js';
import { serializeComment, serializeReport } from '../utils/commentSerializer.js';
import { createInteractionNotifications } from '../utils/notifications.js';
import {
  detectLanguage,
  extractMentionUsernames,
  sanitizeContent,
  validateCommentContent,
} from '../services/moderation.js';
import {
  checkFlooding,
  createChallenge,
  recordAttempt,
  recordSuccessfulPost,
  requiresCaptcha,
  verifyChallenge,
} from '../services/captcha.js';
import {
  EDIT_WINDOW_MS,
  LANGUAGE_CODES,
  MAX_COMMENT_LENGTH,
  MAX_REPORT_DETAILS,
  REPORT_REASON_VALUES,
} from '../constants.js';

const router = express.Router();

const AUTHOR_FIELDS = 'username avatar location preferredLanguage role';

function validId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function normalizeForDuplicate(content) {
  return content.toLowerCase().replace(/\s+/g, ' ').trim();
}

async function isDuplicateComment({ authorId, videoId, parentId, content, excludeId }) {
  const recent = await Comment.find({
    author: authorId,
    videoId,
    parent: parentId || null,
    deleted: false,
    removed: false,
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  })
    .select('content')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  const normalized = normalizeForDuplicate(content);
  return recent.some((comment) => normalizeForDuplicate(comment.content) === normalized);
}

async function resolveMentions(content, actorId) {
  const usernames = extractMentionUsernames(content);
  if (usernames.length === 0) return [];
  const users = await User.find({
    usernameLower: { $in: usernames },
    _id: { $ne: actorId },
  })
    .select('_id username')
    .lean();
  return users;
}

function captchaResponse(res, userId, message = 'Please complete the security check to continue.') {
  return res.status(428).json({
    message,
    code: 'CAPTCHA_REQUIRED',
    captchaRequired: true,
    challenge: createChallenge(userId),
  });
}

function logBlockedAttempt(req, validation, content) {
  ModerationLog.create({
    action: 'blocked_attempt',
    actor: req.user?._id,
    targetUser: req.user?._id,
    note: validation.message,
    metadata: {
      code: validation.code,
      issue: validation.issue || null,
      contentPreview: String(content).slice(0, 160),
    },
  }).catch(() => {});
}

router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const videoId = String(req.query.videoId || 'demo-video-1').trim().slice(0, 120);
    const sort = ['newest', 'oldest', 'mostLiked', 'mostRelevant'].includes(req.query.sort)
      ? req.query.sort
      : 'newest';

    const comments = await Comment.find({ videoId, removed: false })
      .populate('author', AUTHOR_FIELDS)
      .sort({ createdAt: 1 })
      .lean();

    const childrenByParent = new Map();
    for (const comment of comments) {
      if (!comment.parent) continue;
      const parentId = comment.parent.toString();
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
      childrenByParent.get(parentId).push(comment);
    }

    let topLevel = comments.filter((comment) => !comment.parent);
    const serialized = [];

    for (const comment of topLevel) {
      const rawReplies = childrenByParent.get(comment._id.toString()) || [];
      const visibleReplies = rawReplies
        .filter((reply) => !reply.deleted && !reply.removed)
        .map((reply) => serializeComment(reply, req.user, 0));

      if (comment.deleted && visibleReplies.length === 0) continue;

      const item = serializeComment(comment, req.user, visibleReplies.length);
      item.replies = visibleReplies;
      serialized.push(item);
    }

    if (sort === 'newest') {
      serialized.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sort === 'oldest') {
      serialized.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else if (sort === 'mostLiked') {
      serialized.sort(
        (a, b) => b.likes - a.likes || new Date(b.createdAt) - new Date(a.createdAt)
      );
    } else {
      const now = Date.now();
      const score = (comment) => {
        const ageDays = Math.max(0, (now - new Date(comment.createdAt).getTime()) / 86400000);
        const freshness = Math.max(0, 7 - ageDays);
        return (comment.likes - comment.dislikes) * 2 + comment.replyCount * 3 + freshness;
      };
      serialized.sort((a, b) => score(b) - score(a));
    }

    const total = serialized.reduce(
      (count, comment) => count + (comment.isDeleted ? 0 : 1) + comment.replies.length,
      0
    );

    return res.json({ comments: serialized, total, sort });
  } catch (error) {
    return next(error);
  }
});

router.get('/captcha', authRequired, (req, res) => {
  res.json({ challenge: createChallenge(req.user._id) });
});

router.get('/:id/history', authRequired, async (req, res, next) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid comment id.', code: 'INVALID_ID' });
    }
    const comment = await Comment.findById(req.params.id).lean();
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found.', code: 'NOT_FOUND' });
    }
    const isOwner = comment.author.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'You cannot view this comment history.', code: 'FORBIDDEN' });
    }

    const history = await CommentHistory.find({ comment: comment._id })
      .sort({ createdAt: -1 })
      .populate('editedBy', 'username avatar role')
      .lean();

    return res.json({
      history: history.map((entry) => ({
        id: entry._id.toString(),
        action: entry.action,
        previousContent: entry.previousContent,
        previousLanguage: entry.previousLanguage,
        previousVersion: entry.previousVersion,
        reason: entry.reason,
        createdAt: entry.createdAt,
        actor: entry.editedBy
          ? {
              id: entry.editedBy._id.toString(),
              username: entry.editedBy.username,
              avatar: entry.editedBy.avatar,
              role: entry.editedBy.role,
            }
          : null,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/', authRequired, commentLimiter, async (req, res, next) => {
  try {
    const userId = req.user._id;

    const flood = checkFlooding(userId);
    if (flood.blocked) {
      const attempt = recordAttempt(userId);
      return res.status(429).json({
        message: 'You are posting too many comments. Please wait before trying again.',
        code: 'FLOODING',
        retryAfter: Math.ceil(flood.retryAfterMs / 1000),
        captchaRequired: attempt.captchaRequired,
        challenge: attempt.captchaRequired ? createChallenge(userId) : undefined,
      });
    }

    const captchaNeeded = requiresCaptcha(userId);
    if (captchaNeeded || req.body.captchaToken) {
      const captchaValid = verifyChallenge(req.body.captchaToken, req.body.captchaAnswer, userId);
      if (!captchaValid) {
        recordAttempt(userId);
        return captchaResponse(res, userId);
      }
    }

    const content = sanitizeContent(req.body.content);
    if (!content) {
      return res.status(400).json({ message: 'Write something before posting.', code: 'EMPTY_COMMENT' });
    }
    if (content.length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({
        message: `Comments can be at most ${MAX_COMMENT_LENGTH} characters.`,
        code: 'COMMENT_TOO_LONG',
      });
    }

    const videoId = String(req.body.videoId || 'demo-video-1').trim().slice(0, 120) || 'demo-video-1';
    let parent = null;
    if (req.body.parentId) {
      if (!validId(req.body.parentId)) {
        return res.status(400).json({ message: 'Invalid parent comment.', code: 'INVALID_PARENT' });
      }
      parent = await Comment.findById(req.body.parentId).populate('author', AUTHOR_FIELDS);
      if (!parent || parent.videoId !== videoId) {
        return res.status(404).json({ message: 'The comment you are replying to was not found.', code: 'PARENT_NOT_FOUND' });
      }
      if (parent.parent) {
        return res.status(400).json({ message: 'Replies can only be added to top-level comments.', code: 'INVALID_PARENT' });
      }
      if (parent.deleted || parent.removed) {
        return res.status(409).json({ message: 'This comment has been deleted and cannot be replied to.', code: 'PARENT_DELETED' });
      }
    }

    const validation = validateCommentContent(content);
    if (!validation.ok) {
      logBlockedAttempt(req, validation, content);
      const attempt = recordAttempt(userId);
      return res.status(422).json({
        message: validation.message,
        code: validation.code,
        issue: validation.issue,
        captchaRequired: attempt.captchaRequired,
        challenge: attempt.captchaRequired ? createChallenge(userId) : undefined,
      });
    }

    const duplicate = await isDuplicateComment({
      authorId: userId,
      videoId,
      parentId: parent?._id,
      content,
    });
    if (duplicate) {
      const attempt = recordAttempt(userId);
      return res.status(409).json({
        message: 'You already posted this exact comment recently.',
        code: 'DUPLICATE_COMMENT',
        captchaRequired: attempt.captchaRequired,
        challenge: attempt.captchaRequired ? createChallenge(userId) : undefined,
      });
    }

    const language = LANGUAGE_CODES.has(req.body.language)
      ? req.body.language
      : detectLanguage(content);
    const mentionedUsers = await resolveMentions(content, userId);

    const comment = await Comment.create({
      videoId,
      author: userId,
      content,
      language,
      parent: parent?._id || null,
      mentions: mentionedUsers.map((user) => user._id),
    });

    await createInteractionNotifications({
      actor: req.user,
      comment,
      parent,
      mentionedUsers,
    });

    recordAttempt(userId);
    recordSuccessfulPost(userId);

    await ModerationLog.create({
      action: 'comment_created',
      actor: userId,
      targetUser: userId,
      comment: comment._id,
      metadata: {
        language,
        isReply: Boolean(parent),
        mentions: mentionedUsers.map((user) => user.username),
      },
    });

    const populated = await Comment.findById(comment._id).populate('author', AUTHOR_FIELDS).lean();
    return res.status(201).json({ comment: serializeComment(populated, req.user, 0) });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id', authRequired, commentLimiter, async (req, res, next) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid comment id.', code: 'INVALID_ID' });
    }

    const comment = await Comment.findById(req.params.id).populate('author', AUTHOR_FIELDS);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found.', code: 'NOT_FOUND' });
    }

    const isOwner = comment.author._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'You can only edit your own comments.', code: 'FORBIDDEN' });
    }
    if (comment.deleted || comment.removed) {
      return res.status(400).json({ message: 'This comment can no longer be edited.', code: 'COMMENT_INACTIVE' });
    }
    if (!isAdmin && Date.now() - new Date(comment.createdAt).getTime() > EDIT_WINDOW_MS) {
      return res.status(403).json({
        message: 'The edit window for this comment has expired.',
        code: 'EDIT_WINDOW_EXPIRED',
      });
    }

    const content = sanitizeContent(req.body.content);
    if (!content) {
      return res.status(400).json({ message: 'Comment cannot be empty.', code: 'EMPTY_COMMENT' });
    }
    if (content.length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({
        message: `Comments can be at most ${MAX_COMMENT_LENGTH} characters.`,
        code: 'COMMENT_TOO_LONG',
      });
    }

    const requestedVersion = Number(req.body.version);
    if (!Number.isInteger(requestedVersion) || requestedVersion < 0) {
      return res.status(400).json({ message: 'A valid comment version is required.', code: 'VERSION_REQUIRED' });
    }
    if (requestedVersion !== comment.version) {
      const replyCount = await Comment.countDocuments({
        parent: comment._id,
        deleted: false,
        removed: false,
      });
      return res.status(409).json({
        message: 'This comment was changed by another request. Review the latest version and try again.',
        code: 'EDIT_CONFLICT',
        comment: serializeComment(comment, req.user, replyCount),
      });
    }

    if (normalizeForDuplicate(content) === normalizeForDuplicate(comment.content)) {
      return res.json({ comment: serializeComment(comment, req.user, 0) });
    }

    const validation = validateCommentContent(content);
    if (!validation.ok) {
      logBlockedAttempt(req, validation, content);
      return res.status(422).json({ message: validation.message, code: validation.code });
    }

    const duplicate = await isDuplicateComment({
      authorId: comment.author._id,
      videoId: comment.videoId,
      parentId: comment.parent,
      content,
      excludeId: comment._id,
    });
    if (duplicate) {
      return res.status(409).json({
        message: 'You already posted this exact comment recently.',
        code: 'DUPLICATE_COMMENT',
      });
    }

    const language = LANGUAGE_CODES.has(req.body.language)
      ? req.body.language
      : detectLanguage(content);
    const mentionedUsers = await resolveMentions(content, req.user._id);

    const updated = await Comment.findOneAndUpdate(
      {
        _id: comment._id,
        version: requestedVersion,
        deleted: false,
        removed: false,
      },
      {
        $set: {
          content,
          language,
          edited: true,
          editedAt: new Date(),
          mentions: mentionedUsers.map((user) => user._id),
        },
        $inc: { version: 1, editCount: 1 },
      },
      { new: true }
    ).populate('author', AUTHOR_FIELDS);

    if (!updated) {
      const latest = await Comment.findById(comment._id).populate('author', AUTHOR_FIELDS);
      return res.status(409).json({
        message: 'This comment was changed by another request. Review the latest version and try again.',
        code: 'EDIT_CONFLICT',
        comment: latest ? serializeComment(latest, req.user, 0) : null,
      });
    }

    await CommentHistory.create({
      comment: comment._id,
      action: 'edited',
      previousContent: comment.content,
      previousLanguage: comment.language,
      previousVersion: comment.version,
      editedBy: req.user._id,
    });

    await createInteractionNotifications({
      actor: req.user,
      comment: updated,
      parent: null,
      mentionedUsers,
    });

    await ModerationLog.create({
      action: 'comment_edited',
      actor: req.user._id,
      targetUser: comment.author._id,
      comment: comment._id,
      metadata: { previousVersion: comment.version, newVersion: updated.version },
    });

    const replyCount = await Comment.countDocuments({
      parent: comment._id,
      deleted: false,
      removed: false,
    });

    return res.json({ comment: serializeComment(updated, req.user, replyCount) });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', authRequired, async (req, res, next) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid comment id.', code: 'INVALID_ID' });
    }

    const comment = await Comment.findById(req.params.id).populate('author', AUTHOR_FIELDS);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found.', code: 'NOT_FOUND' });
    }
    if (comment.deleted || comment.removed) {
      return res.status(409).json({ message: 'This comment is already deleted.', code: 'ALREADY_DELETED' });
    }

    const isOwner = comment.author._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'You can only delete your own comments.', code: 'FORBIDDEN' });
    }
    if (!isAdmin && Date.now() - new Date(comment.createdAt).getTime() > EDIT_WINDOW_MS) {
      return res.status(403).json({
        message: 'The delete window for this comment has expired.',
        code: 'EDIT_WINDOW_EXPIRED',
      });
    }

    const deleted = await Comment.findOneAndUpdate(
      {
        _id: comment._id,
        version: comment.version,
        deleted: false,
        removed: false,
      },
      {
        $set: {
          content: '',
          deleted: true,
          deletedAt: new Date(),
          deletedBy: req.user._id,
          status: 'deleted',
          mentions: [],
        },
        $inc: { version: 1 },
      },
      { new: true }
    );

    if (!deleted) {
      return res.status(409).json({
        message: 'This comment changed while you were deleting it. Please refresh and try again.',
        code: 'DELETE_CONFLICT',
      });
    }

    await CommentHistory.create({
      comment: comment._id,
      action: isAdmin && !isOwner ? 'removed' : 'deleted',
      previousContent: comment.content,
      previousLanguage: comment.language,
      previousVersion: comment.version,
      editedBy: req.user._id,
      reason: isAdmin && !isOwner ? 'Deleted by administrator' : 'Deleted by author',
    });

    await ModerationLog.create({
      action: 'comment_deleted',
      actor: req.user._id,
      targetUser: comment.author._id,
      comment: comment._id,
      note: isAdmin && !isOwner ? 'Deleted by administrator' : 'Deleted by author',
    });

    return res.json({ id: comment._id.toString(), deleted: true });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/react', authRequired, async (req, res, next) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid comment id.', code: 'INVALID_ID' });
    }
    const reaction = String(req.body.reaction || '');
    if (!['like', 'dislike', 'none'].includes(reaction)) {
      return res.status(400).json({ message: 'Invalid reaction.', code: 'INVALID_REACTION' });
    }

    const comment = await Comment.findById(req.params.id);
    if (!comment || comment.deleted || comment.removed) {
      return res.status(404).json({ message: 'Comment not found.', code: 'NOT_FOUND' });
    }

    const userId = req.user._id;
    await Comment.updateOne(
      { _id: comment._id },
      { $pull: { likes: userId, dislikes: userId } }
    );

    let updated = await Comment.findById(comment._id);
    if (reaction === 'like') {
      updated = await Comment.findByIdAndUpdate(
        comment._id,
        { $addToSet: { likes: userId } },
        { new: true }
      );
    } else if (reaction === 'dislike') {
      updated = await Comment.findByIdAndUpdate(
        comment._id,
        { $addToSet: { dislikes: userId } },
        { new: true }
      );
    }

    return res.json({
      id: updated._id.toString(),
      likes: updated.likes.length,
      dislikes: updated.dislikes.length,
      myReaction: reaction === 'none' ? null : reaction,
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/report', authRequired, reportLimiter, async (req, res, next) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid comment id.', code: 'INVALID_ID' });
    }
    const reason = String(req.body.reason || '');
    if (!REPORT_REASON_VALUES.has(reason)) {
      return res.status(400).json({ message: 'Choose a valid report reason.', code: 'INVALID_REASON' });
    }
    const details = sanitizeContent(req.body.details).slice(0, MAX_REPORT_DETAILS);

    const comment = await Comment.findById(req.params.id).populate('author', AUTHOR_FIELDS);
    if (!comment || comment.deleted || comment.removed) {
      return res.status(404).json({ message: 'Comment not found.', code: 'NOT_FOUND' });
    }
    if (comment.author._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot report your own comment.', code: 'SELF_REPORT' });
    }

    const existing = await Report.findOne({ comment: comment._id, reporter: req.user._id }).lean();
    if (existing) {
      return res.status(409).json({
        message: 'You have already reported this comment.',
        code: 'DUPLICATE_REPORT',
        status: existing.status,
      });
    }

    let report;
    try {
      report = await Report.create({
        comment: comment._id,
        reporter: req.user._id,
        reason,
        details,
        snapshot: {
          content: comment.content,
          language: comment.language,
          authorUsername: comment.author.username,
          commentCreatedAt: comment.createdAt,
          videoId: comment.videoId,
        },
      });
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({
          message: 'You have already reported this comment.',
          code: 'DUPLICATE_REPORT',
        });
      }
      throw error;
    }

    await Comment.updateOne(
      { _id: comment._id },
      {
        $set: {
          flagged: true,
          status: comment.status === 'visible' ? 'flagged' : comment.status,
          lastReportedAt: new Date(),
        },
        $inc: { reportCount: 1 },
      }
    );

    await ModerationLog.create({
      action: 'report_created',
      actor: req.user._id,
      targetUser: comment.author._id,
      comment: comment._id,
      report: report._id,
      note: `Reported for ${reason}`,
      metadata: { reason, details },
    });

    return res.status(201).json({
      message: 'Report submitted. A moderator will review this comment.',
      report: serializeReport(report),
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
