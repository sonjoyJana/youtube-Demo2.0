const IST_TIMEZONE = 'Asia/Kolkata';

export function getIstHour(date = new Date()) {
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TIMEZONE,
    hour: '2-digit',
    hour12: false
  }).format(date);
  return Number(hour) % 24;
}

/**
 * Product rule: logins between 05:00 and 11:59 IST use the light theme,
 * every other login window defaults to dark.
 */
export function themeForLoginTime(date = new Date()) {
  const hour = getIstHour(date);
  return hour >= 5 && hour < 12 ? 'light' : 'dark';
}

export function istTimeLabel(date = new Date()) {
  return `${new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date)} IST`;
}

export function themeInfo(user, date = new Date()) {
  const now = date;
  return {
    theme: user?.theme || 'dark',
    preference: user?.themePreference || 'auto',
    loginTimeTheme: themeForLoginTime(now),
    istHour: getIstHour(now),
    istTime: istTimeLabel(now),
    rule: 'Light theme for logins between 5:00 AM and 12:00 PM IST; dark otherwise',
    window: '5:00 AM – 11:59 AM IST'
  };
}

export { IST_TIMEZONE };
