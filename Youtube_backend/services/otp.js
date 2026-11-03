import crypto from 'crypto';
import { env } from '../config/env.js';

export function generateOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashOtp(otp) {
  return crypto.createHmac('sha256', env.otpSecret).update(String(otp)).digest('hex');
}

export function verifyOtpHash(otp, storedHash) {
  const candidate = Buffer.from(hashOtp(otp), 'hex');
  const stored = Buffer.from(String(storedHash || ''), 'hex');
  if (candidate.length !== stored.length || candidate.length === 0) return false;
  return crypto.timingSafeEqual(candidate, stored);
}

export function maskEmail(email) {
  const [name, domain] = String(email || '').split('@');
  if (!name || !domain) return email || '';
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${'*'.repeat(Math.max(2, name.length - visible.length))}@${domain}`;
}

export function maskMobile(mobile) {
  const digits = String(mobile || '').replace(/\D/g, '');
  if (digits.length < 4) return mobile || '';
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

export function otpExpiry() {
  return new Date(Date.now() + env.otpTtlMinutes * 60 * 1000);
}
