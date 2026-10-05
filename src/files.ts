import { snakeCase } from './casing.js';
import { nodeImport } from './runtime.js';

/** A file path (Node, Bun, Deno), bytes (Buffer, Uint8Array, ArrayBuffer), a Blob/File, or a public URL. */
export type FileInput = string | URL | Blob | ArrayBuffer | ArrayBufferView;

/**
 * Body for an upload endpoint: JSON `{url, ...}` for a URL, multipart `file` + fields otherwise.
 * camelCase option names become the API's snake_case; arrays become repeated form fields.
 */
export async function uploadBody(file: FileInput, options: Record<string, unknown>): Promise<FormData | Record<string, unknown>> {
  const fields = Object.entries(options).filter(([, v]) => v !== undefined).map(([k, v]) => [snakeCase(k), v] as const);
  if (file instanceof URL || (typeof file === 'string' && /^https?:\/\//i.test(file))) {
    return { url: String(file), ...Object.fromEntries(fields) };
  }
  const [blob, name] = await toBlob(file);
  const form = new FormData();
  form.append('file', blob, name);
  for (const [key, value] of fields) {
    for (const item of Array.isArray(value) ? value : [value]) form.append(key, String(item));
  }
  return form;
}

async function toBlob(file: Exclude<FileInput, URL>): Promise<[Blob, string]> {
  let blob: Blob;
  let name = 'file';
  if (typeof file === 'string') {
    const { readFile } = await nodeImport<typeof import('node:fs/promises')>('fs/promises');
    blob = new Blob([(await readFile(file)) as Uint8Array<ArrayBuffer>]);
    name = file.split(/[\\/]/).pop() || name;
  } else if (file instanceof Blob) {
    blob = file;
    name = (file as Partial<File>).name || name;
  } else {
    const bytes = ArrayBuffer.isView(file) ? new Uint8Array(file.buffer, file.byteOffset, file.byteLength) : new Uint8Array(file);
    blob = new Blob([bytes as Uint8Array<ArrayBuffer>]);
  }
  if (!blob.type) blob = new Blob([blob], { type: sniff(new Uint8Array(await blob.slice(0, 12).arrayBuffer())) });
  return [blob, name];
}

/** Media type from magic bytes, for the formats the API accepts. */
function sniff(b: Uint8Array): string {
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  if (ascii(0, 4) === '%PDF') return 'application/pdf';
  if (b[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (ascii(0, 4) === 'GIF8') return 'image/gif';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  return 'application/octet-stream';
}
