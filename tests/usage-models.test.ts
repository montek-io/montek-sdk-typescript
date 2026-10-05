import { describe, expect, it } from 'vitest';
import { json, mockClient } from './helpers.js';

describe('models.list', () => {
  it('returns the models from the API', async () => {
    const model = { id: 'langbiang-extract-1.0', unit: 'page', plans: [{ id: 'basic', name: 'Basic', monthly_fee: 1, included: 100, overage_price: 0.1, currency: 'USD' }] };
    const { client, calls } = mockClient([json({ data: [model] })]);
    const models = await client.models.list();
    expect(calls[0]!.url).toBe('https://api.test/v1/models');
    expect(models[0]!.plans[0]!.overagePrice).toBe(0.1);
  });
});

describe('usage.get', () => {
  it('sends the filters, turning Dates into UTC days', async () => {
    const report = { from: '2026-10-01', to: '2026-10-31', data: [{ model: 'm', unit: 'page', count: 12, included: 10, overage: 2 }] };
    const { client, calls } = mockClient([json(report), json(report)]);
    const r = await client.usage.get({ from: new Date('2026-10-01T05:00:00Z'), to: '2026-10-31', model: 'm' });
    expect(new URL(calls[0]!.url).search).toBe('?model=m&from=2026-10-01&to=2026-10-31');
    expect(r.data[0]!.overage).toBe(2);

    await client.usage.get();
    expect(calls[1]!.url).toBe('https://api.test/v1/usage');
  });
});
