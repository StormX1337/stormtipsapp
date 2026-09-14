import { DEFAULT_LOCALE, resolveLocale } from '@storm-tips/ui';
import { apiBase } from './config';

const ACCESS_TOKEN_KEY = 'st.accessToken';
const REFRESH_TOKEN_KEY = 'st.refreshToken';

export interface ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;
}

function createApiError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): ApiError {
  const error = new Error(message) as ApiError;
  error.name = 'ApiError';
  error.code = code;
  error.status = status;
  error.details = details;
  return error;
}

/**
 * The language the user picked, mirrored here so every request can carry it.
 * The API needs it to return editorial content (products, plans, analyses) in
 * the right language, not just the interface strings the client translates.
 *
 * It is resolved at module load rather than from a React effect: the first
 * queries fire before any provider effect runs, and a request that went out in
 * the wrong language would be answered from cache rather than refetched.
 */
function initialLocale(): string {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    const stored = window.localStorage.getItem('st.locale');
    return resolveLocale(stored ?? window.navigator.language);
  } catch {
    return resolveLocale(window.navigator.language);
  }
}

let requestLocale: string = initialLocale();

export function setRequestLocale(locale: string): void {
  requestLocale = locale;
}

export const tokenStore = {
  get access(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  get refresh(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  set(accessToken: string, refreshToken: string): void {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    window.dispatchEvent(new Event('st:auth-changed'));
  },
  clear(): void {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.dispatchEvent(new Event('st:auth-changed'));
  },
};

/** Single-flight refresh so a burst of 401s triggers only one rotation. */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const refreshToken = tokenStore.refresh;
  if (!refreshToken) return false;

  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(`${apiBase}/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) {
        tokenStore.clear();
        return false;
      }
      const body = (await response.json()) as {
        tokens: { accessToken: string; refreshToken: string };
      };
      tokenStore.set(body.tokens.accessToken, body.tokens.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  auth?: boolean;
  /** Internal: prevents an endless refresh loop. */
  retried?: boolean;
}

/**
 * Typed API client.
 *
 * Attaches the access token, transparently rotates it once on a 401, and turns
 * the server's error envelope into a typed `ApiError`.
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, auth = true, retried = false, headers, ...rest } = options;

  const requestHeaders: Record<string, string> = {
    accept: 'application/json',
    'accept-language': requestLocale,
    ...(headers as Record<string, string>),
  };
  if (body !== undefined) requestHeaders['content-type'] = 'application/json';

  const token = auth ? tokenStore.access : null;
  if (token) requestHeaders.authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...rest,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw createApiError(0, 'NETWORK_ERROR', 'Network request failed');
  }

  if (response.status === 401 && auth && !retried && tokenStore.refresh) {
    if (await refreshTokens()) {
      return api<T>(path, { ...options, retried: true });
    }
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const envelope = payload as { error?: { code?: string; message?: string; details?: unknown } };
    throw createApiError(
      response.status,
      envelope?.error?.code ?? 'UNKNOWN',
      envelope?.error?.message ?? response.statusText,
      envelope?.error?.details,
    );
  }

  return payload as T;
}

/** Server-side fetch (React Server Components) — never sends a user token. */
export async function apiPublic<T>(path: string, revalidate = 60, locale = 'de'): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    headers: { accept: 'application/json', 'accept-language': locale },
    next: { revalidate },
  });
  if (!response.ok) {
    throw createApiError(response.status, 'UNKNOWN', `Request to ${path} failed`);
  }
  return (await response.json()) as T;
}
