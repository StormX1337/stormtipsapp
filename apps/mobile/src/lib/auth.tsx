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
import { api, tokens } from './api';
import { cache } from './storage';
import { registerPushToken, unregisterPushToken } from './notifications';

interface AuthValue {
  user: UserDTO | null;
  ready: boolean;
  products: Set<ProductCode>;
  has: (product: ProductCode) => boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    displayName?: string;
    referralCode?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): ReactNode {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [ready, setReady] = useState(false);
  const queryClient = useQueryClient();

  const loadProfile = useCallback(async () => {
    if (!tokens.access) {
      setUser(null);
      return;
    }
    try {
      setUser(await api<UserDTO>('/me'));
    } catch {
      await tokens.clear();
      setUser(null);
    }
  }, []);

  // Restore the session from the Keychain before the first render of a screen.
  useEffect(() => {
    void (async () => {
      await tokens.load();
      await loadProfile();
      setReady(true);
    })();
  }, [loadProfile]);

  const applySession = useCallback(
    async (response: AuthResponseDTO) => {
      await tokens.set(response.tokens.accessToken, response.tokens.refreshToken);
      setUser(response.user);
      await queryClient.invalidateQueries();
      // Registering the push token after login ties the device to the account.
      void registerPushToken();
    },
    [queryClient],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      await applySession(
        await api<AuthResponseDTO>('/auth/login', {
          method: 'POST',
          auth: false,
          body: { email, password, deviceName: 'PROFIT TIPS App' },
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
    }) => {
      await applySession(
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
    await unregisterPushToken();
    try {
      await api('/auth/logout', { method: 'POST', body: { refreshToken: tokens.refresh } });
    } catch {
      // A local logout must always succeed.
    }
    await tokens.clear();
    await cache.clear();
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

  const value = useMemo<AuthValue>(
    () => ({
      user,
      ready,
      products,
      has: (product) => products.has(product),
      login,
      register,
      logout,
      refresh: loadProfile,
    }),
    [user, ready, products, login, register, logout, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
