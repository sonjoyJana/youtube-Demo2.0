import mongoose from 'mongoose';

const translationSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    source: {
      type: String,
      required: true,
    },
    target: {
      type: String,
      required: true,
    },
    original: {
      type: String,
      required: true,
    },
    translated: {
      type: String,
      required: true,
    },
    provider: {
      type: String,
      default: 'mymemory',
    },
  },
  { timestamps: true }
);

translationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export const Translation = mongoose.model('Translation', translationSchema);
