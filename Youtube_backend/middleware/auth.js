import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { Session } from '../models/Session.js';
import { env } from '../config/env.js';

function getToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7).trim();
}

async function resolveUser(req) {
  const token = getToken(req);
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.sub).select('+password');
    if (!user) return null;

    if (payload.sid) {
      const session = await Session.findOne({
        sessionId: payload.sid,
        user: user._id,
        revokedAt: null,
        expiresAt: { $gt: new Date() }
      });
      if (!session) return null;
      req.session = session;
      if (Date.now() - new Date(session.lastActiveAt).getTime() > 2 * 60 * 1000) {
        session.lastActiveAt = new Date();
        await session.save();
      }
    }

    return user;
  } catch {
    return null;
  }
}

export async function optionalAuth(req, _res, next) {
  req.user = await resolveUser(req);
  next();
}

export async function authRequired(req, res, next) {
  const user = await resolveUser(req);
  if (!user) {
    return res.status(401).json({ message: 'Please sign in to continue.', code: 'UNAUTHORIZED' });
  }
  req.user = user;
  return next();
}

export const requireAuth = authRequired;
export const requireAdmin = adminRequired;

export async function adminRequired(req, res, next) {
  const user = await resolveUser(req);
  if (!user) {
    return res.status(401).json({ message: 'Please sign in to continue.', code: 'UNAUTHORIZED' });
  }
  if (user.role !== 'admin') {
    return res.status(403).json({ message: 'Administrator access is required.', code: 'FORBIDDEN' });
  }
  req.user = user;
  return next();
}
