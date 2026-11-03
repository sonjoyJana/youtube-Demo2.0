export function safeUser(user) {
  if (!user) return null;
  return {
    id: String(user._id),
    name: user.name,
    username: user.username,
    email: user.email,
    mobile: user.mobile || '',
    avatar: user.avatar,
    location: user.location,
    preferredLanguage: user.preferredLanguage,
    role: user.role,
    theme: user.theme,
    themePreference: user.themePreference,
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt
  };
}

export function loginSummary(record) {
  if (!record) return null;
  return {
    id: String(record._id),
    status: record.status,
    reason: record.reason || '',
    ip: record.ip,
    location: {
      city: record.city || '',
      state: record.state || '',
      country: record.country || '',
      label: record.locationLabel || '',
      latitude: record.latitude ?? null,
      longitude: record.longitude ?? null
    },
    browser: {
      name: record.browserName || 'Unknown',
      version: record.browserVersion || ''
    },
    os: {
      name: record.osName || 'Unknown',
      version: record.osVersion || ''
    },
    deviceType: record.deviceType || 'Desktop',
    deviceModel: record.deviceModel || '',
    requiresOtp: Boolean(record.requiresOtp),
    otpVerified: Boolean(record.otpVerified),
    otpAttempts: record.otpAttempts || 0,
    trusted: Boolean(record.trusted),
    isNewBrowser: Boolean(record.isNewBrowser),
    isNewDevice: Boolean(record.isNewDevice),
    isNewIp: Boolean(record.isNewIp),
    isNewLocation: Boolean(record.isNewLocation),
    userAgent: record.userAgent || '',
    timestamp: record.createdAt,
    createdAt: record.createdAt
  };
}

export function sessionSummary(session, currentSessionId) {
  return {
    id: String(session._id),
    sessionId: session.sessionId,
    browser: {
      name: session.browserName || 'Unknown',
      version: session.browserVersion || ''
    },
    os: {
      name: session.osName || 'Unknown',
      version: session.osVersion || ''
    },
    deviceType: session.deviceType || 'Desktop',
    deviceModel: session.deviceModel || '',
    ip: session.ip,
    location: {
      city: session.city || '',
      state: session.state || '',
      country: session.country || '',
      label: session.locationLabel || ''
    },
    createdAt: session.createdAt,
    lastActiveAt: session.lastActiveAt,
    expiresAt: session.expiresAt,
    current: Boolean(currentSessionId) && session.sessionId === currentSessionId
  };
}

export function trustedDeviceSummary(device, currentDeviceId) {
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(device.expiresAt).getTime() - Date.now()) / 86400000)
  );
  return {
    id: String(device._id),
    name: device.name || 'Trusted device',
    browser: {
      name: device.browserName || 'Unknown',
      version: device.browserVersion || ''
    },
    os: {
      name: device.osName || 'Unknown',
      version: device.osVersion || ''
    },
    deviceType: device.deviceType || 'Desktop',
    deviceModel: device.deviceModel || '',
    ip: device.lastIp || '',
    location: {
      city: device.lastCity || '',
      state: device.lastState || '',
      country: device.lastCountry || '',
      label: device.lastLocationLabel || ''
    },
    trustedAt: device.trustedAt,
    lastUsedAt: device.lastUsedAt,
    expiresAt: device.expiresAt,
    daysLeft,
    current: Boolean(currentDeviceId) && device.deviceId === currentDeviceId
  };
}
