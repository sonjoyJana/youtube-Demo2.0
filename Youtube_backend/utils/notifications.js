import { Notification } from '../models/Notification.js';

function snippet(text, length = 90) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  return normalized.length > length ? `${normalized.slice(0, length - 1)}…` : normalized;
}

export async function createInteractionNotifications({ actor, comment, parent, mentionedUsers }) {
  const notifications = [];
  const notified = new Set();

  for (const user of mentionedUsers) {
    if (user._id.toString() === actor._id.toString()) continue;
    notified.add(user._id.toString());
    notifications.push({
      recipient: user._id,
      actor: actor._id,
      comment: comment._id,
      type: 'mention',
      message: `${actor.username} mentioned you: “${snippet(comment.content)}”`,
    });
  }

  if (parent) {
    const parentAuthorId = parent.author?._id?.toString?.() || parent.author?.toString?.();
    if (
      parentAuthorId &&
      parentAuthorId !== actor._id.toString() &&
      !notified.has(parentAuthorId)
    ) {
      notifications.push({
        recipient: parentAuthorId,
        actor: actor._id,
        comment: comment._id,
        type: 'reply',
        message: `${actor.username} replied to your comment: “${snippet(comment.content)}”`,
      });
    }
  }

  if (notifications.length > 0) {
    await Notification.insertMany(notifications);
  }
}
