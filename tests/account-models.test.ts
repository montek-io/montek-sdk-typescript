import { describe, expect, it } from 'vitest';
import { json, mockClient } from './helpers.js';

const planStatus = {
  model: 'langbiang-extract-1.0', tier: 'basic', status: 'active',
  period_start: '2026-10-01T00:00:00.000Z', period_end: '2026-11-01T00:00:00.000Z',
  included_units: 1000, used_units: 1012, overage_units: 12, overage_cap: 500,
};

describe('models.list', () => {
  it('returns the models from the API', async () => {
    const model = {
      id: 'langbiang-extract-1.0', endpoint: '/v1/extract', unit: 'page', description: 'Business documents',
      plans: [{ tier: 'basic', currency: 'jpy', monthly_fee: 20000, included_units: 1000, overage_unit_price: 25 }],
    };
    const { client, calls } = mockClient([json({ data: [model] })]);
    const models = await client.models.list();
    expect(calls[0]!.url).toBe('https://api.test/v1/models');
    expect(models[0]!.plans[0]).toEqual({ tier: 'basic', currency: 'jpy', monthlyFee: 20000, includedUnits: 1000, overageUnitPrice: 25 });
  });
});

describe('usage.get', () => {
  it('sends the filters, turning Dates into UTC days', async () => {
    const usage = {
      from: '2026-10-01', to: '2026-10-31',
      days: [{ date: '2026-10-05', model: 'langbiang-extract-1.0', units: 12, overage_units: 2, calls: 9, errors: 1 }],
      plans: [planStatus],
    };
    const { client, calls } = mockClient([json(usage), json(usage)]);
    const r = await client.usage.get({ from: new Date('2026-10-01T05:00:00Z'), to: '2026-10-31', model: 'langbiang-extract-1.0' });
    expect(new URL(calls[0]!.url).search).toBe('?model=langbiang-extract-1.0&from=2026-10-01&to=2026-10-31');
    expect(r.days[0]!.overageUnits).toBe(2);
    expect(r.plans[0]!.overageCap).toBe(500);

    await client.usage.get();
    expect(calls[1]!.url).toBe('https://api.test/v1/usage');
  });
});

describe('me', () => {
  it('returns the key, its organization, plans and webhook secret', async () => {
    const me = {
      organization: { id: 'org_1', name: 'Acme' },
      key: { id: 'key_1', mode: 'test', scopes: null },
      webhook_secret: 'whsec_test',
      plans: [planStatus],
    };
    const { client, calls } = mockClient([json(me)]);
    const r = await client.me();
    expect(`${calls[0]!.method} ${calls[0]!.url}`).toBe('GET https://api.test/v1/me');
    expect(r.webhookSecret).toBe('whsec_test');
    expect(r.key).toEqual({ id: 'key_1', mode: 'test', scopes: null });
    expect(r.plans[0]!.usedUnits).toBe(1012);
  });
});
