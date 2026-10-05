import { camelize } from './casing.js';
import { ConnectionError, MontekError, errorFromResponse, retryAfterSeconds } from './errors.js';
import { extract } from './resources/extract.js';
import { env, isBrowser, webCrypto } from './runtime.js';
import type { ExtractParams, ExtractResult } from './types.js';

export interface ClientOptions {
  /** Defaults to the `MONTEK_API_KEY` environment variable. */
  apiKey?: string | undefined;
  /** Defaults to `https://api.montek.io`. */
  baseURL?: string | undefined;
  /** Retries for 429, 5xx and network errors. Defaults to 2. */
  maxRetries?: number | undefined;
  /** Per-attempt timeout in ms. Defaults to 60 000. */
  timeout?: number | undefined;
  /** A custom `fetch`, e.g. for proxies or tests. Defaults to the global one. */
  fetch?: typeof fetch | undefined;
}

interface RequestOptions {
  query?: Record<string, string | undefined>;
  body?: FormData | Record<string, unknown>;
}

/** Longest `Retry-After` the client waits out; beyond it the error is thrown right away. */
const MAX_RETRY_AFTER_S = 60;

export class Montek {
  readonly baseURL: string;
  readonly maxRetries: number;
  readonly timeout: number;
  readonly #apiKey: string;
  readonly #fetch: typeof fetch;

  constructor(options: ClientOptions = {}) {
    const apiKey = options.apiKey ?? env('MONTEK_API_KEY');
    if (!apiKey) throw new MontekError('Missing API key: pass `new Montek({ apiKey })` or set MONTEK_API_KEY.');
    if (isBrowser && !apiKey.startsWith('mk_test_')) {
      throw new MontekError('Only mk_test_ keys may be used in a browser; call the API from your server with live keys.');
    }
    this.#apiKey = apiKey;
    this.baseURL = (options.baseURL ?? 'https://api.montek.io').replace(/\/+$/, '');
    this.maxRetries = options.maxRetries ?? 2;
    this.timeout = options.timeout ?? 60_000;
    this.#fetch = options.fetch ?? ((...args) => fetch(...args));
  }

  /** Read a business document (image or PDF; the server splits pages) into fields, boxes and line items. */
  extract(params: ExtractParams): Promise<ExtractResult> {
    return extract(this, params);
  }

  /**
   * Call an endpoint: retries 429/5xx/network errors with backoff (honouring `Retry-After`),
   * sends one `Idempotency-Key` across the retries of a POST, and camelCases the JSON response.
   */
  async request<T>(method: 'GET' | 'POST', path: string, { query, body }: RequestOptions = {}): Promise<T> {
    const url = new URL(this.baseURL + path);
    for (const [key, value] of Object.entries(query ?? {})) if (value !== undefined) url.searchParams.set(key, value);

    const headers: Record<string, string> = { Authorization: `Bearer ${this.#apiKey}`, Accept: 'application/json' };
    if (method === 'POST') headers['Idempotency-Key'] = (await webCrypto()).randomUUID();
    let payload: BodyInit | undefined;
    if (body instanceof FormData) payload = body;
    else if (body) {
      payload = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
    }

    for (let attempt = 0; ; attempt++) {
      const retriesLeft = attempt < this.maxRetries;
      let res: Response;
      try {
        res = await this.#fetch(url, { method, headers, body: payload ?? null, signal: AbortSignal.timeout(this.timeout) });
      } catch (err) {
        if (retriesLeft) {
          await sleep(backoff(attempt));
          continue;
        }
        const reason = (err as Error).name === 'TimeoutError' ? `timed out after ${this.timeout} ms` : String(err);
        throw new ConnectionError(`${method} ${path} failed: ${reason}`);
      }
      if (res.ok) return camelize(await res.json()) as T;

      const retryable = res.status === 429 || res.status >= 500;
      const retryAfter = retryAfterSeconds(res.headers);
      if (retryable && retriesLeft && (retryAfter ?? 0) <= MAX_RETRY_AFTER_S) {
        await res.body?.cancel();
        await sleep(retryAfter !== undefined ? retryAfter * 1000 : backoff(attempt));
        continue;
      }
      throw await errorFromResponse(res);
    }
  }
}

/** Exponential backoff with jitter: ~0.5 s, 1 s, 2 s … capped at 8 s. */
function backoff(attempt: number): number {
  return Math.min(500 * 2 ** attempt, 8000) * (0.75 + Math.random() * 0.25);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
