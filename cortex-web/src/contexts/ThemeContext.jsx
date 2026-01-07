import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'cortex_theme_mode';
const isBrowser = typeof window !== 'undefined' && typeof window.matchMedia === 'function';

const ThemeContext = createContext(null);

const getInitialPreference = () => {
  const value = localStorage.getItem(STORAGE_KEY);
  if (value === 'light' || value === 'dark' || value === 'system') return value;
  return 'system';
};

export const ThemeProviderLocal = ({ children }) => {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [themePreference, setThemePreferenceState] = useState(getInitialPreference);
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => {
    if (!isBrowser) return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const setThemeMode = (mode) => {
    const normalized = mode === 'light' || mode === 'dark' || mode === 'system' ? mode : 'system';
    setThemePreferenceState(normalized);
    localStorage.setItem(STORAGE_KEY, normalized);
  };

  useEffect(() => {
    if (!isBrowser) return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event) => {
      setSystemPrefersDark(event.matches);
    };
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    }
    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  const themeMode = themePreference === 'system'
    ? (systemPrefersDark ? 'dark' : 'light')
    : themePreference;

  const toggleTheme = () => {
    setThemeMode(themeMode === 'dark' ? 'light' : 'dark');
  };

  const value = useMemo(
    () => ({
      reducedMotion,
      setReducedMotion,
      themeMode,
      themePreference,
      setThemeMode,
      toggleTheme
    }),
    [reducedMotion, themeMode, themePreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useThemeLocal = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeLocal must be used within ThemeProviderLocal');
  return ctx;
};
