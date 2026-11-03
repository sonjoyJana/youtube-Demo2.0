import { Router } from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { LoginRecord } from '../models/LoginRecord.js';
import { TrustedDevice } from '../models/TrustedDevice.js';
import { OtpChallenge } from '../models/OtpChallenge.js';
import { requireAuth } from '../middleware/auth.js';
import { loginLimiter, otpVerifyLimiter, otpResendLimiter } from '../middleware/rateLimiters.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { safeUser, loginSummary } from '../utils/serialize.js';
import { normalizeEmail, normalizeMobile, EMAIL_RE, MOBILE_RE } from '../utils/validate.js';
import { themeForLoginTime, themeInfo } from '../utils/ist.js';
import { buildDeviceInfo } from '../services/deviceInfo.js';
import { extractRequestIp, lookupGeo } from '../services/geo.js';
import { generateOtp, hashOtp, verifyOtpHash, maskEmail, maskMobile, otpExpiry } from '../services/otp.js';
import { deliverOtp } from '../services/notifier.js';
import { createSession } from '../services/sessions.js';
import { recordEvent, eventContext } from '../services/events.js';

const router = Router();

function slugify(name) {
  const slug = String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30);
  return slug;
}

function geoRecordFields(geo) {
  return {
    ip: geo.ip || '',
    ipIsPrivate: Boolean(geo.isPrivate),
    city: geo.city || '',
    state: geo.state || '',
    country: geo.country || '',
    locationLabel: geo.locationLabel || '',
    latitude: geo.latitude ?? null,
    longitude: geo.longitude ?? null,
    timezone: geo.timezone || ''
  };
}

function deviceRecordFields(device) {
  return {
    browserName: device.browserName,
    browserVersion: device.browserVersion,
    osName: device.osName,
    osVersion: device.osVersion,
    deviceType: device.deviceType,
    deviceModel: device.deviceModel,
    deviceId: device.deviceId,
    fingerprint: device.fingerprint,
    userAgent: device.userAgent
  };
}

function loginMeta(record, reasons) {
  return {
    ...loginSummary(record),
    reasons: reasons || record.newDeviceReasons || []
  };
}

function maskDestination(user, channel) {
  return channel === 'mobile' ? maskMobile(user.mobile) : maskEmail(user.email);
}

function challengeResponse({ challenge, user, delivery, plainOtp, record, reasons }) {
  return {
    requiresOtp: true,
    challenge: {
      id: String(challenge._id),
      channel: challenge.channel,
      destination: maskDestination(user, challenge.channel),
      emailMasked: maskEmail(user.email),
      mobileMasked: user.mobile ? maskMobile(user.mobile) : '',
      availableChannels: ['email', ...(user.mobile ? ['mobile'] : [])],
      expiresAt: challenge.expiresAt,
      ttlMinutes: env.otpTtlMinutes,
      resendAfterSeconds: env.otpResendSeconds,
      attemptsRemaining: Math.max(0, challenge.maxAttempts - challenge.attempts),
      delivery: delivery?.provider || 'console',
      devOtp: env.exposeDevOtp && !delivery?.delivered ? plainOtp : undefined
    },
    login: loginMeta(record, reasons),
    trustedDeviceDays: env.trustedDeviceDays
  };
}

async function detectLoginContext(user, device, geo) {
  const now = new Date();
  const trusted = await TrustedDevice.findOne({
    user: user._id,
    deviceId: device.deviceId,
    fingerprint: device.fingerprint,
    expiresAt: { $gt: now }
  });

  const previous = await LoginRecord.find({ user: user._id, status: 'success' })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  const flags = {
    isNewBrowser: false,
    isNewDevice: false,
    isNewIp: false,
    isNewLocation: false
  };
  const reasons = [];

  if (!previous.length) {
    flags.isNewBrowser = true;
    flags.isNewDevice = true;
    flags.isNewIp = true;
    flags.isNewLocation = true;
    reasons.push('First sign-in on this account');
  } else {
    const knownBrowsers = new Set(previous.map((item) => item.browserName).filter(Boolean));
    const knownDevices = new Set(previous.map((item) => item.fingerprint).filter(Boolean));
    const knownIps = new Set(previous.map((item) => item.ip).filter(Boolean));
    const knownCities = new Set(previous.map((item) => item.city).filter(Boolean));
    const knownStates = new Set(previous.map((item) => item.state).filter(Boolean));

    if (!knownBrowsers.has(device.browserName)) {
      flags.isNewBrowser = true;
      reasons.push(`New browser detected: ${device.browserName}`);
    }
    if (!knownDevices.has(device.fingerprint)) {
      flags.isNewDevice = true;
      reasons.push(`New device detected: ${device.name}`);
    }
    if (geo.ip && !knownIps.has(geo.ip)) {
      flags.isNewIp = true;
      reasons.push(`New IP address: ${geo.ip}`);
    }
    const cityChanged = geo.city && knownCities.size > 0 && !knownCities.has(geo.city);
    const stateChanged = geo.state && knownStates.size > 0 && !knownStates.has(geo.state);
    if (cityChanged || stateChanged) {
      flags.isNewLocation = true;
      reasons.push(`New sign-in location: ${geo.locationLabel}`);
    }
  }

  if (trusted) {
    trusted.lastUsedAt = now;
    trusted.lastIp = geo.ip;
    trusted.lastCity = geo.city;
    trusted.lastState = geo.state;
    trusted.lastCountry = geo.country;
    trusted.lastLocationLabel = geo.locationLabel;
    trusted.browserVersion = device.browserVersion;
    await trusted.save();
  }

  return {
    trusted,
    reasons: trusted ? [] : reasons,
    flags,
    requireOtp: !trusted && reasons.length > 0
  };
}

