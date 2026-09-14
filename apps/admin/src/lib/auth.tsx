'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthResponseDTO, UserDTO, UserRole } from '@storm-tips/types';
import { ROLE_RANK } from '@storm-tips/types';
import { api, tokenStore } from './api';

interface AdminAuthValue {
  user: UserDTO | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (role: UserRole) => boolean;
}

const AdminAuthContext = createContext<AdminAuthValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }): ReactNode {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!tokenStore.access) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const profile = await api<UserDTO>('/me');
      // The console is staff-only; a customer token must not open it.
      setUser(ROLE_RANK[profile.role] >= ROLE_RANK.MODERATOR ? profile : null);
    } catch {
      tokenStore.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api<AuthResponseDTO>('/auth/login', {
      method: 'POST',
      auth: false,
      body: { email, password },
    });
    if (ROLE_RANK[response.user.role] < ROLE_RANK.MODERATOR) {
      throw new Error('This account has no access to the admin console.');
    }
    tokenStore.set(response.tokens.accessToken, response.tokens.refreshToken);
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST', body: { allDevices: false } });
    } catch {
      // Local logout always succeeds.
    }
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo<AdminAuthValue>(
    () => ({
      user,
      loading,
      login,
      logout,
      can: (role) => (user ? ROLE_RANK[user.role] >= ROLE_RANK[role] : false),
    }),
    [user, loading, login, logout],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthValue {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error('useAdminAuth must be used inside <AdminAuthProvider>');
  return context;
}
