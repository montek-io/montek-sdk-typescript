import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyWebhook, WebhookSignatureError } from '../src/index.js';

const secret = 'whsec_test';
const payload = JSON.stringify({
  type: 'cad.succeeded',
  data: { id: 'cad_1', model: 'fansipan-cad-1.0', status: 'succeeded', created_at: 't0', finished_at: 't1', parts: [{ name: 'a', dxf_url: 'u', bbox: [0, 0, 1, 1] }], usage: { unit: 'part', count: 1 } },
});
const now = () => Math.floor(Date.now() / 1000);
const sign = (body: string, t = now(), key = secret) => createHmac('sha256', key).update(`${t}.${body}`).digest('hex');

afterEach(() => vi.unstubAllEnvs());

describe('verifyWebhook', () => {
  it('returns the camelCased event for a valid signature', async () => {
    const t = now();
    const event = await verifyWebhook(payload, `t=${t},v1=${sign(payload, t)}`, secret);
    expect(event.type).toBe('cad.succeeded');
    expect(event.data.parts?.[0]?.dxfUrl).toBe('u');
    expect(event.data.finishedAt).toBe('t1');
  });

  it('accepts raw bytes, the env secret, and any matching v1 during rotation', async () => {
    vi.stubEnv('MONTEK_WEBHOOK_SECRET', secret);
    const t = now();
    const header = `t=${t}, v1=${sign(payload, t, 'old_secret')}, v1=${sign(payload, t)}`;
    await expect(verifyWebhook(new TextEncoder().encode(payload), header)).resolves.toMatchObject({ type: 'cad.succeeded' });
  });

  it.each([
    ['a tampered body', (t: number) => `t=${t},v1=${sign(payload.replace('cad_1', 'cad_9'), t)}`],
    ['the wrong secret', (t: number) => `t=${t},v1=${sign(payload, t, 'nope')}`],
    ['a stale timestamp', (t: number) => `t=${t - 301},v1=${sign(payload, t - 301)}`],
    ['a malformed header', () => 'garbage'],
  ])('rejects %s', async (_, header) => {
    await expect(verifyWebhook(payload, header(now()), secret)).rejects.toBeInstanceOf(WebhookSignatureError);
  });

  it('rejects a missing header and requires a secret', async () => {
    await expect(verifyWebhook(payload, null, secret)).rejects.toBeInstanceOf(WebhookSignatureError);
    vi.stubEnv('MONTEK_WEBHOOK_SECRET', '');
    await expect(verifyWebhook(payload, 't=1,v1=00')).rejects.toThrow(/Missing webhook secret/);
  });
});
