import type { Montek } from '../client.js';
import type { Usage as UsageData, UsageParams } from '../types.js';

export class Usage {
  constructor(private readonly client: Montek) {}

  /** Billed usage per UTC day and model between `from` and `to` (filtered by `model`/`key`), and each plan's use this period. */
  get({ from, to, ...filters }: UsageParams = {}): Promise<UsageData> {
    return this.client.request('GET', '/v1/usage', { query: { ...filters, from: day(from), to: day(to) } });
  }
}

function day(value: string | Date | undefined): string | undefined {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}
