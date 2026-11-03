import { env } from '../config/env.js';

const geoCache = new Map();
const GEO_CACHE_MS = 6 * 60 * 60 * 1000;
let publicIpCache = { value: '', at: 0 };

function isPrivateIp(ip) {
  if (!ip) return true;
  if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') return true;
  if (ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80')) return true;
  const parts = ip.split('.').map(Number);
  if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    if (parts[0] === 0) return true;
  }
  return false;
}

function normalizeIp(raw) {
  if (!raw) return '';
  let ip = String(raw).split(',')[0].trim();
  ip = ip.replace(/^::ffff:/i, '');
  if (ip.includes(':') && ip.includes('.')) ip = ip.split(':').pop();
  return ip;
}

async function fetchJson(url, timeout = 3500) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'YouTube/1.0' },
    signal: AbortSignal.timeout(timeout)
  });
  if (!response.ok) throw new Error(`Geo provider responded ${response.status}`);
  return response.json();
}

async function getPublicIp() {
  if (publicIpCache.value && Date.now() - publicIpCache.at < 60 * 60 * 1000) {
    return publicIpCache.value;
  }
  try {
    const data = await fetchJson('https://api.ipify.org?format=json', 3000);
    if (data?.ip) {
      publicIpCache = { value: data.ip, at: Date.now() };
      return data.ip;
    }
  } catch {
    // Offline / blocked network: fall through
  }
  return '';
}

export async function extractRequestIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const candidate =
    (forwarded ? String(forwarded).split(',')[0] : '') ||
    req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    req.ip ||
    req.socket?.remoteAddress ||
    '';

  const raw = normalizeIp(candidate) || '127.0.0.1';
  const local = isPrivateIp(raw);

  if (!local) {
    return { ip: raw, isPrivate: false };
  }

  if (env.demo.publicIp) {
    return { ip: normalizeIp(env.demo.publicIp), isPrivate: true };
  }

  const serverIp = await getPublicIp();
  return { ip: serverIp || raw, isPrivate: true };
}

const emptyGeo = {
  city: '',
  state: '',
  country: '',
  countryCode: '',
  latitude: null,
  longitude: null,
  timezone: '',
  isp: '',
  locationLabel: 'Location unavailable'
};

function applyDemoOverride(geo) {
  if (!env.demo.city && !env.demo.state && !env.demo.country) return geo;
  const city = env.demo.city || geo.city;
  const state = env.demo.state || geo.state;
  const country = env.demo.country || geo.country;
  return {
    ...geo,
    city,
    state,
    country,
    locationLabel: [city, state, country].filter(Boolean).join(', ') || 'Location unavailable'
  };
}

function finishGeo(geo) {
  const withDemo = applyDemoOverride(geo);
  return {
    ...withDemo,
    locationLabel:
      [withDemo.city, withDemo.state, withDemo.country].filter(Boolean).join(', ') ||
      'Location unavailable'
  };
}

export async function lookupGeo(ip) {
  if (!ip || isPrivateIp(ip)) {
    return finishGeo({ ...emptyGeo });
  }

  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.at < GEO_CACHE_MS) {
    return cached.geo;
  }

  let geo = { ...emptyGeo };

  try {
    const data = await fetchJson(
      `https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country,country_code,region,city,latitude,longitude,timezone,connection`
    );
    if (data?.success) {
      geo = {
        city: data.city || '',
        state: data.region || '',
        country: data.country || '',
        countryCode: data.country_code || '',
        latitude: typeof data.latitude === 'number' ? data.latitude : null,
        longitude: typeof data.longitude === 'number' ? data.longitude : null,
        timezone: data.timezone?.id || '',
        isp: data.connection?.isp || '',
        locationLabel: ''
      };
    }
  } catch {
    try {
      const data = await fetchJson(
        `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,regionName,city,lat,lon,timezone,isp`
      );
      if (data?.status === 'success') {
        geo = {
          city: data.city || '',
          state: data.regionName || '',
          country: data.country || '',
          countryCode: data.countryCode || '',
          latitude: typeof data.lat === 'number' ? data.lat : null,
          longitude: typeof data.lon === 'number' ? data.lon : null,
          timezone: data.timezone || '',
          isp: data.isp || '',
          locationLabel: ''
        };
      }
    } catch {
      // Both providers unavailable — keep empty geo
    }
  }

  const result = finishGeo(geo);
  if (geoCache.size > 500) geoCache.clear();
  geoCache.set(ip, { geo: result, at: Date.now() });
  return result;
}
