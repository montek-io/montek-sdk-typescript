// Public types, derived from the generated OpenAPI types so they follow the spec.
import type { Camelize } from './casing.js';
import type { FileInput } from './files.js';
import type { components, operations } from './generated/openapi.js';

type Schemas = components['schemas'];

export type ExtractParams = Camelize<Schemas['ExtractOptions']> & { file: FileInput };
export type ExtractResult = Camelize<Schemas['ExtractResult']>;
export type Field = Camelize<Schemas['Field']>;
export type UnitUsage = Camelize<Schemas['UnitUsage']>;

export type CadParams = Camelize<Schemas['CadOptions']> & { file: FileInput };
export type CadJob = Camelize<Schemas['CadJob']>;
/** A job that `wait()` saw succeed: parts and usage are always there. */
export type CadResult = CadJob & { status: 'succeeded'; parts: Part[]; usage: UnitUsage };
export type Part = Camelize<Schemas['Part']>;

export type Model = Camelize<Schemas['Model']>;
export type Plan = Camelize<Schemas['Plan']>;

type UsageQuery = NonNullable<operations['getUsage']['parameters']['query']>;
/** `from`/`to` are days; a Date is taken as its UTC day. */
export type UsageParams = Omit<UsageQuery, 'from' | 'to'> & { from?: string | Date; to?: string | Date };
export type UsageReport = Camelize<Schemas['Usage']>;
export type UsageRow = Camelize<Schemas['UsageRow']>;

export type WebhookEvent = Camelize<Schemas['WebhookEvent']>;
