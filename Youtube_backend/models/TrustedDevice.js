import mongoose from 'mongoose';

const trustedDeviceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    deviceId: { type: String, required: true },
    fingerprint: { type: String, required: true },
    name: { type: String, default: '' },
    browserName: { type: String, default: '' },
    browserVersion: { type: String, default: '' },
    osName: { type: String, default: '' },
    osVersion: { type: String, default: '' },
    deviceType: { type: String, enum: ['Desktop', 'Mobile', 'Tablet'], default: 'Desktop' },
    deviceModel: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    lastIp: { type: String, default: '' },
    lastCity: { type: String, default: '' },
    lastState: { type: String, default: '' },
    lastCountry: { type: String, default: '' },
    lastLocationLabel: { type: String, default: '' },
    trustedAt: { type: Date, default: Date.now },
    lastUsedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

trustedDeviceSchema.index({ user: 1, deviceId: 1, fingerprint: 1 }, { unique: true });
trustedDeviceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const TrustedDevice = mongoose.model('TrustedDevice', trustedDeviceSchema);
