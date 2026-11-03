import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { safeUser } from '../utils/serialize.js';
import { themeForLoginTime, themeInfo } from '../utils/ist.js';
import { normalizeMobile, MOBILE_RE } from '../utils/validate.js';
import { recordEvent } from '../services/events.js';

const router = Router();

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: safeUser(req.user), themeInfo: themeInfo(req.user) });
  })
);

router.patch(
  '/theme',
  requireAuth,
  asyncHandler(async (req, res) => {
    const preference = String(req.body?.preference || req.body?.theme || '').toLowerCase();
    if (!['auto', 'light', 'dark'].includes(preference)) {
      return res.status(400).json({ message: 'Theme preference must be auto, light, or dark.' });
    }

    req.user.themePreference = preference;
    req.user.theme = preference === 'auto' ? themeForLoginTime(new Date()) : preference;
    await req.user.save();

    recordEvent({
      user: req.user._id,
      type: 'theme_changed',
      message:
        preference === 'auto'
          ? `Theme set to automatic (currently ${req.user.theme})`
          : `Theme changed to ${preference}`,
      ip: req.session.ip,
      city: req.session.city,
      state: req.session.state,
      country: req.session.country,
      browserName: req.session.browserName,
      deviceType: req.session.deviceType,
      metadata: { preference, theme: req.user.theme }
    });

    res.json({
      message: preference === 'auto' ? 'Automatic theme enabled.' : `Theme changed to ${preference}.`,
      user: safeUser(req.user),
      themeInfo: themeInfo(req.user)
    });
  })
);

router.patch(
  '/details',
  requireAuth,
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name ?? req.user.name).trim();
    const mobile =
      req.body?.mobile === undefined ? req.user.mobile : normalizeMobile(req.body.mobile);

    if (name.length < 2 || name.length > 80) {
      return res.status(400).json({ message: 'Name must be 2–80 characters long.' });
    }
    if (mobile && !MOBILE_RE.test(mobile)) {
      return res.status(400).json({ message: 'Enter a valid 10-digit Indian mobile number.' });
    }

    req.user.name = name;
    req.user.mobile = mobile;
    await req.user.save();

    recordEvent({
      user: req.user._id,
      type: 'profile_updated',
      message: 'Profile details updated',
      ip: req.session.ip,
      city: req.session.city,
      state: req.session.state,
      country: req.session.country,
      browserName: req.session.browserName,
      deviceType: req.session.deviceType
    });

    res.json({ message: 'Profile updated.', user: safeUser(req.user) });
  })
);

export default router;