function applyLoginTheme(user, loginTime = new Date()) {
  if (user.themePreference === 'auto') {
    user.theme = themeForLoginTime(loginTime);
  }
}

router.get('/config', (_req, res) => {
  res.json({
    trustWindow: '5:00 AM – 11:59 AM IST',
    trustedDeviceDays: env.trustedDeviceDays,
    otpTtlMinutes: env.otpTtlMinutes,
    otpMaxAttempts: env.otpMaxAttempts,
    otpResendSeconds: env.otpResendSeconds,
    otpDeliveryConfigured: Boolean(env.smtp.host || env.twilio.accountSid)
  });
});

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name || '').trim();
    const username = String(req.body?.username || '').trim() || slugify(name);
    const email = normalizeEmail(req.body?.email);
    const mobile = normalizeMobile(req.body?.mobile);
    const password = String(req.body?.password || '');
    const location = String(req.body?.location || 'Somewhere on Earth').trim().slice(0, 100);
    const preferredLanguage = String(req.body?.preferredLanguage || 'en');
    const displayName = name || String(username || '').replace(/_/g, ' ').trim();
    if (displayName.length < 2 || displayName.length > 80) {
      return res.status(400).json({ message: 'Please enter your full name (2–80 characters).' });
    }
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      return res.status(400).json({ message: 'Username must be 3–30 characters using letters, numbers, or underscores.' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }
    if (mobile && !MOBILE_RE.test(mobile)) {
      return res.status(400).json({ message: 'Enter a valid 10-digit Indian mobile number.' });
    }
    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({ message: 'Password must be 8–72 characters long.' });
    }
    if (!String(preferredLanguage).split(',').map((l) => l.trim())[0] || preferredLanguage.length !== 2) {
      return res.status(400).json({ message: 'Unsupported preferred language.' });
    }

    const existing = await User.findOne({
      $or: [{ email }, { usernameLower: username.toLowerCase() }]
    }).lean();
    if (existing) {
      const field = existing.email === email ? 'email address' : 'username';
      return res.status(409).json({ message: `An account with this ${field} already exists.` });
    }

    const user = await User.create({
      name: displayName,
      username,
      email,
      mobile,
      password,
      location,
      preferredLanguage,
      avatar: String(req.body?.avatar || '').slice(0, 500) || `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(username)}`,
      theme: themeForLoginTime(new Date()),
      themePreference: 'auto'
    });

    const device = buildDeviceInfo(req, req.body?.deviceMeta || {});
    const { token, session, expiresAt } = await createSession({ user, device, geo: { ip: '', city: '', state: '', country: '', locationLabel: '' } });

    await recordEvent({
      user: user._id,
      type: 'account_created',
      message: 'YouTube account created',
      ...eventContext({ ip: '' }, device)
    });

    return res.status(201).json({
      message: 'Account created. Welcome to YouTube.',
      token,
      user: safeUser(user),
      sessionId: session.sessionId,
      sessionExpiresAt: expiresAt,
      themeInfo: themeInfo(user)
    });
  })
);

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const identifier = String(req.body?.email || '').trim();
    const email = normalizeEmail(identifier);
    const password = String(req.body?.password || '');
    const device = buildDeviceInfo(req, req.body?.deviceMeta || {});

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }
    if (!EMAIL_RE.test(email) && !/^[a-zA-Z0-9_]{3,30}$/.test(identifier)) {
      return res.status(400).json({ message: 'Enter a valid email address or username.' });
    }

    const { ip, isPrivate } = await extractRequestIp(req);
    const geo = { ...(await lookupGeo(ip)), ip, isPrivate };

    const user = await User.findOne({
      $or: [{ email }, { usernameLower: identifier.toLowerCase() }]
    }).select('+password');
    if (!user) {
      const record = await LoginRecord.create({
        email,
        status: 'failed',
        reason: 'Invalid email or password',
        ...geoRecordFields(geo),
        ...deviceRecordFields(device)
      });
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const passwordMatches = await user.comparePassword(password);
    if (!passwordMatches) {
      const record = await LoginRecord.create({
        user: user._id,
        email,
        status: 'failed',
        reason: 'Incorrect password',
        ...geoRecordFields(geo),
        ...deviceRecordFields(device)
      });
      await recordEvent({
        user: user._id,
        type: 'login_failed',
        message: 'Sign-in failed: incorrect password',
        ...eventContext(geo, device),
        metadata: { loginRecord: String(record._id) }
      });
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const detection = await detectLoginContext(user, device, geo);
    const baseFields = {
      user: user._id,
      email,
      ...geoRecordFields(geo),
      ...deviceRecordFields(device),
      ...detection.flags,
      newDeviceReasons: detection.reasons,
      trusted: Boolean(detection.trusted)
    };

    if (!detection.requireOtp) {
      applyLoginTheme(user);
      user.lastLoginAt = new Date();
      await user.save();

      const { token, session, expiresAt } = await createSession({ user, device, geo });
      const record = await LoginRecord.create({
        ...baseFields,
        status: 'success',
        requiresOtp: false,
        otpVerified: false,
        sessionId: session.sessionId
      });

      await recordEvent({
        user: user._id,
        type: 'login_success',
        message: detection.trusted ? 'Sign-in successful from a trusted device' : 'Sign-in successful from a recognized device',
        ...eventContext(geo, device),
        metadata: { loginRecord: String(record._id), trusted: Boolean(detection.trusted) }
      });

      return res.json({
        requiresOtp: false,
        token,
        user: safeUser(user),
        sessionId: session.sessionId,
        sessionExpiresAt: expiresAt,
        themeInfo: themeInfo(user),
        login: loginMeta(record, detection.reasons)
      });
    }

    const record = await LoginRecord.create({
      ...baseFields,
      status: 'pending_otp',
      requiresOtp: true
    });

    const otp = generateOtp();
    const challenge = await OtpChallenge.create({
      user: user._id,
      loginRecord: record._id,
      channel: 'email',
      destination: user.email,
      otpHash: hashOtp(otp),
      expiresAt: otpExpiry(),
      maxAttempts: env.otpMaxAttempts
    });

    record.challengeId = challenge._id;
    await record.save();

    const delivery = await deliverOtp({
      user,
      destination: user.email,
      channel: 'email',
      otp,
      context: {
        ip: geo.ip,
        locationLabel: geo.locationLabel,
        browserName: device.browserName,
        deviceType: device.deviceType
      }
    });

    await recordEvent({
      user: user._id,
      type: 'otp_sent',
      message: `Verification code sent to registered email (${delivery.provider})`,
      ...eventContext(geo, device),
      metadata: { loginRecord: String(record._id), reasons: detection.reasons }
    });

    return res.json(
      challengeResponse({
        challenge,
        user,
        delivery,
        plainOtp: otp,
        record,
        reasons: detection.reasons
      })
    );
  })
);

