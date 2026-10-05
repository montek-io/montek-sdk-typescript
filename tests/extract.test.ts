import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { json, mockClient } from './helpers.js';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const PDF = new TextEncoder().encode('%PDF-1.7\n...');

const result = {
  id: 'ext_1',
  model: 'langbiang-extract-1.0',
  pages: 1,
  fields: [{ key: 'order_number', label: '注文番号', value: 'PO-123', box: [0.1, 0.1, 0.2, 0.05], unsure: false, page: 1 }],
  line_items: [{ page: 1, box: [0.1, 0.4, 0.8, 0.03], cells: [{ key: 'item', label: '品名', value: 'ボルト M8' }], unsure: false }],
  comment: 'ok',
  refs: ['order_number'],
  usage: { unit: 'page', count: 1 },
};

describe('extract', () => {
  it('uploads bytes as multipart and camelCases the result', async () => {
    const { client, calls } = mockClient([json(result)]);
    const r = await client.extract({ file: Buffer.from(PNG), model: 'langbiang-extract-1.0', lang: 'ja', fields: ['order_number', 'total'] });

    const req = calls[0]!;
    expect(req.method).toBe('POST');
    expect(req.url).toBe('https://api.test/v1/extract');
    expect(req.headers.get('authorization')).toBe('Bearer mk_test_abc');
    expect(req.headers.get('idempotency-key')).toMatch(/^[0-9a-f-]{36}$/);
    const form = await req.formData();
    const file = form.get('file') as File;
    expect(file.type).toBe('image/png');
    expect(file.name).toBe('file');
    expect(form.get('model')).toBe('langbiang-extract-1.0');
    expect(form.get('lang')).toBe('ja');
    expect(form.getAll('fields')).toEqual(['order_number', 'total']);

    expect(r.lineItems[0]!.cells).toEqual([{ key: 'item', label: '品名', value: 'ボルト M8' }]);
    expect(r.fields[0]!.value).toBe('PO-123');
    expect(r.usage).toEqual({ unit: 'page', count: 1 });
  });

  it('reads a file path and keeps its name', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'montek-'));
    const path = join(dir, 'order.pdf');
    await writeFile(path, PDF);
    const { client, calls } = mockClient([json(result)]);
    await client.extract({ file: path, model: 'langbiang-extract-1.0' });

    const file = (await calls[0]!.formData()).get('file') as File;
    expect(file.name).toBe('order.pdf');
    expect(file.type).toBe('application/pdf');
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(PDF);
  });

  it('keeps the type and name of a File', async () => {
    const { client, calls } = mockClient([json(result)]);
    await client.extract({ file: new File([PNG], 'fax.webp', { type: 'image/webp' }), model: 'm' });
    const file = (await calls[0]!.formData()).get('file') as File;
    expect([file.name, file.type]).toEqual(['fax.webp', 'image/webp']);
  });

  it('sends a URL as JSON instead of uploading', async () => {
    const { client, calls } = mockClient([json(result), json(result)]);
    await client.extract({ file: new URL('https://example.com/fax.pdf'), model: 'm', question: 'total?' });
    await client.extract({ file: 'https://example.com/b.png', model: 'm' });

    expect(calls[0]!.headers.get('content-type')).toBe('application/json');
    expect(await calls[0]!.json()).toEqual({ url: 'https://example.com/fax.pdf', model: 'm', question: 'total?' });
    expect(await calls[1]!.json()).toEqual({ url: 'https://example.com/b.png', model: 'm' });
  });
});
