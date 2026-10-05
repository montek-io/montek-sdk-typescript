// The few things that differ between Node 18+, Workers, Deno, Bun and browsers.

/**
 * Import a Node built-in only when it is actually needed. The specifier is a variable so that
 * bundlers for Workers and browsers leave it alone instead of failing to resolve it.
 */
export function nodeImport<T>(name: 'crypto' | 'fs/promises'): Promise<T> {
  const specifier = `node:${name}`;
  return import(/* @vite-ignore */ /* webpackIgnore: true */ specifier) as Promise<T>;
}

/** Web Crypto: global everywhere except Node 18, where it lives in `node:crypto`. */
export async function webCrypto(): Promise<Crypto> {
  return globalThis.crypto ?? (await nodeImport<typeof import('node:crypto')>('crypto')).webcrypto as Crypto;
}

/** An environment variable where `process.env` exists (Node, Bun, Deno 2); undefined elsewhere. */
export function env(name: string): string | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
}

export const isBrowser = typeof (globalThis as { document?: unknown }).document !== 'undefined';

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
