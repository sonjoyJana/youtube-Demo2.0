import mongoose from 'mongoose';

const loginRecordSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    email: {
      type: String,
      default: '',
      lowercase: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['pending_otp', 'success', 'failed', 'otp_locked'],
      default: 'failed',
      index: true
    },
    reason: {
      type: String,
      default: ''
    },
    requiresOtp: { type: Boolean, default: false },
    otpVerified: { type: Boolean, default: false },
    otpAttempts: { type: Number, default: 0 },
    trusted: { type: Boolean, default: false },
    newDeviceReasons: { type: [String], default: [] },

    ip: { type: String, default: '' },
    ipIsPrivate: { type: Boolean, default: false },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    country: { type: String, default: '' },
    locationLabel: { type: String, default: '' },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    timezone: { type: String, default: '' },

    browserName: { type: String, default: '' },
    browserVersion: { type: String, default: '' },
    osName: { type: String, default: '' },
    osVersion: { type: String, default: '' },
    deviceType: { type: String, enum: ['Desktop', 'Mobile', 'Tablet'], default: 'Desktop' },
    deviceModel: { type: String, default: '' },
    deviceId: { type: String, default: '' },
    fingerprint: { type: String, default: '' },
    userAgent: { type: String, default: '' },

    isNewBrowser: { type: Boolean, default: false },
    isNewDevice: { type: Boolean, default: false },
    isNewIp: { type: Boolean, default: false },
    isNewLocation: { type: Boolean, default: false },

    challengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OtpChallenge',
      default: null
    },
    sessionId: { type: String, default: '' }
  },
  { timestamps: true }
);

loginRecordSchema.index({ user: 1, createdAt: -1 });
loginRecordSchema.index({ user: 1, status: 1, createdAt: -1 });

export const LoginRecord = mongoose.model('LoginRecord', loginRecordSchema);
