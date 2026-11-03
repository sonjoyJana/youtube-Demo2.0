import rateLimit from 'express-rate-limit';

function limitHandler(message, code) {
  return (req, res) => {
    res.status(429).json({
      message,
      code,
      retryAfter: req.rateLimit?.resetTime
        ? Math.max(1, Math.ceil((req.rateLimit.resetTime.getTime() - Date.now()) / 1000))
        : undefined
    });
  };
}

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: limitHandler('Too many requests. Please slow down.', 'RATE_LIMITED')
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: limitHandler('Too many sign-in attempts. Please try again later.', 'AUTH_RATE_LIMITED')
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Too many sign-in attempts. Please wait 15 minutes and try again.'
});

export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Too many verification attempts. Please wait before trying again.'
});

export const otpResendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Too many OTP requests. Please wait and try again.'
});

export const commentLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: limitHandler(
    'You are commenting too quickly. Please wait a moment before trying again.',
    'COMMENT_RATE_LIMITED'
  )
});

export const reportLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: limitHandler('Too many reports submitted. Please try again later.', 'REPORT_RATE_LIMITED')
});

export const translateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: limitHandler(
    'Translation limit reached. Please wait a moment and try again.',
    'TRANSLATION_RATE_LIMITED'
  )
});