router.post(
  '/verify-otp',
  otpVerifyLimiter,
  asyncHandler(async (req, res) => {
    const { challengeId, otp } = req.body || {};
    const rememberDevice = req.body?.rememberDevice !== false;
    const normalizedOtp = String(otp || '').replace(/\D/g, '');

    if (!mongoose.isValidObjectId(challengeId)) {
      return res.status(400).json({ message: 'Invalid verification request.' });
    }
    if (normalizedOtp.length !== 6) {
      return res.status(400).json({ message: 'Enter the 6-digit verification code.' });
    }

    const challenge = await OtpChallenge.findById(challengeId);
    if (!challenge) {
      return res.status(404).json({ message: 'Verification request not found. Please sign in again.' });
    }

    const user = await User.findById(challenge.user);
    const record = await LoginRecord.findById(challenge.loginRecord);
    if (!user || !record) {
      return res.status(404).json({ message: 'Verification request is no longer valid.' });
    }

    if (challenge.status === 'verified' || challenge.usedAt) {
      return res.status(409).json({ message: 'This code has already been used. Please sign in again.' });
    }
    if (challenge.status === 'locked') {
      return res.status(429).json({
        message: 'Too many incorrect codes. Please sign in again to request a new code.',
        attemptsRemaining: 0,
        locked: true
      });
    }
    if (challenge.expiresAt.getTime() < Date.now()) {
      challenge.status = 'expired';
      await challenge.save();
      record.status = 'otp_locked';
      record.reason = 'Verification code expired';
      await record.save();
      return res.status(410).json({ message: 'This code expired. Please sign in again.', expired: true });
    }

    const device = buildDeviceInfo(req, req.body?.deviceMeta || {});
    const { ip, isPrivate } = await extractRequestIp(req);
    const geo = { ...(await lookupGeo(ip)), ip, isPrivate };

    if (!verifyOtpHash(normalizedOtp, challenge.otpHash)) {
      challenge.attempts += 1;
      record.otpAttempts = challenge.attempts;

      const attemptsRemaining = Math.max(0, challenge.maxAttempts - challenge.attempts);
      if (attemptsRemaining === 0) {
        challenge.status = 'locked';
        record.status = 'otp_locked';
        record.reason = 'Too many incorrect verification codes';
        await challenge.save();
        await record.save();
        await recordEvent({
          user: user._id,
          type: 'otp_locked',
          message: 'OTP verification locked after too many failed attempts',
          ...eventContext(geo, device),
          metadata: { loginRecord: String(record._id), attempts: challenge.attempts }
        });
        return res.status(429).json({
          message: 'Too many incorrect codes. Please sign in again to request a new code.',
          attemptsRemaining: 0,
          locked: true
        });
      }

      await challenge.save();
      await record.save();
      await recordEvent({
        user: user._id,
        type: 'otp_failed',
        message: `Incorrect OTP entered (${attemptsRemaining} attempts left)`,
        ...eventContext(geo, device),
        metadata: { loginRecord: String(record._id), attemptsRemaining }
      });
      return res.status(401).json({
        message: `Incorrect code. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining.`,
        attemptsRemaining
      });
    }

    challenge.status = 'verified';
    challenge.usedAt = new Date();
    await challenge.save();

    applyLoginTheme(user, record.createdAt);
    user.lastLoginAt = new Date();
    await user.save();

    const { token, session, expiresAt } = await createSession({ user, device, geo });

    record.status = 'success';
    record.otpVerified = true;
    record.trusted = rememberDevice;
    record.reason = 'Verified with one-time password';
    record.sessionId = session.sessionId;
    record.deviceId = device.deviceId;
    record.fingerprint = device.fingerprint;
    await record.save();

    let trustedUntil = null;
    if (rememberDevice) {
      const trustExpiresAt = new Date(Date.now() + env.trustedDeviceDays * 24 * 60 * 60 * 1000);
      const existing = await TrustedDevice.findOne({
        user: user._id,
        deviceId: device.deviceId,
        fingerprint: device.fingerprint
      });

      if (existing) {
        existing.lastUsedAt = new Date();
        existing.trustedAt = new Date();
        existing.expiresAt = trustExpiresAt;
        existing.lastIp = geo.ip;
        existing.lastCity = geo.city;
        existing.lastState = geo.state;
        existing.lastCountry = geo.country;
        existing.lastLocationLabel = geo.locationLabel;
        existing.name = device.name;
        existing.browserName = device.browserName;
        existing.browserVersion = device.browserVersion;
        existing.osName = device.osName;
        existing.osVersion = device.osVersion;
        existing.deviceType = device.deviceType;
        existing.deviceModel = device.deviceModel;
        existing.userAgent = device.userAgent;
        await existing.save();
      } else {
        await TrustedDevice.create({
          user: user._id,
          deviceId: device.deviceId,
          fingerprint: device.fingerprint,
          name: device.name,
          browserName: device.browserName,
          browserVersion: device.browserVersion,
          osName: device.osName,
          osVersion: device.osVersion,
          deviceType: device.deviceType,
          deviceModel: device.deviceModel,
          userAgent: device.userAgent,
          lastIp: geo.ip,
          lastCity: geo.city,
          lastState: geo.state,
          lastCountry: geo.country,
          lastLocationLabel: geo.locationLabel,
          trustedAt: new Date(),
          lastUsedAt: new Date(),
          expiresAt: trustExpiresAt
        });
        await recordEvent({
          user: user._id,
          type: 'trusted_device_added',
          message: `Device marked as trusted for ${env.trustedDeviceDays} days`,
          ...eventContext(geo, device),
          metadata: { trustedUntil: trustExpiresAt }
        });
      }
      trustedUntil = trustExpiresAt;
    }

    await recordEvent({
      user: user._id,
      type: 'otp_verified',
      message: 'OTP verification successful',
      ...eventContext(geo, device),
      metadata: { loginRecord: String(record._id), trusted: rememberDevice }
    });
    await recordEvent({
      user: user._id,
      type: 'login_success',
      message: rememberDevice ? 'Sign-in verified and device trusted' : 'Sign-in verified',
      ...eventContext(geo, device),
      metadata: { loginRecord: String(record._id), trusted: rememberDevice }
    });

    return res.json({
      requiresOtp: false,
      token,
      user: safeUser(user),
      sessionId: session.sessionId,
      sessionExpiresAt: expiresAt,
      themeInfo: themeInfo(user),
      login: loginMeta(record, []),
      trustedDevice: rememberDevice ? { expiresAt: trustedUntil, days: env.trustedDeviceDays } : null
    });
  })
);

