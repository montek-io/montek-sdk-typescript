// The API speaks snake_case; the SDK exposes camelCase.

type CamelCase<S extends string> = S extends `${infer Head}_${infer Tail}` ? `${Head}${Capitalize<CamelCase<Tail>>}` : S;

/** Deep camelCase of an API type, e.g. `line_items` → `lineItems`. */
export type Camelize<T> = T extends readonly (infer U)[]
  ? Camelize<U>[]
  : T extends object
    ? { [K in keyof T as K extends string ? CamelCase<K> : K]: Camelize<T[K]> }
    : T;

export function camelize<T>(value: T): Camelize<T> {
  if (Array.isArray(value)) return value.map(camelize) as Camelize<T>;
  if (value === null || typeof value !== 'object') return value as Camelize<T>;
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    out[key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())] = camelize(v);
  }
  return out as Camelize<T>;
}

export function snakeCase(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}
