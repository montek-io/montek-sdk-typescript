import type { Montek } from '../client.js';
import { JobFailedError, MontekError } from '../errors.js';
import { uploadBody } from '../files.js';
import { sleep } from '../runtime.js';
import type { CadJob, CadParams, CadResult } from '../types.js';

export class Cad {
  constructor(private readonly client: Montek) {}

  /** Start a sketch → DXF job. It runs for a while: `await job.wait()`, or get a signed webhook (`webhookUrl`). Jobs are kept 7 days. */
  async create({ file, ...options }: CadParams): Promise<Job> {
    return new Job(this.client, await this.client.request('POST', '/v1/cad', { body: await uploadBody(file, options) }));
  }

  /** Current state of a job, e.g. after a webhook or a restart. */
  async get(id: string): Promise<Job> {
    return new Job(this.client, await this.client.request('GET', `/v1/cad/${encodeURIComponent(id)}`));
  }

  /** Part `index` (1-based, in the order of `parts`) of a succeeded job, as ASCII DXF in millimetres. */
  getPart(id: string, index: number): Promise<string> {
    return this.client.request('GET', `/v1/cad/${encodeURIComponent(id)}/parts/${index}`, { text: true });
  }
}

export interface Job extends CadJob {}

/** A cad job: its latest known state, plus `wait()`. */
export class Job {
  readonly #client: Montek;

  constructor(client: Montek, data: CadJob) {
    this.#client = client;
    Object.assign(this, data);
  }

  /**
   * Poll until the job finishes (1 s, then ×1.5 up to 10 s between polls) and return it.
   * Throws `JobFailedError` if it fails, `MontekError` if it is still running after `timeout` ms (default 15 min).
   */
  async wait({ timeout = 15 * 60_000 }: { timeout?: number } = {}): Promise<CadResult> {
    const deadline = Date.now() + timeout;
    for (let delay = 1000; ; delay = Math.min(delay * 1.5, 10_000)) {
      if (this.status === 'succeeded') return this as CadResult;
      if (this.status === 'failed') throw new JobFailedError(this);
      if (Date.now() + delay > deadline) throw new MontekError(`cad job ${this.id} still ${this.status} after ${timeout} ms`);
      await sleep(delay);
      Object.assign(this, await this.#client.request<CadJob>('GET', `/v1/cad/${encodeURIComponent(this.id)}`));
    }
  }
}
