import { EDIT_WINDOW_MS } from '../constants.js';

function idOf(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._id) return value._id.toString();
  return value.toString();
}

export function serializeComment(comment, currentUser, replyCount = 0) {
  const author = comment.author;
  const authorId = idOf(author);
  const currentUserId = currentUser ? currentUser._id.toString() : null;
  const isOwner = currentUserId && authorId === currentUserId;
  const isAdmin = currentUser?.role === 'admin';
  const isActive = !comment.deleted && !comment.removed;
  const withinEditWindow = Date.now() - new Date(comment.createdAt).getTime() <= EDIT_WINDOW_MS;
  const liked = currentUserId
    ? (comment.likes || []).some((id) => id.toString() === currentUserId)
    : false;
  const disliked = currentUserId
    ? (comment.dislikes || []).some((id) => id.toString() === currentUserId)
    : false;

  return {
    id: comment._id.toString(),
    videoId: comment.videoId,
    content: isActive ? comment.content : '',
    language: comment.language,
    author: author
      ? {
          id: authorId,
          username: author.username,
          avatar: author.avatar,
          location: author.location,
          preferredLanguage: author.preferredLanguage,
          role: author.role,
        }
      : {
          id: authorId,
          username: 'Deleted user',
          avatar: '',
          location: '',
          preferredLanguage: 'en',
          role: 'user',
        },
    parentId: idOf(comment.parent),
    likes: (comment.likes || []).length,
    dislikes: (comment.dislikes || []).length,
    myReaction: liked ? 'like' : disliked ? 'dislike' : null,
    replyCount,
    edited: Boolean(comment.edited),
    editedAt: comment.editedAt || null,
    editCount: comment.editCount || 0,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    version: comment.version || 0,
    isDeleted: Boolean(comment.deleted),
    isRemoved: Boolean(comment.removed),
    isFlagged: isAdmin ? Boolean(comment.flagged) : false,
    reportCount: isAdmin ? comment.reportCount || 0 : 0,
    canEdit: Boolean(isOwner && isActive && withinEditWindow),
    canDelete: Boolean(isActive && ((isOwner && withinEditWindow) || isAdmin)),
    isOwner: Boolean(isOwner),
    mentions: (comment.mentions || []).map(idOf).filter(Boolean),
  };
}

export function serializeReport(report) {
  return {
    id: report._id.toString(),
    reason: report.reason,
    details: report.details,
    status: report.status,
    snapshot: report.snapshot,
    createdAt: report.createdAt,
    resolvedAt: report.resolvedAt,
    moderationNote: report.moderationNote,
    reporter: report.reporter
      ? {
          id: report.reporter._id.toString(),
          username: report.reporter.username,
          avatar: report.reporter.avatar,
        }
      : null,
    moderator: report.moderator
      ? {
          id: report.moderator._id.toString(),
          username: report.moderator.username,
        }
      : null,
    commentId: idOf(report.comment),
  };
}
