import axios from 'axios';

import { AUTH_API_URL } from './env';
import { clearSession, getAccessToken, getRefreshToken, loadSession, saveSession } from './tokenStorage';

const refreshAccessToken = async () => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  const res = await axios.post(`${AUTH_API_URL}/api/v1/auth/refresh`, { refreshToken }, { timeout: 10000 });
  if (!res.data?.success) return null;

  const data = res.data.data;
  const existing = loadSession() || {};
  const updated = {
    ...existing,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    refreshExpiresAt: data.refreshExpiresAt
  };
  saveSession(updated);
  return updated.accessToken;
};

export const createApiClient = (baseURL, options = {}) => {
  const api = axios.create({
    baseURL,
    timeout: Number(options.timeout || 10000)
  });

  api.interceptors.request.use(
    (config) => {
      const token = getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const status = error?.response?.status;
      const original = error?.config;
      const errorCode = error?.response?.data?.error?.code;

      if (!original || original.__cortexRetry) {
        return Promise.reject(error);
      }

      const shouldForceLogout =
        status === 403 &&
        ['ACCOUNT_INACTIVE', 'ACCOUNT_LOCKED', 'USER_NOT_FOUND'].includes(errorCode);

      if (shouldForceLogout) {
        clearSession();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      const shouldAttemptRefresh =
        status === 401 ||
        (status === 403 && errorCode === 'INVALID_TOKEN');

      if (shouldAttemptRefresh) {
        original.__cortexRetry = true;
        try {
          const newAccessToken = await refreshAccessToken();
          if (!newAccessToken) {
            clearSession();
            if (window.location.pathname !== '/login') {
              window.location.href = '/login';
            }
            return Promise.reject(error);
          }

          original.headers = {
            ...(original.headers || {}),
            Authorization: `Bearer ${newAccessToken}`
          };
          return api.request(original);
        } catch (err) {
          clearSession();
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          return Promise.reject(err);
        }
      }

      return Promise.reject(error);
    }
  );

  return api;
};
