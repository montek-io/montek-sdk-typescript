// Public types, derived from the generated OpenAPI types so they follow the spec.
import type { Camelize } from './casing.js';
import type { FileInput } from './files.js';
import type { components, operations } from './generated/openapi.js';

type Schemas = components['schemas'];
type JsonBody<Op extends 'extract' | 'createCadJob' | 'cadSucceeded' | 'cadFailed'> =
  NonNullable<operations[Op]['requestBody']>['content']['application/json'];

/**
 * Options of an upload endpoint, plus the file. `model` suggests the spec's ids but takes any string,
 * so a model added later works without an SDK update.
 */
type UploadParams<Op extends 'extract' | 'createCadJob'> = Camelize<Omit<JsonBody<Op>, 'url' | 'model'>> & {
  model: JsonBody<Op>['model'] | (string & {});
  file: FileInput;
};

export type ExtractParams = UploadParams<'extract'>;
export type ExtractResponse = Camelize<Schemas['ExtractResponse']>;
export type Field = Camelize<Schemas['Field']>;
export type Box = Schemas['Box'];
export type LineItem = Camelize<Schemas['LineItem']>;

export type CadParams = UploadParams<'createCadJob'>;
export type CadJob = Camelize<Schemas['CadJob']>;
export type CadPart = NonNullable<CadJob['parts']>[number];
/** A job that `wait()` saw succeed: parts and usage are always there. */
export type CadResult = CadJob & { status: 'succeeded'; parts: CadPart[]; usage: NonNullable<CadJob['usage']> };

export type Model = Camelize<Schemas['Model']>;
export type Plan = Camelize<Schemas['Plan']>;
export type PlanStatus = Camelize<Schemas['PlanStatus']>;
export type Me = Camelize<Schemas['Me']>;

type UsageQuery = NonNullable<operations['getUsage']['parameters']['query']>;
/** `from`/`to` are UTC days; a Date is taken as its UTC day. */
export type UsageParams = Omit<UsageQuery, 'from' | 'to'> & { from?: string | Date; to?: string | Date };
export type Usage = Camelize<Schemas['Usage']>;
export type UsageDay = Usage['days'][number];

/** Body of a webhook: `cad.succeeded` or `cad.failed`, with the job. */
export type WebhookEvent = Camelize<JsonBody<'cadSucceeded'> | JsonBody<'cadFailed'>>;
