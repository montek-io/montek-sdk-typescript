import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AuthError,
  ConnectionError,
  Montek,
  MontekError,
  NoPlanError,
  RateLimitError,
  ServerError,
  ValidationError,
} from '../src/index.js';
import { json, mockClient } from './helpers.js';

const err = (status: number, code: string, headers: Record<string, string> = {}) =>
  json({ error: { code, message: `${code} happened` } }, status, headers);

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('Montek client', () => {
  it('reads MONTEK_API_KEY and requires a key', () => {
    vi.stubEnv('MONTEK_API_KEY', 'mk_live_env');
    expect(() => new Montek()).not.toThrow();
    vi.stubEnv('MONTEK_API_KEY', '');
    expect(() => new Montek()).toThrow(/Missing API key/);
  });

  it('refuses live keys in a browser', async () => {
    vi.stubGlobal('document', {});
    const { Montek: BrowserMontek } = await import('../src/index.js');
    expect(() => new BrowserMontek({ apiKey: 'mk_live_x' })).toThrow(/mk_test_/);
    expect(() => new BrowserMontek({ apiKey: 'mk_test_x' })).not.toThrow();
  });

  it.each([
    [401, AuthError],
    [403, AuthError],
    [402, NoPlanError],
    [400, ValidationError],
    [413, ValidationError],
    [415, ValidationError],
  ])('maps %i to %o without retrying', async (status, ErrorClass) => {
    const { client, fetch } = mockClient([err(status, 'some_code')]);
    const e = await client.request('GET', '/v1/models').catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErrorClass);
    expect(e).toBeInstanceOf(MontekError);
    expect(e).toMatchObject({ status, code: 'some_code', message: 'some_code happened' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries 429 after Retry-After with the same Idempotency-Key', async () => {
    const { client, calls } = mockClient([err(429, 'rate_limited', { 'retry-after': '0' }), json({ ok: true })]);
    await expect(client.request('POST', '/v1/extract', { body: { url: 'u' } })).resolves.toEqual({ ok: true });
    expect(calls).toHaveLength(2);
    expect(calls[1]!.headers.get('idempotency-key')).toBe(calls[0]!.headers.get('idempotency-key'));
    expect(await calls[1]!.json()).toEqual({ url: 'u' });
  });

  it('waits out Retry-After before retrying', async () => {
    vi.useFakeTimers();
    const { client, fetch } = mockClient([err(429, 'rate_limited', { 'retry-after': '3' }), json({ ok: true })]);
    const p = client.request('GET', '/v1/models');
    await vi.advanceTimersByTimeAsync(2900);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(200);
    await expect(p).resolves.toEqual({ ok: true });
  });

  it('throws RateLimitError right away when Retry-After is too long', async () => {
    const { client, fetch } = mockClient([err(429, 'rate_limited', { 'retry-after': '3600' })]);
    const e = await client.request('GET', '/v1/models').catch((x: unknown) => x);
    expect(e).toBeInstanceOf(RateLimitError);
    expect((e as RateLimitError).retryAfter).toBe(3600);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries 5xx with backoff, then throws ServerError', async () => {
    vi.useFakeTimers();
    const { client, fetch } = mockClient([err(500, 'internal'), err(502, 'bad_gateway'), err(503, 'unavailable')]);
    const p = client.request('GET', '/v1/models').catch((x: unknown) => x);
    await vi.advanceTimersByTimeAsync(10_000);
    const e = await p;
    expect(e).toBeInstanceOf(ServerError);
    expect(e).toMatchObject({ status: 503, code: 'unavailable' });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('retries network errors, then throws ConnectionError', async () => {
    vi.useFakeTimers();
    const { client, fetch } = mockClient([new TypeError('fetch failed'), new TypeError('fetch failed')], { maxRetries: 1 });
    const p = client.request('GET', '/v1/models').catch((x: unknown) => x);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await p).toBeInstanceOf(ConnectionError);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('recovers when a retry succeeds', async () => {
    const { client } = mockClient([new TypeError('fetch failed'), json({ data: [] })]);
    await expect(client.request('GET', '/v1/models')).resolves.toEqual({ data: [] });
  });

  it('keeps a non-JSON error body as the message', async () => {
    const { client } = mockClient([new Response('upstream exploded', { status: 404 })]);
    await expect(client.request('GET', '/v1/x')).rejects.toMatchObject({ status: 404, code: undefined, message: 'upstream exploded' });
  });

  it('sends query params and no Idempotency-Key on GET', async () => {
    const { client, calls } = mockClient([json({})]);
    await client.request('GET', '/v1/usage', { query: { from: '2026-10-01', model: undefined } });
    expect(calls[0]!.url).toBe('https://api.test/v1/usage?from=2026-10-01');
    expect(calls[0]!.headers.get('idempotency-key')).toBeNull();
  });
});
