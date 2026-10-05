import { vi } from 'vitest';
import { Montek, type ClientOptions } from '../src/index.js';

export type Reply = Response | Error | (() => Response);

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

/** A client whose fetch answers with `replies` in order; `calls` holds each request. */
export function mockClient(replies: Reply[], options: ClientOptions = {}) {
  const calls: Request[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(new Request(input, init));
    const reply = replies.shift();
    if (!reply) throw new Error('mockClient: no reply left');
    if (reply instanceof Error) throw reply;
    return typeof reply === 'function' ? reply() : reply;
  });
  const client = new Montek({ apiKey: 'mk_test_abc', baseURL: 'https://api.test', fetch, ...options });
  return { client, calls, fetch };
}
