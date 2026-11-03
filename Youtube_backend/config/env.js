import 'dotenv/config';

const int = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const bool = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const list = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export const env = {
  port: int(process.env.PORT, 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/streamtube',
  jwtSecret: process.env.JWT_SECRET || 'development-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  jwtExpiresDays: int(process.env.JWT_EXPIRES_IN_DAYS, 7),
  bcryptRounds: int(process.env.BCRYPT_ROUNDS, 12),
  clientOrigins: list(process.env.CLIENT_ORIGIN || 'http://localhost:5173'),
  mongoDbName: process.env.MONGO_DB || 'streamtube',

  // Security / OTP
  trustedDeviceDays: int(process.env.TRUSTED_DEVICE_DAYS, 30),
  otpSecret: process.env.OTP_SECRET || 'development-otp-secret-change-me',
  otpTtlMinutes: int(process.env.OTP_TTL_MINUTES, 10),
  otpMaxAttempts: int(process.env.OTP_MAX_ATTEMPTS, 5),
  otpResendSeconds: int(process.env.OTP_RESEND_SECONDS, 30),
  exposeDevOtp: bool(process.env.EXPOSE_DEV_OTP, false) && process.env.NODE_ENV !== 'production',

  // Comments / translation
  commentEditWindowMinutes: int(process.env.COMMENT_EDIT_WINDOW_MINUTES, 15),
  maxCommentLength: int(process.env.MAX_COMMENT_LENGTH, 2000),
  maxReportDetails: int(process.env.MAX_REPORT_DETAILS, 500),

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    folder: process.env.CLOUDINARY_VIDEO_FOLDER || 'streamtube',
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || ''
  },

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: int(process.env.SMTP_PORT, 587),
    secure: bool(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'YouTube <no-reply@streamtube.local>'
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    from: process.env.TWILIO_FROM || ''
  },
  demo: {
    publicIp: process.env.DEMO_PUBLIC_IP || '',
    city: process.env.DEMO_CITY || '',
    state: process.env.DEMO_STATE || '',
    country: process.env.DEMO_COUNTRY || ''
  }
};

if (env.isProduction && env.jwtSecret.includes('change-me')) {
  throw new Error('JWT_SECRET must be configured in production');
}
