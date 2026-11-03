import mongoose from 'mongoose';

const moderationLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: [
        'comment_created',
        'comment_edited',
        'comment_deleted',
        'comment_removed',
        'report_created',
        'report_dismissed',
        'report_resolved',
        'blocked_attempt',
        'captcha_required',
        'warning_issued',
      ],
      required: true,
      index: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
    },
    report: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Report',
    },
    note: {
      type: String,
      default: '',
      maxlength: 1000,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

moderationLogSchema.index({ createdAt: -1 });

export const ModerationLog = mongoose.model('ModerationLog', moderationLogSchema);
