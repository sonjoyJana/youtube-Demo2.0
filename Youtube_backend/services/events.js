import { SecurityEvent } from '../models/SecurityEvent.js';

export async function recordEvent({
  user,
  type,
  message = '',
  ip = '',
  city = '',
  state = '',
  country = '',
  browserName = '',
  deviceType = '',
  metadata = {}
}) {
  if (!user) return null;
  try {
    return await SecurityEvent.create({
      user,
      type,
      message,
      ip,
      city,
      state,
      country,
      browserName,
      deviceType,
      metadata
    });
  } catch (error) {
    console.error(`[security-event] failed to persist ${type}: ${error.message}`);
    return null;
  }
}

export function eventContext(geo, device) {
  return {
    ip: geo?.ip || '',
    city: geo?.city || '',
    state: geo?.state || '',
    country: geo?.country || '',
    browserName: device?.browserName || '',
    deviceType: device?.deviceType || ''
  };
}
