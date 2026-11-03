import mongoose from 'mongoose';
import { LANGUAGE_CODES, MAX_COMMENT_LENGTH } from '../constants.js';

const commentSchema = new mongoose.Schema(
  {
    videoId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    content: {
      type: String,
      default: '',
      maxlength: MAX_COMMENT_LENGTH,
    },
    language: {
      type: String,
      default: 'en',
      validate: {
        validator: (value) => LANGUAGE_CODES.has(value),
        message: 'Unsupported comment language',
      },
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
      index: true,
    },
    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    dislikes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    edited: {
      type: Boolean,
      default: false,
    },
    editedAt: Date,
    editCount: {
      type: Number,
      default: 0,
    },
    version: {
      type: Number,
      default: 0,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: Date,
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    removed: {
      type: Boolean,
      default: false,
    },
    removedAt: Date,
    removedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: String,
      enum: ['visible', 'flagged', 'deleted', 'removed'],
      default: 'visible',
      index: true,
    },
    flagged: {
      type: Boolean,
      default: false,
      index: true,
    },
    reportCount: {
      type: Number,
      default: 0,
    },
    lastReportedAt: Date,
  },
  { timestamps: true }
);

commentSchema.index({ videoId: 1, parent: 1, createdAt: -1 });
commentSchema.index({ videoId: 1, author: 1, createdAt: -1 });
commentSchema.index({ author: 1, content: 1, createdAt: -1 });

export const Comment = mongoose.model('Comment', commentSchema);
