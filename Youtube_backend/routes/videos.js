import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { Video } from '../models/Video.js';
import { getPlan, planCanAccess } from '../config/plans.js';
import { adminRequired, optionalAuth, requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { escapeRegex } from '../utils/validate.js';
import {
  cloudinaryPosterUrl,
  cloudinaryVideoUrl,
  isCloudinaryConfigured
} from '../services/cloudinary.js';
import {
  consumeDownloadToken,
  effectivePlanId,
  getDownloadUsage,
  reserveDownload
} from '../services/downloads.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
const MEDIA_DIRS = [
  path.join(projectRoot, 'client', 'dist', 'videos'),
  path.join(projectRoot, 'client', 'public', 'videos')
];

function safeMediaFilename(title, fallback = 'video') {
  const value = String(title || '')
    .normalize('NFKD')
    .replace(/[^\w\s.-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
  return value || fallback;
}

function localMediaPath(streamUrl) {
  try {
    const url = new URL(streamUrl, 'http://local');
    if (url.origin !== 'http://local') return null;
    const filename = path.basename(decodeURIComponent(url.pathname));
    if (!filename || filename !== path.basename(filename)) return null;
    for (const dir of MEDIA_DIRS) {
      const candidate = path.join(dir, filename);
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch {
    // Fall through to remote proxy handling.
  }
  return null;
}

function isSafeRemoteMediaUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host === '0.0.0.0' || host === '[::1]') return false;
    if (/^127\./.test(host)) return false;
    if (/^10\./.test(host)) return false;
    if (/^192\.168\./.test(host)) return false;
    if (/^169\.254\./.test(host)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

async function sendMedia(req, res, video, { download = false, skipPlanCheck = false } = {}) {
  const planId = effectivePlanId(req.user);
  if (!skipPlanCheck && !planCanAccess(planId, video.minPlan)) {
    return res.status(403).json({
      message: 'Your current plan does not include this video.',
      code: 'PLAN_REQUIRED'
    });
  }
  if (video.sourceType === 'youtube') {
    return res.status(400).json({
      message: 'YouTube videos must use the official YouTube player.',
      code: 'YOUTUBE_EMBED_ONLY'
    });
  }
  if (!video.streamUrl) {
    return res.status(404).json({ message: 'This video has no playable source.', code: 'NO_STREAM' });
  }

  const filename = `${safeMediaFilename(video.title)}.mp4`;
  const localPath = localMediaPath(video.streamUrl);
  if (localPath) {
    res.type('video/mp4');
    if (download) {
      return res.download(localPath, filename);
    }
    return res.sendFile(localPath, { acceptRanges: true, cacheControl: true, maxAge: '1h' });
  }

  if (!isSafeRemoteMediaUrl(video.streamUrl)) {
    return res.status(400).json({ message: 'Invalid video source.', code: 'INVALID_STREAM' });
  }

  const headers = {};
  if (!download && req.headers.range) headers.Range = req.headers.range;
  const upstream = await fetch(video.streamUrl, { headers, redirect: 'follow' });
  if (!upstream.ok && upstream.status !== 206) {
    return res.status(502).json({ message: 'Unable to load the video source.', code: 'STREAM_UNAVAILABLE' });
  }

  res.status(upstream.status);
  for (const header of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']) {
    const value = upstream.headers.get(header);
    if (value) res.setHeader(header, value);
  }
  if (!res.getHeader('content-type')) res.type('video/mp4');
  if (!res.getHeader('accept-ranges')) res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  if (download) {
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  }
  if (!upstream.body) return res.end();

  const stream = Readable.fromWeb(upstream.body);
  stream.on('error', () => res.destroy());
  req.on('close', () => stream.destroy());
  return stream.pipe(res);
}

function buildVideoResponse(video, user, { downloadUsage = null } = {}) {
  const planId = effectivePlanId(user);
  const canAccess = planCanAccess(planId, video.minPlan);
  const thumbnail = video.thumbnail || video.thumbnailUrl || '';
  const mediaBase = `/api/videos/${encodeURIComponent(video.videoId)}`;
  const sourceType = video.sourceType || (video.youtubeId ? 'youtube' : 'local');
  const isYouTube = sourceType === 'youtube';
  const hasPlayableSource = !isYouTube && Boolean(video.streamUrl);
  const canPlay = canAccess && hasPlayableSource;
  const canDownload = canPlay && Boolean(user) && (!downloadUsage || downloadUsage.allowed);
  const directCloudinaryUrl = sourceType === 'cloudinary' && /^https?:\/\//i.test(video.streamUrl);
  const download = {
    requiresAuth: !user,
    allowed: canDownload,
    ...(downloadUsage
      ? {
          planId: downloadUsage.planId,
          daily: downloadUsage.daily,
          monthly: downloadUsage.monthly,
          remaining: downloadUsage.remaining,
          resetsAt: downloadUsage.resetsAt
        }
      : {})
  };

  return {
    id: video.videoId,
    videoId: video.videoId,
    title: video.title,
    description: video.description,
    channel: video.channel,
    channelId: video.channelId || '',
    category: video.category,
    minPlan: video.minPlan,
    minPlanName: getPlan(video.minPlan).name,
    views: video.views,
    likes: video.likes,
    dislikes: video.dislikes,
    durationSeconds: video.durationSeconds,
    thumbnail,
    thumbnailUrl: thumbnail,
    poster: thumbnail,
    sourceType,
    youtubeId: video.youtubeId || '',
    cloudinaryPublicId: video.cloudinaryPublicId || '',
    streamUrl: canPlay ? (directCloudinaryUrl ? video.streamUrl : `${mediaBase}/stream`) : '',
    downloadUrl: canDownload ? `${mediaBase}/download` : '',
    canDownload,
    download,
    tags: video.tags || [],
    publishedAt: video.publishedAt,
    canAccess,
    locked: !canAccess,
    playback: {
      maxQuality: getPlan(planId).features.maxStreamQuality
    }
  };
}

router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const search = String(req.query.search || req.query.q || '').trim().slice(0, 80);
    const category = String(req.query.category || '').trim();
    const sort = String(req.query.sort || 'newest');
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 12));

    const filter = {};
    if (category) filter.category = category;
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ title: regex }, { channel: regex }, { tags: regex }];
    }

    const sortMap = {
      newest: { publishedAt: -1 },
      oldest: { publishedAt: 1 },
      popular: { views: -1 },
      liked: { likes: -1 }
    };
    const sortStage = sortMap[sort] || sortMap.newest;

    const [items, total] = await Promise.all([
      Video.find(filter).sort(sortStage).skip((page - 1) * limit).limit(limit).lean(),
      Video.countDocuments(filter)
    ]);

    const user = req.user;
    const videos = items.map((video) => buildVideoResponse(video, user));

    return res.json({
      videos,
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit))
    });
  })
);

