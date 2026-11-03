import { Router } from 'express';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { LoginRecord } from '../models/LoginRecord.js';
import { TrustedDevice } from '../models/TrustedDevice.js';
import { Session } from '../models/Session.js';
import { SecurityEvent } from '../models/SecurityEvent.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { loginSummary, sessionSummary, trustedDeviceSummary } from '../utils/serialize.js';
import { themeInfo } from '../utils/ist.js';
import { escapeRegex } from '../utils/validate.js';
import { recordEvent } from '../services/events.js';

const router = Router();
const DAY = 24 * 60 * 60 * 1000;

function currentDeviceId(req) {
  return String(req.headers['x-device-id'] || '').replace(/[^\w-]/g, '').slice(0, 80);
}

router.get(
  '/overview',
  requireAuth,
  asyncHandler(async (req, res) => {
    const since7 = new Date(Date.now() - 7 * DAY);
    const since30 = new Date(Date.now() - 30 * DAY);
    const userId = req.user._id;

    const [
      totalLogins,
      successfulLogins,
      failedLogins,
      otpRequired,
      lastSuccess,
      recentLogins,
      trustedDevices,
      activeSessions,
      failedLast7,
      otpFailedLast7,
      newDevicesLast30
    ] = await Promise.all([
      LoginRecord.countDocuments({ user: userId }),
      LoginRecord.countDocuments({ user: userId, status: 'success' }),
      LoginRecord.countDocuments({ user: userId, status: 'failed' }),
      LoginRecord.countDocuments({ user: userId, requiresOtp: true }),
      LoginRecord.findOne({ user: userId, status: 'success' }).sort({ createdAt: -1 }).lean(),
      LoginRecord.find({ user: userId }).sort({ createdAt: -1 }).limit(6).lean(),
      TrustedDevice.countDocuments({ user: userId, expiresAt: { $gt: new Date() } }),
      Session.countDocuments({
        user: userId,
        revokedAt: null,
        expiresAt: { $gt: new Date() }
      }),
      LoginRecord.countDocuments({ user: userId, status: 'failed', createdAt: { $gte: since7 } }),
      SecurityEvent.countDocuments({ user: userId, type: 'otp_failed', createdAt: { $gte: since7 } }),
      LoginRecord.countDocuments({
        user: userId,
        status: 'success',
        createdAt: { $gte: since30 },
        $or: [{ isNewDevice: true }, { isNewBrowser: true }]
      })
    ]);

    let score = 100;
    const factors = [];
    if (!req.user.mobile) {
      score -= 8;
      factors.push('Add a mobile number for SMS OTP fallback');
    } else {
      factors.push('Email and mobile OTP channels available');
    }
    if (failedLast7 > 0) {
      const penalty = Math.min(20, failedLast7 * 4);
      score -= penalty;
      factors.push(`${failedLast7} failed sign-in attempt${failedLast7 === 1 ? '' : 's'} this week`);
    }
    if (otpFailedLast7 > 0) {
      const penalty = Math.min(15, otpFailedLast7 * 3);
      score -= penalty;
      factors.push(`${otpFailedLast7} failed OTP attempt${otpFailedLast7 === 1 ? '' : 's'} this week`);
    }
    if (trustedDevices === 0) {
      score -= 5;
      factors.push('No trusted devices yet');
    } else {
      factors.push(`${trustedDevices} trusted device${trustedDevices === 1 ? '' : 's'}`);
    }
    score = Math.max(35, Math.min(100, Math.round(score)));
    const label = score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score >= 60 ? 'Fair' : 'Needs attention';

    res.json({
      stats: {
        totalLogins,
        successfulLogins,
        failedLogins,
        otpRequired,
        trustedDevices,
        activeSessions,
        failedLast7,
        otpFailedLast7,
        newDevicesLast30,
        protectedSince: req.user.createdAt
      },
      securityScore: { value: score, label, factors },
      lastLogin: loginSummary(lastSuccess),
      recentLogins: recentLogins.map(loginSummary),
      theme: themeInfo(req.user),
      policy: {
        trustedDeviceDays: env.trustedDeviceDays,
        otpTtlMinutes: env.otpTtlMinutes,
        otpMaxAttempts: env.otpMaxAttempts,
        themeWindow: '5:00 AM – 11:59 AM IST'
      }
    });
  })
);

