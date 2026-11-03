import mongoose from 'mongoose';

const commentHistorySchema = new mongoose.Schema(
  {
    comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: ['edited', 'deleted', 'removed'],
      required: true,
    },
    previousContent: {
      type: String,
      default: '',
    },
    previousLanguage: String,
    previousVersion: Number,
    editedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reason: {
      type: String,
      default: '',
      maxlength: 1000,
    },
    report: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Report',
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

commentHistorySchema.index({ comment: 1, createdAt: -1 });

export const CommentHistory = mongoose.model('CommentHistory', commentHistorySchema);
