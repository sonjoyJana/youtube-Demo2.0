import express from 'express';
import { LANGUAGE_CODES, LANGUAGES, MAX_COMMENT_LENGTH } from '../constants.js';
import { translateLimiter } from '../middleware/rateLimiters.js';
import { detectLanguage } from '../services/moderation.js';
import { TranslationError, translateText } from '../services/translate.js';

const router = express.Router();

router.get('/languages', (_req, res) => {
  res.json({ languages: LANGUAGES });
});

router.post('/', translateLimiter, async (req, res, next) => {
  try {
    const text = String(req.body.text || '').trim();
    const target = String(req.body.target || '').trim();
    let source = String(req.body.source || '').trim();

    if (!text) {
      return res.status(400).json({ message: 'Text is required for translation.', code: 'EMPTY_TEXT' });
    }
    if (text.length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({ message: 'Text is too long to translate.', code: 'TEXT_TOO_LONG' });
    }
    if (!LANGUAGE_CODES.has(target)) {
      return res.status(400).json({ message: 'Unsupported target language.', code: 'INVALID_TARGET' });
    }
    if (source && !LANGUAGE_CODES.has(source)) {
      return res.status(400).json({ message: 'Unsupported source language.', code: 'INVALID_SOURCE' });
    }
    if (!source) source = detectLanguage(text);

    const result = await translateText(text, source, target);
    return res.json({
      original: text,
      translated: result.translated,
      source,
      target,
      provider: result.provider,
      cached: result.cached,
    });
  } catch (error) {
    if (error instanceof TranslationError) {
      return res.status(502).json({ message: error.message, code: error.code });
    }
    return next(error);
  }
});

export default router;
