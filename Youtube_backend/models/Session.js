import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    deviceId: { type: String, default: '' },
    fingerprint: { type: String, default: '' },
    browserName: { type: String, default: '' },
    browserVersion: { type: String, default: '' },
    osName: { type: String, default: '' },
    osVersion: { type: String, default: '' },
    deviceType: { type: String, enum: ['Desktop', 'Mobile', 'Tablet'], default: 'Desktop' },
    deviceModel: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    country: { type: String, default: '' },
    locationLabel: { type: String, default: '' },
    lastActiveAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: '' }
  },
  { timestamps: true }
);

sessionSchema.index({ user: 1, revokedAt: 1, expiresAt: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = mongoose.model('Session', sessionSchema);
