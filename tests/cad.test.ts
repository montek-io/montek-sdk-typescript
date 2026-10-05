import { afterEach, describe, expect, it, vi } from 'vitest';
import { JobFailedError, MontekError } from '../src/index.js';
import { json, mockClient } from './helpers.js';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]);
const times = { created_at: '2026-10-05T09:00:00.000Z', finished_at: null };
const done = {
  id: 'cad_1',
  model: 'fansipan-cad-1.0',
  status: 'succeeded',
  created_at: '2026-10-05T09:00:00.000Z',
  finished_at: '2026-10-05T09:01:12.000Z',
  parts: [{ name: 'Bracket', dxf_url: 'https://api.test/v1/cad/cad_1/parts/1', bbox: [0, 0, 80, 40] }],
  usage: { unit: 'part', count: 1 },
};

afterEach(() => vi.useRealTimers());

describe('cad', () => {
  it('creates a job with a webhook URL and polls it with backoff until it succeeds', async () => {
    vi.useFakeTimers();
    const { client, calls } = mockClient([
      json({ id: 'cad_1', model: 'fansipan-cad-1.0', status: 'queued', ...times }, 202),
      json({ id: 'cad_1', model: 'fansipan-cad-1.0', status: 'running', ...times }),
      json(done),
    ]);
    const job = await client.cad.create({ file: PNG, model: 'fansipan-cad-1.0', webhookUrl: 'https://me.test/hook' });
    expect([job.id, job.status]).toEqual(['cad_1', 'queued']);
    const form = await calls[0]!.formData();
    expect(form.get('webhook_url')).toBe('https://me.test/hook');
    expect(calls[0]!.headers.get('idempotency-key')).toBeTruthy();

    const p = job.wait();
    await vi.advanceTimersByTimeAsync(1000); // first poll after 1 s
    expect(calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1400); // next after 1.5 s
    expect(calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(100);
    const result = await p;

    expect(calls.slice(1).map((c) => `${c.method} ${c.url}`)).toEqual(Array(2).fill('GET https://api.test/v1/cad/cad_1'));
    expect(result.parts[0]!.dxfUrl).toBe('https://api.test/v1/cad/cad_1/parts/1');
    expect(result.finishedAt).toBe('2026-10-05T09:01:12.000Z');
    expect(result.usage.count).toBe(1);
    expect(job.status).toBe('succeeded');
  });

  it('get() returns a job that is already finished', async () => {
    const { client, fetch } = mockClient([json(done)]);
    const job = await client.cad.get('cad_1');
    await expect(job.wait()).resolves.toMatchObject({ status: 'succeeded' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('getPart() downloads one part as DXF text', async () => {
    const dxf = '0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n';
    const { client, calls } = mockClient([new Response(dxf, { headers: { 'content-type': 'application/dxf' } })]);
    await expect(client.cad.getPart('cad_1', 1)).resolves.toBe(dxf);
    expect(`${calls[0]!.method} ${calls[0]!.url}`).toBe('GET https://api.test/v1/cad/cad_1/parts/1');
    expect(calls[0]!.headers.get('authorization')).toBe('Bearer mk_test_abc');
  });

  it('throws JobFailedError with the job error', async () => {
    const { client } = mockClient([json({ id: 'cad_2', status: 'failed', error: { code: 'unreadable_sketch', message: 'Sketch too blurry' } })]);
    const e = await (await client.cad.get('cad_2')).wait().catch((x: unknown) => x);
    expect(e).toBeInstanceOf(JobFailedError);
    expect(e).toMatchObject({ code: 'unreadable_sketch', message: 'Sketch too blurry', job: { id: 'cad_2' } });
  });

  it('gives up after the timeout', async () => {
    vi.useFakeTimers();
    const { client } = mockClient([json({ id: 'cad_3', status: 'running' }), ...Array.from({ length: 5 }, () => () => json({ id: 'cad_3', status: 'running' }))]);
    const job = await client.cad.get('cad_3');
    const p = job.wait({ timeout: 3000 }).catch((x: unknown) => x);
    await vi.advanceTimersByTimeAsync(5000);
    const e = await p;
    expect(e).toBeInstanceOf(MontekError);
    expect((e as Error).message).toMatch(/still running after 3000 ms/);
  });
});
