import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from './config/db.js';
import { User } from './models/User.js';
import { Video } from './models/Video.js';
import { Comment } from './models/Comment.js';
import { Report } from './models/Report.js';
import { CommentHistory } from './models/CommentHistory.js';
import { ModerationLog } from './models/ModerationLog.js';
import { Notification } from './models/Notification.js';
import { Translation } from './models/Translation.js';
import { Download } from './models/Download.js';
import {
  cloudinaryPosterUrl,
  cloudinaryVideoUrl,
  isCloudinaryConfigured
} from './services/cloudinary.js';
import { VIDEOS } from '../client/src/lib/videos.js';

const VIDEO_ID = 'sample-5s';
const now = Date.now();
const ago = (minutes) => new Date(now - minutes * 60 * 1000);

function avatar(index) {
  return `https://i.pravatar.cc/160?img=${index}`;
}

function parseViewCount(value) {
  if (typeof value === 'number') return value;
  const match = String(value || '').match(/^([\d.]+)\s*([KMB])?/i);
  if (!match) return 0;
  const amount = Number(match[1]) || 0;
  const suffix = String(match[2] || '').toUpperCase();
  const multiplier = suffix === 'B' ? 1e9 : suffix === 'M' ? 1e6 : suffix === 'K' ? 1e3 : 1;
  return Math.round(amount * multiplier);
}

