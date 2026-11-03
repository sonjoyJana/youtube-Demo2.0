import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { getPlan } from '../config/plans.js';
import { Download } from '../models/Download.js';

const DOWNLOAD_TOKEN_TTL = '5m';

function dateKeys(now = new Date()) {
  const iso = now.toISOString();
  return {
    dayKey: iso.slice(0, 10),
    monthKey: iso.slice(0, 7)
  };
}

function resetTimes(now = new Date()) {
  const nextDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return {
    daily: nextDay.toISOString(),
    monthly: nextMonth.toISOString()
  };
}

function consumedUsage(usage) {
  const dailyRemaining = Math.max(0, usage.daily.remaining - 1);
  const monthlyRemaining = Math.max(0, usage.monthly.remaining - 1);
  return {
    ...usage,
    daily: { ...usage.daily, used: usage.daily.used + 1, remaining: dailyRemaining },
    monthly: { ...usage.monthly, used: usage.monthly.used + 1, remaining: monthlyRemaining },
    remaining: Math.min(dailyRemaining, monthlyRemaining),
    allowed: dailyRemaining > 0 && monthlyRemaining > 0
  };
}

export function effectivePlanId(user) {
  if (!user) return 'free';
  return typeof user.effectivePlan === 'function' ? user.effectivePlan() : user.plan || 'free';
}

export async function getDownloadUsage(user, planId = effectivePlanId(user)) {
  if (!user?._id) throw new Error('A user is required to calculate download usage.');

  const plan = getPlan(planId);
  const { dayKey, monthKey } = dateKeys();
  const [dailyUsed, monthlyUsed] = await Promise.all([
    Download.countDocuments({ user: user._id, dayKey }),
    Download.countDocuments({ user: user._id, monthKey })
  ]);

  const dailyRemaining = Math.max(0, plan.downloads.daily - dailyUsed);
  const monthlyRemaining = Math.max(0, plan.downloads.monthly - monthlyUsed);

  return {
    planId: plan.id,
    daily: {
      limit: plan.downloads.daily,
      used: dailyUsed,
      remaining: dailyRemaining
    },
    monthly: {
      limit: plan.downloads.monthly,
      used: monthlyUsed,
      remaining: monthlyRemaining
    },
    remaining: Math.min(dailyRemaining, monthlyRemaining),
    allowed: dailyRemaining > 0 && monthlyRemaining > 0,
    resetsAt: resetTimes()
  };
}

export async function reserveDownload(user, video, planId = effectivePlanId(user)) {
  const usage = await getDownloadUsage(user, planId);
  if (!usage.allowed) {
    return { allowed: false, usage };
  }

  const tokenId = crypto.randomUUID();
  const { dayKey, monthKey } = dateKeys();
  await Download.create({
    user: user._id,
    video: video._id,
    videoId: video.videoId,
    sourceType: video.sourceType || 'local',
    dayKey,
    monthKey,
    tokenId
  });

  const token = jwt.sign(
    {
      typ: 'download',
      sub: String(user._id),
      vid: video.videoId,
      jti: tokenId
    },
    env.jwtSecret,
    { expiresIn: DOWNLOAD_TOKEN_TTL }
  );

  return {
    allowed: true,
    token,
    usage: consumedUsage(usage)
  };
}

export async function consumeDownloadToken(token, expectedVideoId) {
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    return {
      ok: false,
      status: 401,
      code: 'DOWNLOAD_TOKEN_INVALID',
      message: 'This download link is invalid or has expired.'
    };
  }

  if (payload?.typ !== 'download' || !payload.sub || !payload.vid || !payload.jti) {
    return {
      ok: false,
      status: 401,
      code: 'DOWNLOAD_TOKEN_INVALID',
      message: 'This download link is invalid or has expired.'
    };
  }

  const record = await Download.findOne({
    tokenId: payload.jti,
    user: payload.sub,
    videoId: payload.vid
  });

  if (!record || (expectedVideoId && record.videoId !== expectedVideoId)) {
    return {
      ok: false,
      status: 401,
      code: 'DOWNLOAD_TOKEN_INVALID',
      message: 'This download link is invalid or has expired.'
    };
  }

  if (record.consumedAt) {
    return {
      ok: false,
      status: 409,
      code: 'DOWNLOAD_TOKEN_USED',
      message: 'This download link has already been used. Start a new download.'
    };
  }

  record.consumedAt = new Date();
  await record.save();
  return { ok: true, record };
}
