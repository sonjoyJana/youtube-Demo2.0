import express from 'express';
import mongoose from 'mongoose';
import { Comment } from '../models/Comment.js';
import { CommentHistory } from '../models/CommentHistory.js';
import { ModerationLog } from '../models/ModerationLog.js';
import { Notification } from '../models/Notification.js';
import { Report } from '../models/Report.js';
import { authRequired, adminRequired } from '../middleware/auth.js';
import { serializeReport } from '../utils/commentSerializer.js';

const router = express.Router();

router.use(authRequired, adminRequired);

router.get('/reports', async (req, res, next) => {
  try {
    const status = ['pending', 'dismissed', 'removed', 'all'].includes(req.query.status)
      ? req.query.status
      : 'pending';
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const filter = status === 'all' ? {} : { status };

    const [reports, total] = await Promise.all([
      Report.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('reporter', 'username avatar')
        .populate('moderator', 'username')
        .populate('comment', 'videoId')
        .lean(),
      Report.countDocuments(filter),
    ]);

    return res.json({
      reports: reports.map(serializeReport),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    return next(error);
  }
});

router.patch('/reports/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid report id.', code: 'INVALID_ID' });
    }
    const action = String(req.body.action || '');
    if (!['dismiss', 'remove'].includes(action)) {
      return res.status(400).json({ message: 'Choose dismiss or remove.', code: 'INVALID_ACTION' });
    }
    const note = String(req.body.note || '').trim().slice(0, 1000);

    const report = await Report.findById(req.params.id).populate('comment');
    if (!report) {
      return res.status(404).json({ message: 'Report not found.', code: 'NOT_FOUND' });
    }
    if (report.status !== 'pending') {
      return res.status(409).json({
        message: 'This report has already been reviewed.',
        code: 'REPORT_ALREADY_RESOLVED',
      });
    }

    const comment = report.comment;
    const now = new Date();

    if (action === 'remove') {
      if (comment && !comment.removed && !comment.deleted) {
        await CommentHistory.create({
          comment: comment._id,
          action: 'removed',
          previousContent: comment.content,
          previousLanguage: comment.language,
          previousVersion: comment.version,
          editedBy: req.user._id,
          reason: note || `Removed after report: ${report.reason}`,
          report: report._id,
        });

        await Comment.updateOne(
          { _id: comment._id, version: comment.version },
          {
            $set: {
              content: '',
              removed: true,
              removedAt: now,
              removedBy: req.user._id,
              status: 'removed',
              mentions: [],
            },
            $inc: { version: 1 },
          }
        );

        await Notification.create({
          recipient: comment.author,
          actor: req.user._id,
          comment: comment._id,
          type: 'moderation',
          message: `Your comment was removed by a moderator for ${report.reason}.`,
        });

        await ModerationLog.create({
          action: 'comment_removed',
          actor: req.user._id,
          targetUser: comment.author,
          comment: comment._id,
          report: report._id,
          note: note || 'Removed after moderator review',
          metadata: { reason: report.reason },
        });
      }

      await Report.updateMany(
        { comment: report.comment?._id || report.comment, status: 'pending' },
        {
          $set: {
            status: 'removed',
            moderator: req.user._id,
            moderationNote: note,
            resolvedAt: now,
          },
        }
      );

      await ModerationLog.create({
        action: 'report_resolved',
        actor: req.user._id,
        comment: report.comment?._id,
        report: report._id,
        note: note || 'Report resolved with comment removal',
        metadata: { action: 'remove', reason: report.reason },
      });
    } else {
      report.status = 'dismissed';
      report.moderator = req.user._id;
      report.moderationNote = note;
      report.resolvedAt = now;
      await report.save();

      if (comment) {
        const remaining = await Report.countDocuments({
          comment: comment._id,
          status: 'pending',
        });
        if (remaining === 0 && !comment.deleted && !comment.removed) {
          await Comment.updateOne(
            { _id: comment._id, status: 'flagged' },
            { $set: { flagged: false, status: 'visible' } }
          );
        }
      }

      await ModerationLog.create({
        action: 'report_dismissed',
        actor: req.user._id,
        comment: report.comment?._id,
        report: report._id,
        note: note || 'Report dismissed after review',
        metadata: { reason: report.reason },
      });
    }

    const updated = await Report.findById(report._id)
      .populate('reporter', 'username avatar')
      .populate('moderator', 'username')
      .populate('comment', 'videoId')
      .lean();

    return res.json({ report: serializeReport(updated) });
  } catch (error) {
    return next(error);
  }
});

router.get('/logs', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const action = req.query.action ? String(req.query.action) : null;
    const filter = action ? { action } : {};

    const [logs, total] = await Promise.all([
      ModerationLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('actor', 'username avatar role')
        .populate('targetUser', 'username avatar')
        .populate('comment', 'videoId language')
        .populate('report', 'reason status')
        .lean(),
      ModerationLog.countDocuments(filter),
    ]);

    return res.json({
      logs: logs.map((log) => ({
        id: log._id.toString(),
        action: log.action,
        note: log.note,
        metadata: log.metadata,
        createdAt: log.createdAt,
        actor: log.actor
          ? { id: log.actor._id.toString(), username: log.actor.username, avatar: log.actor.avatar, role: log.actor.role }
          : null,
        targetUser: log.targetUser
          ? { id: log.targetUser._id.toString(), username: log.targetUser.username, avatar: log.targetUser.avatar }
          : null,
        comment: log.comment
          ? { id: log.comment._id.toString(), videoId: log.comment.videoId, language: log.comment.language }
          : null,
        report: log.report
          ? { id: log.report._id.toString(), reason: log.report.reason, status: log.report.status }
          : null,
      })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/stats', async (_req, res, next) => {
  try {
    const [
      pendingReports,
      totalReports,
      flaggedComments,
      removedComments,
      totalComments,
      blockedAttempts,
    ] = await Promise.all([
      Report.countDocuments({ status: 'pending' }),
      Report.countDocuments({}),
      Comment.countDocuments({ flagged: true, removed: false, deleted: false }),
      Comment.countDocuments({ removed: true }),
      Comment.countDocuments({ deleted: false, removed: false }),
      ModerationLog.countDocuments({ action: 'blocked_attempt' }),
    ]);

    return res.json({
      pendingReports,
      totalReports,
      flaggedComments,
      removedComments,
      totalComments,
      blockedAttempts,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
