import crypto from 'crypto';
import { UAParser } from 'ua-parser-js';

function normalizeBrowserName(name = '') {
  const raw = String(name).trim();
  const lower = raw.toLowerCase();
  if (!raw || lower === 'unknown') return 'Unknown';
  if (lower.includes('edge') || lower === 'edg') return 'Edge';
  if (lower.includes('opera') || lower.includes('opr')) return 'Opera';
  if (lower.includes('samsung')) return 'Samsung Internet';
  if (lower.includes('firefox')) return 'Firefox';
  if (lower.includes('chrome') || lower.includes('chromium')) return 'Chrome';
  if (lower.includes('safari')) return 'Safari';
  if (lower.includes('brave')) return 'Brave';
  return raw;
}

function resolveDeviceType(device, os) {
  const type = String(device.type || '').toLowerCase();
  if (type === 'tablet') return 'Tablet';
  if (type === 'mobile' || type === 'wearable' || type === 'embedded') return 'Mobile';
  if (/ipad/i.test(device.model || '') || /iPad/i.test(os.name || '')) return 'Tablet';
  if (/iphone|android|mobile/i.test(device.model || '')) return 'Mobile';
  return 'Desktop';
}

function cleanMeta(value, max = 80) {
  if (typeof value !== 'string') return '';
  return value.replace(/[^\w .()\-+/]/g, '').trim().slice(0, max);
}

export function buildDeviceInfo(req, clientMeta = {}) {
  const userAgent = String(req.headers['user-agent'] || '');
  const parser = new UAParser(userAgent);
  const browser = parser.getBrowser();
  const os = parser.getOS();
  const device = parser.getDevice();
  const providedId = String(req.headers['x-device-id'] || clientMeta.deviceId || '')
    .replace(/[^\w-]/g, '')
    .slice(0, 80);
  const deviceId = providedId || `srv-${crypto.createHash('sha256').update(userAgent).digest('hex').slice(0, 32)}`;

  const browserName = normalizeBrowserName(browser.name);
  const browserVersion = String(browser.version || '').split(' ')[0].slice(0, 30);
  const osName = String(os.name || 'Unknown').slice(0, 40);
  const osVersion = String(os.version || '').slice(0, 30);
  const deviceType = resolveDeviceType(device, os);
  const deviceModel =
    cleanMeta(clientMeta.model, 60) ||
    cleanMeta(device.model, 60) ||
    cleanMeta(clientMeta.platform, 60);

  const fingerprint = crypto
    .createHash('sha256')
    .update(`${deviceId}|${browserName}|${osName}|${deviceModel}`)
    .digest('hex');

  return {
    deviceId,
    fingerprint,
    name: `${browserName} ${browserVersion ? browserVersion.split('.')[0] : ''} · ${osName}`.trim(),
    browserName,
    browserVersion,
    browserMajor: browserVersion.split('.')[0] || '',
    osName,
    osVersion,
    deviceType,
    deviceModel,
    userAgent,
    platform: cleanMeta(clientMeta.platform, 40) || osName,
    meta: {
      timezone: cleanMeta(clientMeta.timezone, 60),
      language: cleanMeta(clientMeta.language, 20),
      screen: cleanMeta(clientMeta.screen, 20)
    }
  };
}

export function deviceContext(device) {
  return {
    browserName: device.browserName,
    deviceType: device.deviceType,
    deviceModel: device.deviceModel
  };
}