async function seed() {
  await connectDatabase();
  console.log('Connected. Clearing existing demo data...');

  await Promise.all([
    User.deleteMany({}),
    Video.deleteMany({}),
    Comment.deleteMany({}),
    Report.deleteMany({}),
    CommentHistory.deleteMany({}),
    ModerationLog.deleteMany({}),
    Notification.deleteMany({}),
    Translation.deleteMany({}),
    Download.deleteMany({})
  ]);

  const videos = VIDEOS.map((video) => {
    const sourceType =
      video.sourceType ||
      (video.youtubeId ? 'youtube' : video.cloudinaryPublicId ? 'cloudinary' : 'local');
    let streamUrl = video.streamUrl || '';
    let thumbnail = video.poster || video.thumbnail || '';

    if (sourceType === 'youtube') {
      if (!video.youtubeId) {
        throw new Error(`YouTube video "${video.id}" is missing a youtubeId.`);
      }
      streamUrl = '';
    }

    if (sourceType === 'cloudinary') {
      if (!video.cloudinaryPublicId) {
        throw new Error(`Cloudinary video "${video.id}" is missing a cloudinaryPublicId.`);
      }
      if (isCloudinaryConfigured()) {
        streamUrl = cloudinaryVideoUrl(video.cloudinaryPublicId);
        thumbnail = thumbnail || cloudinaryPosterUrl(video.cloudinaryPublicId);
      } else if (!streamUrl) {
        throw new Error(
          `Cloudinary video "${video.id}" requires CLOUDINARY_CLOUD_NAME in server/.env or an explicit streamUrl.`
        );
      }
    }

    return {
      videoId: video.id,
      title: video.title,
      description: video.description,
      channel: video.channel,
      channelId: String(video.channel || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      category: video.category || 'Film',
      minPlan: 'free',
      views: parseViewCount(video.views),
      likes: video.likes || 0,
      dislikes: Math.round((video.likes || 0) * 0.08),
      durationSeconds: video.durationSeconds || 0,
      thumbnail,
      sourceType,
      youtubeId: video.youtubeId || '',
      cloudinaryPublicId: video.cloudinaryPublicId || '',
      streamUrl,
      publishedAt: new Date(video.published),
      tags: video.tags || []
    };
  });

  const videoDocs = await Video.insertMany(videos);

  const users = await User.create([
    {
      name: 'Alex Morgan',
      username: 'alex',
      email: 'alex@example.com',
      password: 'password123',
      location: 'New York, USA',
      preferredLanguage: 'en',
      avatar: avatar(12),
      plan: 'free'
    },
    {
      name: 'Priya Sharma',
      username: 'priya',
      email: 'priya@example.com',
      password: 'password123',
      location: 'Mumbai, India',
      preferredLanguage: 'hi',
      avatar: avatar(47),
      plan: 'free'
    },
    {
      name: 'Lucas Silva',
      username: 'lucas',
      email: 'lucas@example.com',
      password: 'password123',
      location: 'São Paulo, Brazil',
      preferredLanguage: 'pt',
      avatar: avatar(33),
      plan: 'free'
    },
    {
      name: 'Sofia García',
      username: 'sofia',
      email: 'sofia@example.com',
      password: 'password123',
      location: 'Madrid, Spain',
      preferredLanguage: 'es',
      avatar: avatar(5),
      plan: 'free'
    },
    {
      name: 'Kenji Tanaka',
      username: 'kenji',
      email: 'kenji@example.com',
      password: 'password123',
      location: 'Tokyo, Japan',
      preferredLanguage: 'ja',
      avatar: avatar(15),
      plan: 'free'
    },
    {
      name: 'Amina Al-Farsi',
      username: 'amina',
      email: 'amina@example.com',
      password: 'password123',
      location: 'Dubai, UAE',
      preferredLanguage: 'ar',
      avatar: avatar(44),
      plan: 'free'
    },
    {
      name: 'Emma Wilson',
      username: 'emma',
      email: 'emma@example.com',
      password: 'password123',
      location: 'London, UK',
      preferredLanguage: 'en',
      avatar: avatar(9),
      plan: 'free'
    },
    {
      name: 'Trust & Safety',
      username: 'moderator',
      email: 'admin@example.com',
      password: 'admin1234',
      location: 'Trust & Safety',
      preferredLanguage: 'en',
      avatar: avatar(25),
      role: 'admin',
      plan: 'gold'
    }
  ]);

  const userByUsername = Object.fromEntries(users.map((user) => [user.username, user]));
  const priya = userByUsername.priya;
  const sofia = userByUsername.sofia;
  const lucas = userByUsername.lucas;
  const alex = userByUsername.alex;
  const emma = userByUsername.emma;
  const kenji = userByUsername.kenji;
  const amina = userByUsername.amina;
  const admin = userByUsername.moderator;

  const comment = (data) => ({
    videoId: VIDEO_ID,
    likes: [],
    dislikes: [],
    edited: false,
    editCount: 0,
    version: 0,
    deleted: false,
    removed: false,
    status: 'visible',
    flagged: false,
    reportCount: 0,
    mentions: [],
    createdAt: ago(180),
    updatedAt: ago(180),
    ...data
  });

  const priyaCommentId = new mongoose.Types.ObjectId();
  const deletedParentId = new mongoose.Types.ObjectId();
  const spamCommentId = new mongoose.Types.ObjectId();
  const removedCommentId = new mongoose.Types.ObjectId();
  const alexCommentId = new mongoose.Types.ObjectId();
  const sofiaCommentId = new mongoose.Types.ObjectId();
  const lucasCommentId = new mongoose.Types.ObjectId();
  const mentionCommentId = new mongoose.Types.ObjectId();

  const comments = [
    comment({
      _id: priyaCommentId,
      author: priya._id,
      content: 'यह वीडियो बहुत शानदार है! व्याख्या बहुत सरल और स्पष्ट थी। धन्यवाद!',
      language: 'hi',
      likes: [alex._id, sofia._id, lucas._id, emma._id, kenji._id],
      dislikes: [],
      edited: true,
      editedAt: ago(2400),
      editCount: 1,
      version: 1,
      createdAt: ago(2880),
      updatedAt: ago(2400)
    }),
    comment({
      _id: sofiaCommentId,
      author: sofia._id,
      content: '¡Me encanta este canal! La explicación fue muy clara y fácil de seguir. ¿Harás una segunda parte?',
      language: 'es',
      likes: [priya._id, alex._id, lucas._id, amina._id],
      createdAt: ago(1440),
      updatedAt: ago(1440)
    }),
    comment({
      _id: lucasCommentId,
      author: lucas._id,
      content: 'Excelente vídeo! Aprendi muito com os exemplos práticos. Obrigado!',
      language: 'pt',
      likes: [alex._id, sofia._id, kenji._id],
      dislikes: [emma._id],
      createdAt: ago(360),
      updatedAt: ago(360)
    }),
    comment({
      _id: alexCommentId,
      author: alex._id,
      content: 'The part about edge cases was especially useful. Could you make a follow-up about rate limiting?',
      language: 'en',
      likes: [priya._id, lucas._id, amina._id, kenji._id, emma._id],
      createdAt: ago(180),
      updatedAt: ago(180)
    }),
    comment({
      _id: mentionCommentId,
      author: alex._id,
      content: 'Great breakdown @priya and @sofia, your examples really helped me understand the topic!',
      language: 'en',
      likes: [priya._id, sofia._id],
      mentions: [priya._id, sofia._id],
      createdAt: ago(90),
      updatedAt: ago(90)
    }),
    comment({
      author: kenji._id,
      content: 'とても分かりやすい説明でした。次の動画も楽しみにしています！',
      language: 'ja',
      likes: [sofia._id, priya._id],
      createdAt: ago(120),
      updatedAt: ago(120)
    }),
    comment({
      author: amina._id,
      content: 'شرح رائع، شكراً لك على هذا المحتوى المفيد.',
      language: 'ar',
      likes: [alex._id, lucas._id],
      createdAt: ago(60),
      updatedAt: ago(60)
    }),
    comment({
      _id: deletedParentId,
      author: alex._id,
      content: '',
      language: 'en',
      deleted: true,
      status: 'deleted',
      deletedAt: ago(150),
      deletedBy: alex._id,
      version: 1,
      createdAt: ago(300),
      updatedAt: ago(150)
    }),
    comment({
      _id: spamCommentId,
      author: emma._id,
      content: 'FREE crypto giveaway!!! Visit bit.ly/claim-now before it ends. Guaranteed profit for everyone!',
      language: 'en',
      flagged: true,
      status: 'flagged',
      reportCount: 1,
      lastReportedAt: ago(35),
      createdAt: ago(50),
      updatedAt: ago(35)
    }),
    comment({
      _id: removedCommentId,
      author: kenji._id,
      content: '',
      language: 'en',
      removed: true,
      status: 'removed',
      removedAt: ago(500),
      removedBy: admin._id,
      version: 1,
      flagged: false,
      reportCount: 1,
      createdAt: ago(600),
      updatedAt: ago(500)
    }),
    comment({
      author: priya._id,
      parent: priyaCommentId,
      content: 'I agree! The visuals made it easy to understand.',
      language: 'en',
      likes: [priya._id, lucas._id],
      createdAt: ago(2700),
      updatedAt: ago(2700)
    }),
    comment({
      author: sofia._id,
      parent: priyaCommentId,
      content: 'Sí, muy bien explicado. Gracias por compartir.',
      language: 'es',
      likes: [priya._id],
      createdAt: ago(1200),
      updatedAt: ago(1200)
    }),
    comment({
      author: lucas._id,
      parent: deletedParentId,
      content: 'I still find the replies useful even though the original comment is gone.',
      language: 'en',
      likes: [alex._id, priya._id],
      createdAt: ago(140),
      updatedAt: ago(140)
    }),
    comment({
      author: priya._id,
      parent: deletedParentId,
      content: 'Good point, the thread still makes sense.',
      language: 'en',
      likes: [alex._id],
      createdAt: ago(130),
      updatedAt: ago(130)
    }),
    comment({
      author: priya._id,
      parent: alexCommentId,
      content: '@alex Yes, a follow-up on rate limiting would be great.',
      language: 'en',
      mentions: [alex._id],
      likes: [alex._id, lucas._id],
      createdAt: ago(100),
      updatedAt: ago(100)
    })
  ];

  await Comment.insertMany(comments, { timestamps: false });

  const pendingReportId = new mongoose.Types.ObjectId();
  const dismissedReportId = new mongoose.Types.ObjectId();
  const removedReportId = new mongoose.Types.ObjectId();

  await Report.insertMany(
    [
      {
        _id: pendingReportId,
        comment: spamCommentId,
        reporter: alex._id,
        reason: 'spam',
        details: 'This is a crypto scam link and should be removed.',
        status: 'pending',
        snapshot: {
          content: 'FREE crypto giveaway!!! Visit bit.ly/claim-now before it ends. Guaranteed profit for everyone!',
          language: 'en',
          authorUsername: 'emma',
          commentCreatedAt: ago(50),
          videoId: VIDEO_ID
        },
        createdAt: ago(35),
        updatedAt: ago(35)
      },
      {
        _id: dismissedReportId,
        comment: lucasCommentId,
        reporter: amina._id,
        reason: 'offensive',
        details: 'Reported by mistake.',
        status: 'dismissed',
        snapshot: {
          content: 'Excelente vídeo! Aprendi muito com os exemplos práticos. Obrigado!',
          language: 'pt',
          authorUsername: 'lucas',
          commentCreatedAt: ago(360),
          videoId: VIDEO_ID
        },
        moderator: admin._id,
        moderationNote: 'Reviewed. No policy violation found.',
        resolvedAt: ago(200),
        createdAt: ago(240),
        updatedAt: ago(200)
      },
      {
        _id: removedReportId,
        comment: removedCommentId,
        reporter: sofia._id,
        reason: 'spam',
        details: 'Fake follower promotion.',
        status: 'removed',
        snapshot: {
          content: 'Buy 10,000 followers now at a special price!',
          language: 'en',
          authorUsername: 'kenji',
          commentCreatedAt: ago(600),
          videoId: VIDEO_ID
        },
        moderator: admin._id,
        moderationNote: 'Removed for spam.',
        resolvedAt: ago(500),
        createdAt: ago(560),
        updatedAt: ago(500)
      }
    ],
    { timestamps: false }
  );

  await CommentHistory.insertMany(
    [
      {
        comment: priyaCommentId,
        action: 'edited',
        previousContent: 'यह वीडियो अच्छा है!',
        previousLanguage: 'hi',
        previousVersion: 0,
        editedBy: priya._id,
        createdAt: ago(2400)
      },
      {
        comment: deletedParentId,
        action: 'deleted',
        previousContent: 'This was my original comment about the editing workflow. I decided to delete it.',
        previousLanguage: 'en',
        previousVersion: 0,
        editedBy: alex._id,
        reason: 'Deleted by author',
        createdAt: ago(150)
      },
      {
        comment: removedCommentId,
        action: 'removed',
        previousContent: 'Buy 10,000 followers now at a special price!',
        previousLanguage: 'en',
        previousVersion: 0,
        editedBy: admin._id,
        reason: 'Removed for spam.',
        report: removedReportId,
        createdAt: ago(500)
      }
    ],
    { timestamps: false }
  );

  await ModerationLog.insertMany(
    [
      {
        action: 'comment_created',
        actor: priya._id,
        targetUser: priya._id,
        comment: priyaCommentId,
        metadata: { language: 'hi', isReply: false },
        createdAt: ago(2880)
      },
      {
        action: 'comment_edited',
        actor: priya._id,
        targetUser: priya._id,
        comment: priyaCommentId,
        metadata: { previousVersion: 0, newVersion: 1 },
        createdAt: ago(2400)
      },
      {
        action: 'report_created',
        actor: alex._id,
        targetUser: emma._id,
        comment: spamCommentId,
        report: pendingReportId,
        note: 'Reported for spam',
        metadata: { reason: 'spam' },
        createdAt: ago(35)
      },
      {
        action: 'report_dismissed',
        actor: admin._id,
        comment: lucasCommentId,
        report: dismissedReportId,
        note: 'Reviewed. No policy violation found.',
        metadata: { reason: 'offensive' },
        createdAt: ago(200)
      },
      {
        action: 'comment_removed',
        actor: admin._id,
        targetUser: kenji._id,
        comment: removedCommentId,
        report: removedReportId,
        note: 'Removed for spam.',
        metadata: { reason: 'spam' },
        createdAt: ago(500)
      },
      {
        action: 'blocked_attempt',
        actor: emma._id,
        targetUser: emma._id,
        note: 'Malicious links are not allowed.',
        metadata: {
          code: 'MALICIOUS_LINK',
          issue: 'MALICIOUS_LINK',
          contentPreview: 'Free followers at bit.ly/...'
        },
        createdAt: ago(20)
      }
    ],
    { timestamps: false }
  );

  await Notification.insertMany(
    [
      {
        recipient: priya._id,
        actor: alex._id,
        comment: mentionCommentId,
        type: 'mention',
        message: 'alex mentioned you: “Great breakdown @priya and @sofia...”',
        read: false,
        createdAt: ago(90)
      },
      {
        recipient: sofia._id,
        actor: alex._id,
        comment: mentionCommentId,
        type: 'mention',
        message: 'alex mentioned you: “Great breakdown @priya and @sofia...”',
        read: false,
        createdAt: ago(90)
      },
      {
        recipient: priya._id,
        actor: alex._id,
        comment: priyaCommentId,
        type: 'reply',
        message: 'alex replied to your comment.',
        read: true,
        createdAt: ago(2700)
      },
      {
        recipient: emma._id,
        actor: admin._id,
        comment: removedCommentId,
        type: 'moderation',
        message: 'A comment of yours was removed by a moderator for spam.',
        read: false,
        createdAt: ago(500)
      }
    ],
    { timestamps: false }
  );

  console.log('Demo data seeded successfully.\n');
  const sourceCounts = videos.reduce(
    (counts, video) => {
      counts[video.sourceType] += 1;
      return counts;
    },
    { local: 0, cloudinary: 0, youtube: 0 }
  );
  console.log(
    `Videos seeded: ${videos.length} (${sourceCounts.local} local, ${sourceCounts.cloudinary} Cloudinary, ${sourceCounts.youtube} YouTube).`
  );
  console.log('Demo accounts:');
  console.log('  alex@example.com / password123      (user, English)');
  console.log('  priya@example.com / password123     (user, Hindi)');
  console.log('  sofia@example.com / password123     (user, Spanish)');
  console.log('  lucas@example.com / password123     (user, Portuguese)');
  console.log('  emma@example.com / password123      (user, English)');
  console.log('  kenji@example.com / password123     (user, Japanese)');
  console.log('  amina@example.com / password123     (user, Arabic)');
  console.log('  admin@example.com / admin1234       (administrator)');
  console.log('\nFirst login on a new device shows a development OTP in the UI.');
  console.log('Open the app at http://localhost:5173 after running npm run dev.');
}

seed()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