router.get(
  '/search',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const search = String(req.query.q || req.query.search || '').trim().slice(0, 80);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));

    const filter = {};
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ title: regex }, { channel: regex }, { tags: regex }];
    }

    const items = await Video.find(filter).sort({ views: -1 }).limit(limit).lean();
    const videos = items.map((video) => buildVideoResponse(video, req.user));
    return res.json({ videos, query: search, total: videos.length });
  })
);

router.post(
  '/cloudinary',
  adminRequired,
  asyncHandler(async (req, res) => {
    if (!isCloudinaryConfigured()) {
      return res.status(503).json({
        message: 'Cloudinary is not configured on this server.',
        code: 'CLOUDINARY_NOT_CONFIGURED'
      });
    }

    const videoId = String(req.body.videoId || '').trim();
    const title = String(req.body.title || '').trim();
    const publicId = String(req.body.publicId || '').trim();
    if (!videoId || !title || !publicId) {
      return res.status(400).json({
        message: 'videoId, title and publicId are required.',
        code: 'VALIDATION_ERROR'
      });
    }

    const streamUrl = cloudinaryVideoUrl(publicId);
    if (!streamUrl) {
      return res.status(500).json({
        message: 'Unable to build a Cloudinary video URL.',
        code: 'CLOUDINARY_URL_FAILED'
      });
    }

    const channel = String(req.body.channel || 'Cloudinary').trim() || 'Cloudinary';
    const payload = {
      videoId,
      title,
      description: String(req.body.description || '').slice(0, 5000),
      channel,
      channelId: channel.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      category: String(req.body.category || 'Film').trim() || 'Film',
      minPlan: ['free', 'bronze', 'silver', 'gold'].includes(req.body.minPlan)
        ? req.body.minPlan
        : 'free',
      views: Math.max(0, Number(req.body.views) || 0),
      likes: Math.max(0, Number(req.body.likes) || 0),
      durationSeconds: Math.max(0, Number(req.body.durationSeconds) || 0),
      thumbnail: String(req.body.thumbnail || cloudinaryPosterUrl(publicId) || '').trim(),
      sourceType: 'cloudinary',
      cloudinaryPublicId: publicId,
      youtubeId: '',
      streamUrl,
      tags: Array.isArray(req.body.tags) ? req.body.tags.map(String).slice(0, 20) : [],
      publishedAt: req.body.publishedAt ? new Date(req.body.publishedAt) : new Date()
    };

    const video = await Video.findOneAndUpdate(
      { videoId },
      { $set: payload },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    return res.status(201).json({ video: buildVideoResponse(video, req.user) });
  })
);

router.get(
  '/:videoId/stream',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const video = await Video.findOne({ videoId: req.params.videoId }).lean();
    if (!video) {
      return res.status(404).json({ message: 'Video not found.', code: 'NOT_FOUND' });
    }
    return sendMedia(req, res, video, { download: false });
  })
);

