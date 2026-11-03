import mongoose from 'mongoose';

const downloadSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    video: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Video',
      required: true
    },
    videoId: {
      type: String,
      required: true,
      trim: true
    },
    sourceType: {
      type: String,
      enum: ['local', 'cloudinary', 'youtube'],
      default: 'local'
    },
    dayKey: {
      type: String,
      required: true
    },
    monthKey: {
      type: String,
      required: true
    },
    tokenId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    consumedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

downloadSchema.index({ user: 1, dayKey: 1 });
downloadSchema.index({ user: 1, monthKey: 1 });

export const Download = mongoose.model('Download', downloadSchema);
