import mongoose from 'mongoose';

const videoSchema = new mongoose.Schema(
  {
    videoId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: ''
    },
    channel: {
      type: String,
      required: true,
      trim: true
    },
    channelId: {
      type: String,
      default: ''
    },
    category: {
      type: String,
      default: 'Music',
      index: true
    },
    minPlan: {
      type: String,
      enum: ['free', 'bronze', 'silver', 'gold'],
      default: 'free',
      index: true
    },
    views: {
      type: Number,
      default: 0
    },
    likes: {
      type: Number,
      default: 0
    },
    dislikes: {
      type: Number,
      default: 0
    },
    durationSeconds: {
      type: Number,
      default: 0
    },
    thumbnail: {
      type: String,
      default: ''
    },
    sourceType: {
      type: String,
      enum: ['local', 'cloudinary', 'youtube'],
      default: 'local',
      index: true
    },
    youtubeId: {
      type: String,
      default: '',
      trim: true,
      validate: {
        validator(value) {
          return !value || /^[A-Za-z0-9_-]{6,20}$/.test(value);
        },
        message: 'youtubeId must be a valid YouTube video identifier.'
      }
    },
    cloudinaryPublicId: {
      type: String,
      default: '',
      trim: true
    },
    streamUrl: {
      type: String,
      default: ''
    },
    tags: [
      {
        type: String,
        trim: true
      }
    ],
    publishedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

videoSchema.pre('validate', function validatePlaybackSource(next) {
  if (this.sourceType === 'youtube') {
    if (!this.youtubeId) this.invalidate('youtubeId', 'YouTube videos require a youtubeId.');
    this.streamUrl = '';
  } else if (!this.streamUrl) {
    this.invalidate('streamUrl', 'A playable streamUrl is required.');
  }
  next();
});

videoSchema.virtual('thumbnailUrl').get(function getThumbnailUrl() {
  return this.thumbnail;
});

videoSchema.set('toJSON', { virtuals: true });

export const Video = mongoose.model('Video', videoSchema);
