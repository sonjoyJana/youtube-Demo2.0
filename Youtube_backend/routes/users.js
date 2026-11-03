import express from 'express';
import { User } from '../models/User.js';
import { Notification } from '../models/Notification.js';
import { authRequired, optionalAuth } from '../middleware/auth.js';
import { LANGUAGE_CODES } from '../constants.js';

const router = express.Router();

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

router.get('/search', optionalAuth, async (req, res, next) => {
  try {
    const query = String(req.query.q || '').trim().replace(/^@/, '').slice(0, 30);
    if (!query) return res.json({ users: [] });

    const users = await User.find({
      usernameLower: { $regex: `^${escapeRegex(query.toLowerCase())}` },
    })
      .select('username avatar location preferredLanguage role')
      .sort({ username: 1 })
      .limit(8)
      .lean();

    return res.json({
      users: users.map((user) => ({
        id: user._id.toString(),
        username: user.username,
        avatar: user.avatar,
        location: user.location,
        preferredLanguage: user.preferredLanguage,
        role: user.role,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.patch('/me', authRequired, async (req, res, next) => {
  try {
    const updates = {};

    if (req.body.preferredLanguage !== undefined) {
      const language = String(req.body.preferredLanguage);
      if (!LANGUAGE_CODES.has(language)) {
        return res.status(400).json({ message: 'Unsupported preferred language.', code: 'INVALID_LANGUAGE' });
      }
      updates.preferredLanguage = language;
    }

    if (req.body.location !== undefined) {
      updates.location = String(req.body.location).trim().slice(0, 100) || 'Somewhere on Earth';
    }

    if (req.body.avatar !== undefined) {
      updates.avatar = String(req.body.avatar).trim().slice(0, 500);
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });
    return res.json({ user: user.toSafeJSON() });
  } catch (error) {
    return next(error);
  }
});

router.get('/me/notifications', authRequired, async (req, res, next) => {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ recipient: req.user._id })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('actor', 'username avatar')
        .populate('comment', 'videoId')
        .lean(),
      Notification.countDocuments({ recipient: req.user._id, read: false }),
    ]);

    return res.json({
      unreadCount,
      notifications: notifications.map((notification) => ({
        id: notification._id.toString(),
        type: notification.type,
        message: notification.message,
        read: notification.read,
        createdAt: notification.createdAt,
        videoId: notification.comment?.videoId || null,
        commentId: notification.comment?._id?.toString() || null,
        actor: notification.actor
          ? {
              id: notification.actor._id.toString(),
              username: notification.actor.username,
              avatar: notification.actor.avatar,
            }
          : null,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.patch('/me/notifications/read-all', authRequired, async (req, res, next) => {
  try {
    await Notification.updateMany({ recipient: req.user._id, read: false }, { read: true });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.patch('/me/notifications/:id/read', authRequired, async (req, res, next) => {
  try {
    await Notification.updateOne(
      { _id: req.params.id, recipient: req.user._id },
      { $set: { read: true } }
    );
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

export default router;
