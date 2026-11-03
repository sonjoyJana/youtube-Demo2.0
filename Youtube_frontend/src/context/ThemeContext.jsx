import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../lib/api.js';

const ThemeContext = createContext(null);
const THEME_KEY = 'streamtube_theme';
const PREF_KEY = 'streamtube_theme_preference';

function storedTheme() {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(storedTheme);
  const [preference, setPreference] = useState(() => {
    try {
      const value = localStorage.getItem(PREF_KEY);
      return ['auto', 'light', 'dark'].includes(value) ? value : 'auto';
    } catch {
      return 'auto';
    }
  });
  const [themeInfo, setThemeInfo] = useState(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'light' ? '#ffffff' : '#0f0f0f');
    try {
      localStorage.setItem(THEME_KEY, theme);
      localStorage.setItem(PREF_KEY, preference);
    } catch {
      // Ignore storage failures.
    }
  }, [theme, preference]);

  const applyThemeInfo = useCallback((info) => {
    if (!info) return;
    setThemeInfo(info);
    if (info.theme === 'light' || info.theme === 'dark') setTheme(info.theme);
    if (['auto', 'light', 'dark'].includes(info.preference)) setPreference(info.preference);
  }, []);

  const applyUser = useCallback(
    (user, info) => {
      if (user?.theme === 'light' || user?.theme === 'dark') setTheme(user.theme);
      if (['auto', 'light', 'dark'].includes(user?.themePreference)) {
        setPreference(user.themePreference);
      }
      if (info) applyThemeInfo(info);
    },
    [applyThemeInfo]
  );

  const changePreference = useCallback(async (nextPreference) => {
    const { data } = await api.patch('/profile/theme', { preference: nextPreference });
    applyUser(data.user, data.themeInfo);
    return data;
  }, [applyUser]);

  const toggleTheme = useCallback(async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    return changePreference(next);
  }, [theme, changePreference]);

  const value = useMemo(
    () => ({
      theme,
      preference,
      themeInfo,
      applyThemeInfo,
      applyUser,
      changePreference,
      toggleTheme,
      setThemeInfo
    }),
    [theme, preference, themeInfo, applyThemeInfo, applyUser, changePreference, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
