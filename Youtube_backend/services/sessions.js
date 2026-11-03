import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { Session } from '../models/Session.js';

export async function createSession({ user, device, geo }) {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + env.jwtExpiresDays * 24 * 60 * 60 * 1000);

  const session = await Session.create({
    user: user._id,
    sessionId,
    deviceId: device.deviceId,
    fingerprint: device.fingerprint,
    browserName: device.browserName,
    browserVersion: device.browserVersion,
    osName: device.osName,
    osVersion: device.osVersion,
    deviceType: device.deviceType,
    deviceModel: device.deviceModel,
    userAgent: device.userAgent,
    ip: geo?.ip || '',
    city: geo?.city || '',
    state: geo?.state || '',
    country: geo?.country || '',
    locationLabel: geo?.locationLabel || '',
    lastActiveAt: new Date(),
    expiresAt
  });

  const token = jwt.sign({ sub: String(user._id), sid: sessionId, role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn
  });

  return { token, session, expiresAt };
}

export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}
