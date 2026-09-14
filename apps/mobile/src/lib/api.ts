import { apiBase } from './config';
import { secureStorage } from './storage';

const ACCESS_KEY = 'st.accessToken';
const REFRESH_KEY = 'st.refreshToken';

export interface ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;
}

function apiError(status: number, code: string, message: string, details?: unknown): ApiError {
  const error = new Error(message) as ApiError;
  error.name = 'ApiError';
  error.code = code;
  error.status = status;
  error.details = details;
  return error;
}

/**
 * Reachability.
 *
 * The app has no background connectivity probe: instead every request reports
 * whether it reached the API, which is the signal the offline banner needs.
 */
type ReachabilityListener = (online: boolean) => void;

const reachabilityListeners = new Set<ReachabilityListener>();
let online = true;

function setOnline(next: boolean): void {
  if (online === next) return;
  online = next;
  for (const listener of reachabilityListeners) listener(next);
}

export const reachability = {
  get online(): boolean {
    return online;
  },
  subscribe(listener: ReachabilityListener): () => void {
    reachabilityListeners.add(listener);
    return () => reachabilityListeners.delete(listener);
  },
};

/**
 * The language the user picked, mirrored here so every request can carry it.
 * The API needs it to return editorial content in the right language, not just
 * the interface strings the app translates itself.
 *
 * Seeded from the device language at module load: the first queries fire before
 * any provider effect runs, and a request that went out in the wrong language
 * would be answered from cache rather than refetched. The stored preference
 * replaces it as soon as the i18n provider reads it.
 */

/**
 * Transport-level failures never reach the server, so they carry no message
 * from it — these are the only strings the client has to supply itself.
 */
const TRANSPORT_MESSAGES = {
  timeout: 'The request timed out',
  network: 'Network error',
  unknown: 'The request failed',
} as const;

function transportMessage(key: keyof typeof TRANSPORT_MESSAGES): string {
  return TRANSPORT_MESSAGES[key];
}

/** In-memory mirror so the hot path never awaits the Keychain. */
let accessToken: string | null = null;
let refreshToken: string | null = null;

export const tokens = {
  async load(): Promise<void> {
    accessToken = await secureStorage.get(ACCESS_KEY);
    refreshToken = await secureStorage.get(REFRESH_KEY);
  },
  get access(): string | null {
    return accessToken;
  },
  get refresh(): string | null {
    return refreshToken;
  },
  async set(access: string, refresh: string): Promise<void> {
    accessToken = access;
    refreshToken = refresh;
    await Promise.all([
      secureStorage.set(ACCESS_KEY, access),
      secureStorage.set(REFRESH_KEY, refresh),
    ]);
  },
  async clear(): Promise<void> {
    accessToken = null;
    refreshToken = null;
    await Promise.all([secureStorage.remove(ACCESS_KEY), secureStorage.remove(REFRESH_KEY)]);
  },
};

let refreshInFlight: Promise<boolean> | null = null;

async function rotate(): Promise<boolean> {
  if (!refreshToken) return false;
  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(`${apiBase}/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) {
        await tokens.clear();
        return false;
      }
      const body = (await response.json()) as {
        tokens: { accessToken: string; refreshToken: string };
      };
      await tokens.set(body.tokens.accessToken, body.tokens.refreshToken);
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
  timeoutMs?: number;
  retried?: boolean;
}

/**
 * Typed API client with a request timeout, one transparent token rotation on a
 * 401, and a typed error envelope.
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, auth = true, timeoutMs = 15_000, retried = false, headers, ...rest } = options;

  const requestHeaders: Record<string, string> = {
    accept: 'application/json',
    ...(headers as Record<string, string>),
  };
  if (body !== undefined) requestHeaders['content-type'] = 'application/json';
  if (auth && accessToken) requestHeaders.authorization = `Bearer ${accessToken}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...rest,
      headers: requestHeaders,
      signal: controller.signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    const aborted = (error as Error).name === 'AbortError';
    setOnline(false);
    throw apiError(
      0,
      aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
      transportMessage(aborted ? 'timeout' : 'network'),
    );
  } finally {
    clearTimeout(timer);
  }

  setOnline(true);

  if (response.status === 401 && auth && !retried && refreshToken) {
    if (await rotate()) return api<T>(path, { ...options, retried: true });
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const envelope = payload as { error?: { code?: string; message?: string; details?: unknown } };
    throw apiError(
      response.status,
      envelope?.error?.code ?? 'UNKNOWN',
      envelope?.error?.message ?? transportMessage('unknown'),
      envelope?.error?.details,
    );
  }

  return payload as T;
}
