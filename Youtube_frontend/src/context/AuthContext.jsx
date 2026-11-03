import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { TOKEN_KEY } from '../lib/api.js';
import { getDeviceMeta } from '../lib/device.js';
import { useTheme } from './ThemeContext.jsx';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { applyThemeInfo } = useTheme();

  const clearToken = useCallback(() => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Ignore.
    }
  }, []);

  const storeSession = useCallback(
    (data) => {
      if (data?.token) {
        try {
          localStorage.setItem(TOKEN_KEY, data.token);
        } catch {
          // Ignore.
        }
      }
      if (data?.user) setUser(data.user);
      if (data?.themeInfo) applyThemeInfo(data.themeInfo);
    },
    [applyThemeInfo]
  );

  const refreshUser = useCallback(async () => {
    const { data } = await api.get('/auth/me');
    setUser(data.user);
    applyThemeInfo(data.themeInfo);
    return data;
  }, [applyThemeInfo]);

  useEffect(() => {
    let active = true;
    const token = (() => {
      try {
        return localStorage.getItem(TOKEN_KEY);
      } catch {
        return null;
      }
    })();

    if (!token) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    api
      .get('/auth/me')
      .then(({ data }) => {
        if (!active) return;
        setUser(data.user);
        applyThemeInfo(data.themeInfo);
      })
      .catch(() => {
        if (!active) return;
        clearToken();
        setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [applyThemeInfo, clearToken]);

  const login = useCallback(
    async (email, password) => {
      const deviceMeta = await getDeviceMeta();
      const { data } = await api.post('/auth/login', { email, password, deviceMeta });
      if (!data.requiresOtp) storeSession(data);
      return data;
    },
    [storeSession]
  );

  const verifyOtp = useCallback(
    async ({ challengeId, otp, rememberDevice, deviceMeta }) => {
      const meta = deviceMeta || (await getDeviceMeta());
      const { data } = await api.post('/auth/verify-otp', {
        challengeId,
        otp,
        rememberDevice,
        deviceMeta: meta
      });
      storeSession(data);
      return data;
    },
    [storeSession]
  );

  const resendOtp = useCallback(async ({ challengeId, channel }) => {
    const deviceMeta = await getDeviceMeta();
    const { data } = await api.post('/auth/resend-otp', { challengeId, channel, deviceMeta });
    return data;
  }, []);

  const register = useCallback(async (payload) => {
    const deviceMeta = await getDeviceMeta();
    const { data } = await api.post('/auth/register', { ...payload, deviceMeta });
    if (data?.token) storeSession(data);
    return data;
  }, [storeSession]);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Even if the API is unreachable, clear the local session.
    } finally {
      clearToken();
      setUser(null);
    }
  }, [clearToken]);

  const forceLogout = useCallback(() => {
    clearToken();
    setUser(null);
  }, [clearToken]);

  const updateUser = useCallback((nextUser) => {
    setUser((current) => ({ ...current, ...nextUser }));
  }, []);

  const value = useMemo(
    () => ({
      user,
      token: localStorage.getItem(TOKEN_KEY),
      loading,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === 'admin',
      login,
      verifyOtp,
      resendOtp,
      register,
      logout,
      forceLogout,
      refreshUser,
      setUser,
      updateUser
    }),
    [user, loading, login, verifyOtp, resendOtp, register, logout, forceLogout, refreshUser, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
