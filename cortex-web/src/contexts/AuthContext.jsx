import React, { createContext, useContext, useMemo, useState } from 'react';
import { toast } from 'react-toastify';

import { authService } from '../services/api/authService';
import { clearSession, loadSession, saveSession } from '../services/api/tokenStorage';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(() => loadSession());

  const isAuthenticated = Boolean(session?.accessToken);
  const user = session?.user || null;
  const roles = Array.isArray(session?.user?.roles) ? session.user.roles : [];

  const login = async (identifier, password) => {
    const res = await authService.login(identifier, password);
    if (!res?.success) {
      throw new Error(res?.error?.message || res?.message || 'Login failed');
    }

    const data = res.data;
    const next = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      refreshExpiresAt: data.refreshExpiresAt,
      user: data.user
    };

    saveSession(next);
    setSession(next);
    toast.success('Welcome back');
    return next.user;
  };

  const logout = async () => {
    try {
      if (session?.refreshToken) {
        await authService.logout(session.refreshToken);
      }
    } catch {
    }

    clearSession();
    setSession(null);
    toast.info('Logged out');
  };

  const businessSignup = async (payload) => {
    const res = await authService.createUser(payload);
    if (!res?.success) {
      throw new Error(res?.error?.message || res?.message || 'Signup failed');
    }
    return res.data;
  };

  const hasRole = (allowed) => {
    if (!allowed || allowed.length === 0) return true;
    return roles.some((r) => allowed.includes(r));
  };

  const value = useMemo(
    () => ({
      session,
      user,
      roles,
      isAuthenticated,
      login,
      logout,
      businessSignup,
      hasRole
    }),
    [session, user, roles, isAuthenticated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
