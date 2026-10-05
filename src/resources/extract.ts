import type { Montek } from '../client.js';
import { uploadBody } from '../files.js';
import type { ExtractParams, ExtractResponse } from '../types.js';

export async function extract(client: Montek, { file, ...options }: ExtractParams): Promise<ExtractResponse> {
  return client.request('POST', '/v1/extract', { body: await uploadBody(file, options) });
}
