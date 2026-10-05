// Turn a hand sketch into DXF files, one per part.
//
//   MONTEK_API_KEY=mk_test_... node examples/sketch-to-dxf.ts sketch.jpg [out-dir]
//
// Runs as is on Node 22.18+ (TypeScript type stripping); in your project, use any TS runner.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { JobFailedError, Montek } from '@montek/sdk';

const [file, outDir = 'dxf'] = process.argv.slice(2);
if (!file) {
  console.error('Usage: node examples/sketch-to-dxf.ts <sketch.png|jpg> [out-dir]');
  process.exit(1);
}

const montek = new Montek({ baseURL: process.env.MONTEK_BASE_URL }); // key from MONTEK_API_KEY

const job = await montek.cad.create({ file, model: 'fansipan-cad-1.0' });
console.log(`Job ${job.id}: ${job.status}`);

try {
  const done = await job.wait(); // polls with backoff; on a server, pass webhookUrl instead
  await mkdir(outDir, { recursive: true });
  for (const part of done.parts) {
    const res = await fetch(part.dxfUrl);
    if (!res.ok) throw new Error(`Downloading ${part.name} failed: HTTP ${res.status}`);
    const path = join(outDir, `${part.name.replace(/[^\w.-]+/g, '_')}.dxf`);
    await writeFile(path, new Uint8Array(await res.arrayBuffer()));
    console.log(`${path}  bbox ${part.bbox.join(' ')}`);
  }
  console.log(`Billed ${done.usage.count} ${done.usage.unit}(s)`);
} catch (err) {
  if (err instanceof JobFailedError) console.error(`Job failed (${err.code}): ${err.message}`);
  else throw err;
  process.exitCode = 1;
}