router.post(
  '/:videoId/download',
  requireAuth,
  asyncHandler(async (req, res) => {
    const video = await Video.findOne({ videoId: req.params.videoId }).lean();
    if (!video) {
      return res.status(404).json({ message: 'Video not found.', code: 'NOT_FOUND' });
    }

    const planId = effectivePlanId(req.user);
    if (!planCanAccess(planId, video.minPlan)) {
      return res.status(403).json({
        message: 'Your current plan does not include this video.',
        code: 'PLAN_REQUIRED'
      });
    }
    if (video.sourceType === 'youtube') {
      return res.status(400).json({
        message: 'YouTube videos must use the official YouTube player.',
        code: 'YOUTUBE_EMBED_ONLY'
      });
    }
    if (!video.streamUrl) {
      return res.status(404).json({ message: 'This video has no playable source.', code: 'NO_STREAM' });
    }

    const reservation = await reserveDownload(req.user, video, planId);
    if (!reservation.allowed) {
      const message =
        reservation.usage.daily.remaining <= 0
          ? `Daily download limit reached (${reservation.usage.daily.limit}). Try again tomorrow or upgrade your plan.`
          : `Monthly download limit reached (${reservation.usage.monthly.limit}). Upgrade your plan for more downloads.`;
      return res.status(429).json({
        message,
        code: 'DOWNLOAD_LIMIT_REACHED',
        download: reservation.usage
      });
    }

    return res.json({
      downloadToken: reservation.token,
      download: reservation.usage
    });
  })
);

router.get(
  '/:videoId/download',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const token = String(req.query.token || '').trim();
    if (!token) {
      return res.status(401).json({
        message: 'Start the download from the video page.',
        code: 'DOWNLOAD_TOKEN_REQUIRED'
      });
    }

    const consumed = await consumeDownloadToken(token, req.params.videoId);
    if (!consumed.ok) {
      return res.status(consumed.status).json({ message: consumed.message, code: consumed.code });
    }

    const video = await Video.findOne({ videoId: req.params.videoId }).lean();
    if (!video) {
      return res.status(404).json({ message: 'Video not found.', code: 'NOT_FOUND' });
    }
    return sendMedia(req, res, video, { download: true, skipPlanCheck: true });
  })
);

router.get(
  '/:videoId',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const video = await Video.findOne({ videoId: req.params.videoId }).lean();
    if (!video) {
      return res.status(404).json({ message: 'Video not found.', code: 'NOT_FOUND' });
    }
    const downloadUsage = req.user ? await getDownloadUsage(req.user) : null;
    const response = buildVideoResponse(video, req.user, { downloadUsage });
    return res.json({ video: response });
  })
);

export default router;
