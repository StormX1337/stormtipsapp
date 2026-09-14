import { AppError, ErrorCode } from '@storm-tips/types';

export interface HttpClientOptions {
  baseUrl: string;
  apiKey?: string | null;
  /** Header the vendor expects the key in. */
  apiKeyHeader?: string;
  /** Query parameter the vendor expects the key in (used instead of a header). */
  apiKeyQueryParam?: string;
  timeoutMs?: number;
  rateLimitPerMinute?: number;
  maxRetries?: number;
  fetchImpl?: typeof fetch;
  defaultHeaders?: Record<string, string>;
}

/**
 * Minimal HTTP client for vendor APIs.
 *
 * Handles the three things every adapter needs and no more: a token-bucket rate
 * limit so we never trip a vendor quota, a request timeout, and bounded
 * exponential-backoff retries for 429/5xx.
 */
export class HttpClient {
  private readonly options: Required<
    Omit<HttpClientOptions, 'apiKey' | 'apiKeyQueryParam' | 'defaultHeaders'>
  > &
    Pick<HttpClientOptions, 'apiKey' | 'apiKeyQueryParam' | 'defaultHeaders'>;

  private tokens: number;
  private lastRefill = Date.now();
  private lastQuotaRemaining: number | null = null;

  constructor(options: HttpClientOptions) {
    this.options = {
      baseUrl: options.baseUrl.replace(/\/+$/, ''),
      apiKey: options.apiKey ?? null,
      apiKeyHeader: options.apiKeyHeader ?? 'x-api-key',
      apiKeyQueryParam: options.apiKeyQueryParam,
      timeoutMs: options.timeoutMs ?? 12_000,
      rateLimitPerMinute: options.rateLimitPerMinute ?? 60,
      maxRetries: options.maxRetries ?? 3,
      fetchImpl: options.fetchImpl ?? globalThis.fetch,
      defaultHeaders: options.defaultHeaders,
    };
    this.tokens = this.options.rateLimitPerMinute;
  }

  get quotaRemaining(): number | null {
    return this.lastQuotaRemaining;
  }

  private async takeToken(): Promise<void> {
    const refillPerMs = this.options.rateLimitPerMinute / 60_000;
    const now = Date.now();
    this.tokens = Math.min(
      this.options.rateLimitPerMinute,
      this.tokens + (now - this.lastRefill) * refillPerMs,
    );
    this.lastRefill = now;
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    const waitMs = Math.ceil((1 - this.tokens) / refillPerMs);
    await delay(waitMs);
    this.tokens = 0;
  }

  async get<T>(path: string, query: Record<string, string | number | undefined> = {}): Promise<T> {
    const url = new URL(`${this.options.baseUrl}${path.startsWith('/') ? path : `/${path}`}`);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
    if (this.options.apiKeyQueryParam && this.options.apiKey) {
      url.searchParams.set(this.options.apiKeyQueryParam, this.options.apiKey);
    }

    const headers: Record<string, string> = {
      accept: 'application/json',
      'user-agent': 'StormTips/1.0 (+https://stormtips.app)',
      ...this.options.defaultHeaders,
    };
    if (this.options.apiKey && !this.options.apiKeyQueryParam) {
      headers[this.options.apiKeyHeader] = this.options.apiKey;
    }

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.options.maxRetries; attempt += 1) {
      await this.takeToken();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
      try {
        const response = await this.options.fetchImpl(url, {
          headers,
          signal: controller.signal,
        });
        this.readQuotaHeaders(response);

        if (response.ok) {
          return (await response.json()) as T;
        }
        if (response.status === 429 || response.status >= 500) {
          lastError = new Error(`Provider responded ${response.status}`);
          const retryAfter = Number(response.headers.get('retry-after'));
          await delay(
            Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoffMs(attempt),
          );
          continue;
        }
        const body = await safeText(response);
        throw new AppError(
          ErrorCode.PROVIDER_ERROR,
          `Provider request failed (${response.status})`,
          { status: response.status, body: body.slice(0, 500) },
        );
      } catch (error) {
        if (error instanceof AppError) throw error;
        lastError = error;
        if (attempt === this.options.maxRetries) break;
        await delay(backoffMs(attempt));
      } finally {
        clearTimeout(timer);
      }
    }

    throw new AppError(ErrorCode.PROVIDER_ERROR, 'Provider request failed after retries', {
      cause: lastError instanceof Error ? lastError.message : String(lastError),
    });
  }

  private readQuotaHeaders(response: Response): void {
    const header =
      response.headers.get('x-requests-remaining') ??
      response.headers.get('x-ratelimit-remaining') ??
      response.headers.get('ratelimit-remaining');
    if (header !== null) {
      const value = Number(header);
      this.lastQuotaRemaining = Number.isFinite(value) ? value : null;
    }
  }
}

function backoffMs(attempt: number): number {
  const base = 2 ** attempt * 250;
  return base + Math.floor(Math.random() * 200);
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}
