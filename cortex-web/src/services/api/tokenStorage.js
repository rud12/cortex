const STORAGE_KEY = 'cortex_session_v1';

export const loadSession = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const saveSession = (session) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
};

export const clearSession = () => {
  localStorage.removeItem(STORAGE_KEY);
};

export const getAccessToken = () => {
  const session = loadSession();
  return session?.accessToken || null;
};

export const getRefreshToken = () => {
  const session = loadSession();
  return session?.refreshToken || null;
};

export const getUser = () => {
  const session = loadSession();
  return session?.user || null;
};
