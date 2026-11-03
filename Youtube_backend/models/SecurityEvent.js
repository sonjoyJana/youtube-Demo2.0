import mongoose from 'mongoose';

const securityEventSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: [
        'account_created',
        'login_success',
        'login_failed',
        'otp_sent',
        'otp_verified',
        'otp_failed',
        'otp_locked',
        'trusted_device_added',
        'trusted_device_removed',
        'session_revoked',
        'logout',
        'theme_changed',
        'profile_updated'
      ],
      required: true,
      index: true
    },
    message: { type: String, default: '' },
    ip: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    country: { type: String, default: '' },
    browserName: { type: String, default: '' },
    deviceType: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

securityEventSchema.index({ user: 1, createdAt: -1 });

export const SecurityEvent = mongoose.model('SecurityEvent', securityEventSchema);
