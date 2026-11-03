export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date)} IST`;
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium'
  }).format(date);
}

export function timeAgo(value) {
  if (!value) return '—';
  const date = new Date(value).getTime();
  if (Number.isNaN(date)) return '—';
  const seconds = Math.round((Date.now() - date) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(value);
}

export function daysUntil(value) {
  if (!value) return 0;
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86400000));
}

export function locationLabel(location) {
  if (!location) return 'Unknown location';
  const label =
    location.label ||
    [location.city, location.state, location.country].filter(Boolean).join(', ');
  return label || 'Unknown location';
}

export function formatCount(value) {
  const number = Number(value) || 0;
  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (number >= 1_000) return `${(number / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(number);
}

export function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  const ss = String(secs).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export const STATUS_META = {
  success: { label: 'Successful', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  pending_otp: { label: 'OTP pending', tone: 'warning' },
  otp_locked: { label: 'OTP locked', tone: 'danger' }
};

export function statusMeta(status) {
  return STATUS_META[status] || { label: status || 'Unknown', tone: 'muted' };
}

export const EVENT_META = {
  account_created: { label: 'Account created', icon: 'sparkles' },
  login_success: { label: 'Sign-in successful', icon: 'check' },
  login_failed: { label: 'Sign-in failed', icon: 'alert' },
  otp_sent: { label: 'OTP sent', icon: 'mail' },
  otp_verified: { label: 'OTP verified', icon: 'shield' },
  otp_failed: { label: 'Wrong OTP', icon: 'alert' },
  otp_locked: { label: 'OTP locked', icon: 'lock' },
  trusted_device_added: { label: 'Device trusted', icon: 'monitor' },
  trusted_device_removed: { label: 'Device removed', icon: 'trash' },
  session_revoked: { label: 'Session revoked', icon: 'laptop' },
  logout: { label: 'Signed out', icon: 'logout' },
  theme_changed: { label: 'Theme changed', icon: 'palette' },
  profile_updated: { label: 'Profile updated', icon: 'user' }
};

export function eventMeta(type) {
  return EVENT_META[type] || { label: type, icon: 'info' };
}

export function initials(name = '') {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'ST'
  );
}
