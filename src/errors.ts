/** Base class of every error the SDK throws. `status` and `code` come from the API's `{error:{code,message}}`. */
export class MontekError extends Error {
  readonly status: number | undefined;
  readonly code: string | undefined;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
  }
}

/** 401/403: missing, wrong or revoked key. */
export class AuthError extends MontekError {}

/** 402: no plan for this model, overage cap reached, or payment past due. */
export class NoPlanError extends MontekError {}

/** 429 after the retries ran out. `retryAfter` is in seconds when the API sent `Retry-After`. */
export class RateLimitError extends MontekError {
  constructor(message: string, status: number, code: string | undefined, readonly retryAfter: number | undefined) {
    super(message, status, code);
  }
}

/** Other 4xx: bad input, file too large (413), unsupported type (415), unknown id (404)… */
export class ValidationError extends MontekError {}

/** 5xx after the retries ran out. */
export class ServerError extends MontekError {}

/** No HTTP response: network failure or timeout, after the retries ran out. */
export class ConnectionError extends MontekError {}

export async function errorFromResponse(res: Response): Promise<MontekError> {
  const text = await res.text().catch(() => '');
  let code: string | undefined;
  let message = text || res.statusText || `HTTP ${res.status}`;
  try {
    const body = JSON.parse(text) as { error?: { code?: string; message?: string } };
    code = body.error?.code;
    message = body.error?.message ?? message;
  } catch {
    // Not JSON: keep the raw text.
  }
  const { status } = res;
  if (status === 401 || status === 403) return new AuthError(message, status, code);
  if (status === 402) return new NoPlanError(message, status, code);
  if (status === 429) return new RateLimitError(message, status, code, retryAfterSeconds(res.headers));
  if (status >= 500) return new ServerError(message, status, code);
  return new ValidationError(message, status, code);
}

/** `Retry-After` as seconds (it may be a number of seconds or an HTTP date). */
export function retryAfterSeconds(headers: Headers): number | undefined {
  const value = headers.get('retry-after');
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, (date - Date.now()) / 1000);
}
