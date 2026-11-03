import axios from 'axios';
import { getDeviceId } from './device.js';

export const TOKEN_KEY = 'streamtube_token';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch {
    // localStorage unavailable — requests will be anonymous.
  }
  config.headers['X-Device-Id'] = getDeviceId();
  return config;
});

export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  const data = error?.response?.data;
  if (data?.message) return data.message;
  if (error?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  if (error?.message === 'Network Error') return 'Cannot reach the server. Check that the API is running.';
  return fallback;
}

export function getErrorCode(error) {
  return error?.response?.data?.code || null;
}

export function getApiError(error, fallback = 'Something went wrong. Please try again.') {
  const data = error?.response?.data;
  if (data?.message) return data.message;
  if (error?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  if (error?.message === 'Network Error') return 'Cannot reach the server. Check that the API is running.';
  return fallback;
}

export default api;
