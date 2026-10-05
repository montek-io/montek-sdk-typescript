# Montek TypeScript SDK

Official TypeScript client for the [Montek API](https://developers.montek.io): read business documents
(purchase orders, invoices, faxes, PDFs) into structured fields, and turn hand sketches into DXF.

The SDK is a thin, typed wrapper over plain HTTP: it builds the upload, sends your key, retries 429/5xx,
and parses the JSON. Anything it does, `curl` can do too. Types are generated from the API's `openapi.yaml`.

Runs on Node 18+, Cloudflare Workers, Deno and Bun. In browsers, only `mk_test_` keys are accepted:
keep live keys on your server.

## Quickstart (5 minutes)

**1. Install**

```bash
npm install @montek/sdk
```

**2. Set your key.** Create one at [developers.montek.io](https://developers.montek.io).
A `mk_test_` key returns sample results and is never billed, so it is safe for trying things out and for CI.

```bash
export MONTEK_API_KEY=mk_test_...
```

**3. Read a document**

```ts
import { Montek } from '@montek/sdk';

const montek = new Montek(); // reads MONTEK_API_KEY; or new Montek({ apiKey })

const order = await montek.extract({
  file: 'order.pdf',               // a path, Buffer, Blob/File or URL; PDF pages are split server-side
  model: 'langbiang-extract-1.0',
  lang: 'ja',                      // optional hint
  fields: ['po_number', 'total'],  // optional field-name hints
});

for (const f of order.fields) console.log(f.key, f.label, f.value, f.unsure ? '(unsure)' : '');
console.log(order.lineItems);
console.log(order.usage);          // { unit: 'page', count: 1 }: compare with your bill
```

**4. Turn a sketch into DXF**

```ts
const job = await montek.cad.create({ file: 'sketch.jpg', model: 'fansipan-cad-1.0' });
const done = await job.wait();     // polls with backoff until the job finishes

for (const part of done.parts) console.log(part.name, part.dxfUrl, part.bbox);
```

**5. See the models and prices** (never hard-coded in the SDK)

```ts
for (const m of await montek.models.list()) {
  console.log(m.id, m.unit, m.plans.map((p) => `${p.name}: ${p.monthlyFee} ${p.currency}`));
}
```

Complete scripts: [examples/read-fax-order.ts](examples/read-fax-order.ts) and
[examples/sketch-to-dxf.ts](examples/sketch-to-dxf.ts).

## Guide

### Files

`file` accepts a path (Node, Bun, Deno), a `Buffer`/`Uint8Array`/`ArrayBuffer`, a `Blob`/`File`, or a public
`URL` (also an `http(s)://` string), which the API downloads itself. PNG, JPEG, WebP, GIF and PDF up to 10 MB.

Responses use camelCase (`lineItems`, `dxfUrl`) where the HTTP API uses snake_case.

### Errors

Every error extends `MontekError`, with `status` and `code` from the API.

| Class | When |
|---|---|
| `AuthError` | 401/403: missing, wrong or revoked key |
| `NoPlanError` | 402: no plan for this model, overage cap reached, or payment past due |
| `RateLimitError` | 429 after the retries; `retryAfter` in seconds |
| `ValidationError` | other 4xx, e.g. 413 file too large, 415 unsupported type |
| `ServerError` | 5xx after the retries |
| `ConnectionError` | network failure or timeout after the retries |
| `JobFailedError` | `job.wait()` saw the cad job fail; `job` holds its final state |
| `WebhookSignatureError` | `verifyWebhook` rejected the request |

```ts
import { NoPlanError, RateLimitError } from '@montek/sdk';

try {
  await montek.extract({ file, model });
} catch (err) {
  if (err instanceof NoPlanError) { /* subscribe to a plan for this model */ }
  else if (err instanceof RateLimitError) { /* slow down: err.retryAfter */ }
  else throw err;
}
```

### Retries, timeouts, idempotency

429, 5xx and network errors are retried twice with exponential backoff, waiting for `Retry-After` when the
API sends it. Every POST carries an auto-generated `Idempotency-Key`, reused across its retries, so a retry
never runs (or bills) the same document twice.

```ts
new Montek({ maxRetries: 4, timeout: 120_000 /* ms per attempt */ });
```

### Webhooks

Instead of `job.wait()`, a server can pass `webhookUrl` to `cad.create()` and get the finished job pushed
to it. Check the signature on the **raw** body before trusting it:

```ts
import { verifyWebhook, WebhookSignatureError } from '@montek/sdk';

// Cloudflare Worker; with Express, read the body with express.raw({ type: 'application/json' }).
export default {
  async fetch(req: Request, env: { MONTEK_WEBHOOK_SECRET: string }) {
    try {
      const event = await verifyWebhook(await req.text(), req.headers.get('Montek-Signature'), env.MONTEK_WEBHOOK_SECRET);
      if (event.type === 'cad.succeeded') console.log(event.data.parts);
      return new Response('ok');
    } catch (err) {
      if (err instanceof WebhookSignatureError) return new Response('bad signature', { status: 400 });
      throw err;
    }
  },
};
```

The secret defaults to the `MONTEK_WEBHOOK_SECRET` environment variable where `process.env` exists.
Signatures older than 5 minutes are rejected.

### Usage

```ts
const report = await montek.usage.get({ from: '2026-10-01', to: new Date(), model: 'langbiang-extract-1.0' });
for (const row of report.data) console.log(row.model, row.count, row.unit, `included ${row.included}`, `overage ${row.overage}`);
```

## Development

```bash
npm install
npm test             # mock-HTTP tests; set MONTEK_TEST_API_KEY=mk_test_... to also call the real API
npm run typecheck
npm run build        # dist/: ESM + CJS + .d.ts
npm run smoke        # load dist/ and make a mocked call; also: deno run -A / bun run scripts/smoke.mjs
npm run gen          # refresh spec/openapi.yaml and src/generated/ from the montek-api release
```

`src/generated/` is generated; never edit it by hand. Until montek-api publishes its `openapi.yaml`
release asset, `spec/openapi.yaml` is a provisional hand-written spec and may change.

CI (`.github/workflows/ci.yml`) runs the tests on Node 20, 22 and 24, and the smoke check on Node 18, Deno and Bun.
The SDK's major version follows the API's (`/v1` → `1.x`). Changes are listed in [CHANGELOG.md](CHANGELOG.md).

## License

MIT
