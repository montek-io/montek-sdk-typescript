import type { Montek } from '../client.js';
import type { Model } from '../types.js';

export class Models {
  constructor(private readonly client: Montek) {}

  /** Every model with its billing unit, plans and prices: the source of truth, nothing is hard-coded in the SDK. */
  async list(): Promise<Model[]> {
    return (await this.client.request<{ data: Model[] }>('GET', '/v1/models')).data;
  }
}
