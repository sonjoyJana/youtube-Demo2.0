import mongoose from 'mongoose';

const otpChallengeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    loginRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LoginRecord',
      required: true
    },
    channel: {
      type: String,
      enum: ['email', 'mobile'],
      default: 'email'
    },
    destination: { type: String, default: '' },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    lastSentAt: { type: Date, default: Date.now },
    usedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['pending', 'verified', 'locked', 'expired'],
      default: 'pending',
      index: true
    }
  },
  { timestamps: true }
);

otpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OtpChallenge = mongoose.model('OtpChallenge', otpChallengeSchema);
