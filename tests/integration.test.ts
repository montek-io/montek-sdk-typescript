// Real call against api.montek.io with a mk_test_ key (sample result, not metered).
// Skipped unless MONTEK_TEST_API_KEY is set.
import { describe, expect, it } from 'vitest';
import { Montek } from '../src/index.js';

const apiKey = process.env.MONTEK_TEST_API_KEY;
const PNG_1PX = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));

describe.skipIf(!apiKey?.startsWith('mk_test_'))('integration (mk_test_)', () => {
  it('extract returns a sample result', async () => {
    const montek = new Montek({ apiKey });
    const model = (await montek.models.list()).find((m) => m.unit === 'page');
    const r = await montek.extract({ file: PNG_1PX, model: model!.id });
    expect(r.id).toBeTruthy();
    expect(r.usage.unit).toBe('page');
  });
});
