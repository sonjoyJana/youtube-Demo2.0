export const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'pt', name: 'Portuguese', native: 'Português' },
  { code: 'it', name: 'Italian', native: 'Italiano' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'ar', name: 'Arabic', native: 'العربية' },
  { code: 'zh', name: 'Chinese', native: '中文' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
  { code: 'ko', name: 'Korean', native: '한국어' },
  { code: 'ru', name: 'Russian', native: 'Русский' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe' },
  { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia' },
  { code: 'ur', name: 'Urdu', native: 'اردو' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'nl', name: 'Dutch', native: 'Nederlands' },
  { code: 'sv', name: 'Swedish', native: 'Svenska' },
  { code: 'pl', name: 'Polish', native: 'Polski' },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt' },
  { code: 'th', name: 'Thai', native: 'ไทย' },
  { code: 'he', name: 'Hebrew', native: 'עברית' },
  { code: 'fa', name: 'Persian', native: 'فارسی' },
  { code: 'el', name: 'Greek', native: 'Ελληνικά' },
  { code: 'ro', name: 'Romanian', native: 'Română' },
  { code: 'uk', name: 'Ukrainian', native: 'Українська' },
  { code: 'cs', name: 'Czech', native: 'Čeština' },
];

export const LANGUAGE_CODES = new Set(LANGUAGES.map((language) => language.code));

export const REPORT_REASONS = [
  { value: 'spam', label: 'Spam or misleading' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'offensive', label: 'Offensive content' },
  { value: 'hate', label: 'Hate speech' },
  { value: 'misinformation', label: 'Misinformation' },
  { value: 'other', label: 'Something else' },
];

export const REPORT_REASON_VALUES = new Set(REPORT_REASONS.map((reason) => reason.value));

export const EDIT_WINDOW_MS =
  Math.max(1, Number(process.env.COMMENT_EDIT_WINDOW_MINUTES) || 15) * 60 * 1000;

export const MAX_COMMENT_LENGTH = 2000;
export const MAX_REPORT_DETAILS = 500;
