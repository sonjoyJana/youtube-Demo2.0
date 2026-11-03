const DEVICE_KEY = 'streamtube_device_id';

function randomId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return 'storage-unavailable-device';
  }
}

export async function getDeviceMeta() {
  const meta = {
    deviceId: getDeviceId(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    language: navigator.language || '',
    screen: typeof screen !== 'undefined' ? `${screen.width}x${screen.height}` : ''
  };

  try {
    const uaData = navigator.userAgentData;
    if (uaData?.getHighEntropyValues) {
      const values = await uaData.getHighEntropyValues(['model', 'platform', 'platformVersion']);
      meta.model = values.model || '';
      meta.platform = values.platform || '';
      meta.platformVersion = values.platformVersion || '';
    }
  } catch {
    // User-Agent Client Hints are not available in every browser.
  }

  return meta;
}
