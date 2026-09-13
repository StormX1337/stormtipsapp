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
import { useQueryClient } from '@tanstack/react-query';
import type { AuthResponseDTO, ProductCode, UserDTO } from '@profit-tips/types';
import { api, tokenStore } from './api';

interface AuthContextValue {
  user: UserDTO | null;
  loading: boolean;
  products: Set<ProductCode>;
  has: (product: ProductCode) => boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    displayName?: string;
    referralCode?: string;
    marketingOptIn?: boolean;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): ReactNode {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  const loadProfile = useCallback(async () => {
    if (!tokenStore.access) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setUser(await api<UserDTO>('/me'));
    } catch {
      // An unusable session is simply an anonymous one.
      tokenStore.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
    // Keep multiple tabs in sync.
    const handler = (): void => {
      void loadProfile();
    };
    window.addEventListener('pt:auth-changed', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('pt:auth-changed', handler);
      window.removeEventListener('storage', handler);
    };
  }, [loadProfile]);

  const applySession = useCallback(
    (response: AuthResponseDTO) => {
      tokenStore.set(response.tokens.accessToken, response.tokens.refreshToken);
      setUser(response.user);
      void queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      applySession(
        await api<AuthResponseDTO>('/auth/login', {
          method: 'POST',
          auth: false,
          body: { email, password },
        }),
      );
    },
    [applySession],
  );

  const register = useCallback(
    async (input: {
      email: string;
      password: string;
      displayName?: string;
      referralCode?: string;
      marketingOptIn?: boolean;
    }) => {
      applySession(
        await api<AuthResponseDTO>('/auth/register', {
          method: 'POST',
          auth: false,
          body: { ...input, acceptedTerms: true, ageConfirmed: true },
        }),
      );
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', {
        method: 'POST',
        body: { refreshToken: tokenStore.refresh ?? undefined },
      });
    } catch {
      // Logging out locally must succeed even if the request fails.
    }
    tokenStore.clear();
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const products = useMemo(() => {
    const set = new Set<ProductCode>(['FREE']);
    for (const entitlement of user?.entitlements ?? []) {
      if (entitlement.active) set.add(entitlement.product);
    }
    return set;
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      products,
      has: (product) => products.has(product),
      login,
      register,
      logout,
      refresh: loadProfile,
    }),
    [user, loading, products, login, register, logout, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
