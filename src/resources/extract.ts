import type { Montek } from '../client.js';
import { uploadBody } from '../files.js';
import type { ExtractParams, ExtractResult } from '../types.js';

export async function extract(client: Montek, { file, ...options }: ExtractParams): Promise<ExtractResult> {
  return client.request('POST', '/v1/extract', { body: await uploadBody(file, options) });
}