router.post(
  '/resend-otp',
  otpResendLimiter,
  asyncHandler(async (req, res) => {
    const { challengeId } = req.body || {};
    const requestedChannel = req.body?.channel;

    if (!mongoose.isValidObjectId(challengeId)) {
      return res.status(400).json({ message: 'Invalid verification request.' });
    }

    const challenge = await OtpChallenge.findById(challengeId);
    if (!challenge) {
      return res.status(404).json({ message: 'Verification request not found. Please sign in again.' });
    }
    if (challenge.status !== 'pending' || challenge.usedAt) {
      return res.status(409).json({ message: 'This verification request is no longer active.' });
    }
    if (challenge.expiresAt.getTime() < Date.now()) {
      challenge.status = 'expired';
      await challenge.save();
      return res.status(410).json({ message: 'This request expired. Please sign in again.' });
    }

    const user = await User.findById(challenge.user);
    const record = await LoginRecord.findById(challenge.loginRecord);
    if (!user || !record) {
      return res.status(404).json({ message: 'Verification request is no longer valid.' });
    }

    const elapsed = (Date.now() - new Date(challenge.lastSentAt).getTime()) / 1000;
    if (elapsed < env.otpResendSeconds) {
      return res.status(429).json({
        message: `Please wait ${Math.ceil(env.otpResendSeconds - elapsed)}s before requesting another code.`,
        retryAfter: Math.ceil(env.otpResendSeconds - elapsed)
      });
    }

    const channel = requestedChannel === 'mobile' ? 'mobile' : 'email';
    if (channel === 'mobile' && !user.mobile) {
      return res.status(400).json({ message: 'No registered mobile number is available.' });
    }

    const otp = generateOtp();
    const destination = channel === 'mobile' ? user.mobile : user.email;

    challenge.otpHash = hashOtp(otp);
    challenge.expiresAt = otpExpiry();
    challenge.lastSentAt = new Date();
    challenge.channel = channel;
    challenge.destination = destination;
    await challenge.save();

    const device = buildDeviceInfo(req, req.body?.deviceMeta || {});
    const { ip, isPrivate } = await extractRequestIp(req);
    const geo = { ...(await lookupGeo(ip)), ip, isPrivate };

    const delivery = await deliverOtp({
      user,
      destination,
      channel,
      otp,
      context: {
        ip: geo.ip,
        locationLabel: geo.locationLabel,
        browserName: device.browserName,
        deviceType: device.deviceType
      }
    });

    await recordEvent({
      user: user._id,
      type: 'otp_sent',
      message: `Verification code resent to registered ${channel} (${delivery.provider})`,
      ...eventContext(geo, device),
      metadata: { loginRecord: String(record._id), channel }
    });

    return res.json(
      challengeResponse({
        challenge,
        user,
        delivery,
        plainOtp: otp,
        record,
        reasons: record.newDeviceReasons
      })
    );
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('+password');
    return res.json({
      user: safeUser(user),
      themeInfo: themeInfo(user),
      sessionId: req.session?.sessionId
    });
  })
);

router.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.session) {
      req.session.revokedAt = new Date();
      req.session.revokedReason = 'user_logout';
      await req.session.save();
      await recordEvent({
        user: req.user._id,
        type: 'logout',
        message: 'Signed out from a device',
        ip: req.session.ip,
        city: req.session.city,
        state: req.session.state,
        country: req.session.country,
        browserName: req.session.browserName,
        deviceType: req.session.deviceType,
        metadata: { sessionId: req.session.sessionId }
      });
    }
    return res.json({ message: 'Signed out successfully.' });
  })
);

export default router;