router.get(
  '/logins',
  requireAuth,
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const status = String(req.query.status || 'all');
    const search = String(req.query.q || '').trim().slice(0, 100);

    const filter = { user: req.user._id };
    if (['success', 'failed', 'pending_otp', 'otp_locked'].includes(status)) {
      filter.status = status;
    }
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      filter.$or = [
        { ip: regex },
        { city: regex },
        { state: regex },
        { country: regex },
        { browserName: regex },
        { osName: regex },
        { deviceModel: regex },
        { deviceType: regex }
      ];
    }

    const [items, total] = await Promise.all([
      LoginRecord.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      LoginRecord.countDocuments(filter)
    ]);

    const counts = await LoginRecord.aggregate([
      { $match: { user: req.user._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    res.json({
      items: items.map(loginSummary),
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
        hasMore: page * limit < total
      },
      counts: counts.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {})
    });
  })
);

router.get(
  '/trusted-devices',
  requireAuth,
  asyncHandler(async (req, res) => {
    const devices = await TrustedDevice.find({
      user: req.user._id,
      expiresAt: { $gt: new Date() }
    })
      .sort({ lastUsedAt: -1 })
      .lean();

    const deviceId = currentDeviceId(req);
    res.json({
      items: devices.map((device) => trustedDeviceSummary(device, deviceId)),
      policy: { trustedDeviceDays: env.trustedDeviceDays }
    });
  })
);

router.delete(
  '/trusted-devices/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid trusted device id.' });
    }

    const device = await TrustedDevice.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });
    if (!device) {
      return res.status(404).json({ message: 'Trusted device not found.' });
    }

    recordEvent({
      user: req.user._id,
      type: 'trusted_device_removed',
      message: `Removed trust for ${device.name || 'a device'}`,
      ip: req.session.ip,
      city: req.session.city,
      state: req.session.state,
      country: req.session.country,
      browserName: req.session.browserName,
      deviceType: req.session.deviceType,
      metadata: { deviceId: device.deviceId }
    });

    res.json({ message: 'Device removed from trusted list. OTP will be required next time.' });
  })
);

router.get(
  '/sessions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const sessions = await Session.find({
      user: req.user._id,
      revokedAt: null,
      expiresAt: { $gt: new Date() }
    })
      .sort({ lastActiveAt: -1 })
      .lean();

    res.json({
      items: sessions.map((session) => sessionSummary(session, req.session.sessionId)),
      currentSessionId: req.session.sessionId
    });
  })
);

router.delete(
  '/sessions/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid session id.' });
    }

    const session = await Session.findOne({
      _id: req.params.id,
      user: req.user._id,
      revokedAt: null
    });
    if (!session) {
      return res.status(404).json({ message: 'Active session not found.' });
    }

    const isCurrent = session.sessionId === req.session.sessionId;
    session.revokedAt = new Date();
    session.revokedReason = 'revoked_by_user';
    await session.save();

    recordEvent({
      user: req.user._id,
      type: 'session_revoked',
      message: isCurrent ? 'Signed out current session' : 'Revoked a remote session',
      ip: session.ip,
      city: session.city,
      state: session.state,
      country: session.country,
      browserName: session.browserName,
      deviceType: session.deviceType,
      metadata: { sessionId: session.sessionId, current: isCurrent }
    });

    res.json({
      message: isCurrent ? 'Current session ended.' : 'Session revoked.',
      signedOut: isCurrent
    });
  })
);

router.delete(
  '/sessions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await Session.updateMany(
      {
        user: req.user._id,
        sessionId: { $ne: req.session.sessionId },
        revokedAt: null,
        expiresAt: { $gt: new Date() }
      },
      { $set: { revokedAt: new Date(), revokedReason: 'revoked_all_by_user' } }
    );

    if (result.modifiedCount > 0) {
      recordEvent({
        user: req.user._id,
        type: 'session_revoked',
        message: `Revoked ${result.modifiedCount} other session${result.modifiedCount === 1 ? '' : 's'}`,
        ip: req.session.ip,
        city: req.session.city,
        state: req.session.state,
        country: req.session.country,
        browserName: req.session.browserName,
        deviceType: req.session.deviceType,
        metadata: { count: result.modifiedCount }
      });
    }

    res.json({
      message: `${result.modifiedCount} other session${result.modifiedCount === 1 ? '' : 's'} revoked.`,
      revoked: result.modifiedCount
    });
  })
);

router.get(
  '/events',
  requireAuth,
  asyncHandler(async (req, res) => {
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 40));
    const type = String(req.query.type || '');
    const filter = { user: req.user._id };
    if (type) filter.type = type;

    const events = await SecurityEvent.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({
      items: events.map((event) => ({
        id: String(event._id),
        type: event.type,
        message: event.message,
        ip: event.ip,
        location: {
          city: event.city,
          state: event.state,
          country: event.country
        },
        browserName: event.browserName,
        deviceType: event.deviceType,
        metadata: event.metadata,
        timestamp: event.createdAt
      }))
    });
  })
);

export default router;
