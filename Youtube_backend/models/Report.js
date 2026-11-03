import mongoose from 'mongoose';
import { MAX_REPORT_DETAILS, REPORT_REASON_VALUES } from '../constants.js';

const reportSchema = new mongoose.Schema(
  {
    comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      required: true,
      index: true,
    },
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      enum: [...REPORT_REASON_VALUES],
    },
    details: {
      type: String,
      default: '',
      maxlength: MAX_REPORT_DETAILS,
    },
    status: {
      type: String,
      enum: ['pending', 'dismissed', 'removed'],
      default: 'pending',
      index: true,
    },
    snapshot: {
      content: String,
      language: String,
      authorUsername: String,
      commentCreatedAt: Date,
      videoId: String,
    },
    moderator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    moderationNote: {
      type: String,
      default: '',
      maxlength: 1000,
    },
    resolvedAt: Date,
  },
  { timestamps: true }
);

reportSchema.index({ comment: 1, reporter: 1 }, { unique: true });
reportSchema.index({ status: 1, createdAt: -1 });

export const Report = mongoose.model('Report', reportSchema);
