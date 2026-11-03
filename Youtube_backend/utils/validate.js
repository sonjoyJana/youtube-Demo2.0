export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MOBILE_RE = /^[6-9]\d{9}$/;

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function normalizeMobile(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.slice(-10);
}

export function isNonEmptyString(value, min = 1, max = 500) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length >= min && trimmed.length <= max;
}

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
