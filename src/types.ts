// Public types, derived from the generated OpenAPI types so they follow the spec.
import type { Camelize } from './casing.js';
import type { FileInput } from './files.js';
import type { components } from './generated/openapi.js';

type Schemas = components['schemas'];

export type ExtractParams = Camelize<Schemas['ExtractOptions']> & { file: FileInput };
export type ExtractResult = Camelize<Schemas['ExtractResult']>;
export type Field = Camelize<Schemas['Field']>;
export type UnitUsage = Camelize<Schemas['UnitUsage']>;
