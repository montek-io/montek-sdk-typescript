import { camelize } from './casing.js';
import { MontekError, WebhookSignatureError } from './errors.js';
import { env, webCrypto } from './runtime.js';
import type { WebhookEvent } from './types.js';

/** Oldest signature timestamp accepted, against replays. */
const TOLERANCE_S = 5 * 60;

/**
 * Check a webhook from Montek and return its event.
 * `payload` is the raw request body (not re-serialised JSON), `signature` the `Montek-Signature` header
 * (`t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<payload>">`; several `v1` while a secret rotates).
 * `secret` defaults to the `MONTEK_WEBHOOK_SECRET` environment variable.
 * Throws `WebhookSignatureError` when the signature is missing, wrong or older than 5 minutes.
 */
export async function verifyWebhook(
  payload: string | Uint8Array,
  signature: string | null | undefined,
  secret: string | undefined = env('MONTEK_WEBHOOK_SECRET'),
): Promise<WebhookEvent> {
  if (!secret) throw new MontekError('Missing webhook secret: pass it or set MONTEK_WEBHOOK_SECRET.');
  const body = typeof payload === 'string' ? payload : new TextDecoder().decode(payload);

  let timestamp = NaN;
  const candidates: Uint8Array[] = [];
  for (const part of (signature ?? '').split(',')) {
    const [key, value = ''] = part.trim().split('=');
    if (key === 't') timestamp = Number(value);
    if (key === 'v1' && /^([0-9a-f]{2})+$/i.test(value)) {
      candidates.push(Uint8Array.from(value.match(/../g)!, (h) => parseInt(h, 16)));
    }
  }
  if (!Number.isFinite(timestamp) || candidates.length === 0) throw new WebhookSignatureError('Malformed Montek-Signature header');
  if (Math.abs(Date.now() / 1000 - timestamp) > TOLERANCE_S) throw new WebhookSignatureError('Webhook timestamp is too old');

  const { subtle } = await webCrypto();
  const encoder = new TextEncoder();
  const key = await subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const signed = encoder.encode(`${timestamp}.${body}`);
  for (const candidate of candidates) {
    // subtle.verify compares in constant time.
    if (await subtle.verify('HMAC', key, candidate as Uint8Array<ArrayBuffer>, signed)) {
      return camelize(JSON.parse(body)) as WebhookEvent;
    }
  }
  throw new WebhookSignatureError('Webhook signature does not match');
}
