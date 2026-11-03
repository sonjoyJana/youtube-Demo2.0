import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { LANGUAGE_CODES } from '../constants.js';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80
    },
    username: {
      type: String,
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: /^[a-zA-Z0-9_]+$/,
      default: ''
    },
    usernameLower: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    mobile: {
      type: String,
      default: '',
      trim: true
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false
    },
    avatar: {
      type: String,
      default: '',
      maxlength: 500
    },
    location: {
      type: String,
      default: 'Somewhere on Earth',
      maxlength: 100
    },
    preferredLanguage: {
      type: String,
      default: 'en',
      validate: {
        validator: (value) => LANGUAGE_CODES.has(value),
        message: 'Unsupported preferred language'
      }
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user'
    },
    theme: {
      type: String,
      enum: ['light', 'dark'],
      default: 'dark'
    },
    themePreference: {
      type: String,
      enum: ['auto', 'light', 'dark'],
      default: 'auto'
    },
    lastSeenAt: {
      type: Date,
      default: Date.now
    },
    lastLoginAt: {
      type: Date,
      default: null
    },
    plan: {
      type: String,
      enum: ['free', 'bronze', 'silver', 'gold'],
      default: 'free'
    },
    planStartedAt: {
      type: Date,
      default: null
    },
    planExpiresAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

userSchema.pre('validate', function syncUsernameLower(next) {
  if (this.username) {
    this.usernameLower = this.username.toLowerCase();
  }
  next();
});

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  return next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.effectivePlan = function effectivePlan() {
  const planId = this.plan || 'free';
  if (planId !== 'free') {
    const expired = this.planExpiresAt && new Date(this.planExpiresAt).getTime() < Date.now();
    if (expired) return 'free';
  }
  return planId;
};

userSchema.methods.hasActivePaidPlan = function hasActivePaidPlan() {
  const planId = this.plan || 'free';
  if (planId === 'free') return false;
  if (!this.planStartedAt || !this.planExpiresAt) return true;
  return new Date(this.planExpiresAt).getTime() > Date.now();
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id.toString(),
    name: this.name,
    username: this.username,
    email: this.email,
    avatar: this.avatar,
    location: this.location,
    preferredLanguage: this.preferredLanguage,
    role: this.role,
    theme: this.theme,
    themePreference: this.themePreference,
    lastLoginAt: this.lastLoginAt,
    plan: this.plan,
    createdAt: this.createdAt
  };
};

export const User = mongoose.model('User', userSchema);
