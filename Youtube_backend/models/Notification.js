import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
    },
    type: {
      type: String,
      enum: ['mention', 'reply', 'moderation'],
      required: true,
    },
    message: {
      type: String,
      required: true,
      maxlength: 300,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
