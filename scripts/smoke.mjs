// Load the built package (ESM and CJS) and make one mocked call of each kind,
// to check dist/ works on the current runtime: node, `deno run -A` or `bun run`.
import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import * as esm from '../dist/index.js';

const cjs = createRequire(import.meta.url)('../dist/index.cjs');
const runtime = globalThis.Deno ? `deno ${Deno.version.deno}` : globalThis.Bun ? `bun ${Bun.version}` : `node ${process.version}`;
const routes = {
  'POST /v1/extract': { id: 'e', model: 'm', pages: 1, fields: [], line_items: [{ page: 1, cells: [], unsure: false }], comment: '', refs: [], usage: { unit: 'page', count: 1 } },
  'POST /v1/cad': { id: 'c', model: 'm', status: 'succeeded', created_at: 't0', finished_at: 't1', parts: [{ name: 'p', dxf_url: 'https://x/v1/cad/c/parts/1', bbox: [0, 0, 1, 1] }], usage: { unit: 'part', count: 1 } },
  'GET /v1/cad/c/parts/1': '0\nEOF\n',
  'GET /v1/models': { data: [{ id: 'm', endpoint: '/v1/extract', unit: 'page', description: '', plans: [] }] },
  'GET /v1/usage': { from: '2026-10-01', to: '2026-10-31', days: [], plans: [] },
  'GET /v1/me': { organization: { id: 'o', name: 'O' }, key: { id: 'k', mode: 'test', scopes: null }, webhook_secret: 'whsec', plans: [] },
};
const check = (ok, what) => { if (!ok) throw new Error(`smoke failed on ${runtime}: ${what}`); };

for (const [format, { Montek, verifyWebhook }] of Object.entries({ esm, cjs })) {
  const montek = new Montek({
    apiKey: 'mk_test_smoke',
    fetch: async (url, init) => {
      const { pathname } = new URL(url);
      const isPost = init.method === 'POST';
      check(!isPost || init.headers['Idempotency-Key'], 'Idempotency-Key');
      check(!isPost || (init.body instanceof FormData && init.body.get('file').type === 'application/pdf'), 'multipart file');
      const body = routes[`${init.method} ${pathname}`];
      return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: 200 });
    },
  });
  const pdf = new TextEncoder().encode('%PDF-1.7');
  check((await montek.extract({ file: pdf, model: 'm' })).lineItems[0].cells, `${format} extract`);
  check((await (await montek.cad.create({ file: pdf, model: 'm' })).wait()).finishedAt === 't1', `${format} cad`);
  check((await montek.cad.getPart('c', 1)) === '0\nEOF\n', `${format} cad part`);
  check((await montek.models.list())[0].endpoint === '/v1/extract', `${format} models`);
  check(Array.isArray((await montek.usage.get({ from: new Date() })).days), `${format} usage`);
  check((await montek.me()).webhookSecret === 'whsec', `${format} me`);

  const event = JSON.stringify({ type: 'cad.succeeded', data: routes['POST /v1/cad'] });
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', 'whsec').update(`${t}.${event}`).digest('hex');
  check((await verifyWebhook(event, `t=${t},v1=${sig}`, 'whsec')).data.parts[0].dxfUrl, `${format} webhook`);
}
console.log(`smoke ok on ${runtime} (esm + cjs)`);
