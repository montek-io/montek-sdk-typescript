import type { Montek } from '../client.js';
import type { UsageParams, UsageReport } from '../types.js';

export class Usage {
  constructor(private readonly client: Montek) {}

  /** Units used per model between `from` and `to` (filtered by `model`/`key`), with this period's quota and overage. */
  get({ from, to, ...filters }: UsageParams = {}): Promise<UsageReport> {
    return this.client.request('GET', '/v1/usage', { query: { ...filters, from: day(from), to: day(to) } });
  }
}

function day(value: string | Date | undefined): string | undefined {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}
