// Read a faxed purchase order (scan, photo or PDF) into fields and line items.
//
//   MONTEK_API_KEY=mk_test_... node examples/read-fax-order.ts order.pdf
//
// Runs as is on Node 22.18+ (TypeScript type stripping); in your project, use any TS runner.
import { Montek, NoPlanError } from '@montek/sdk';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node examples/read-fax-order.ts <order.pdf|png|jpg|webp>');
  process.exit(1);
}

const montek = new Montek({ baseURL: process.env.MONTEK_BASE_URL }); // key from MONTEK_API_KEY

try {
  const order = await montek.extract({
    file,
    model: 'langbiang-extract-1.0',
    lang: 'ja',
    fields: ['po_number', 'order_date', 'supplier', 'delivery_date', 'total'], // hints, not a schema
  });

  console.table(order.fields.map((f) => ({ key: f.key, label: f.label, value: f.value, page: f.page, unsure: f.unsure ? '?' : '' })));
  if (order.lineItems.length) console.table(order.lineItems);
  if (order.comment) console.log(order.comment);
  console.log(`${order.pages} page(s), billed ${order.usage.count} ${order.usage.unit}(s)`);
} catch (err) {
  if (err instanceof NoPlanError) console.error(`No plan for this model yet: ${err.message}`);
  else throw err;
  process.exitCode = 1;
}
