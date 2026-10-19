/**
 * @nextrush/runtime — `RequestInputs`, the lazily resolved request inputs.
 *
 * @remarks
 * These cover the branches a handler actually exercises once it reads what it
 * asked for: the record path (already materialised), the array case
 * (`set-cookie`), the platform without `getSetCookie`, and the address resolving
 * exactly once. The absence cases live in `web-context-laziness.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import { RequestInputs } from '../request-inputs';

function requestWith(headers: unknown): Request {
  return {
    method: 'GET',
    url: 'http://localhost/',
    signal: new AbortController().signal,
    body: null,
    headers,
  } as unknown as Request;
}

describe('RequestInputs', () => {
  it('answers from the materialised record once the record exists', () => {
    const inputs = new RequestInputs(
      requestWith(new Headers({ 'x-a': '1', 'x-b': '2' })),
      ''
    );

    void inputs.headers;

    expect(inputs.get('x-a')).toBe('1');
    expect(inputs.get('X-B')).toBe('2');
    expect(inputs.get('missing')).toBeUndefined();
  });

  it('returns the first entry of an array-valued record key', () => {
    const headers = new Headers();
    headers.append('set-cookie', 'a=1; Path=/');
    headers.append('set-cookie', 'b=2; Path=/');
    const inputs = new RequestInputs(requestWith(headers), '');

    void inputs.headers;

    expect(inputs.get('set-cookie')).toBe('a=1; Path=/');
  });

  it('falls back to Headers.get when the platform exposes no getSetCookie', () => {
    const headers = {
      get: (name: string) => (name === 'set-cookie' ? 'a=1, b=2' : null),
      forEach: () => undefined,
    };
    const inputs = new RequestInputs(requestWith(headers), '');

    expect(inputs.get('set-cookie')).toBe('a=1, b=2');
  });

  it('reads a plain header from a platform Headers-like object without building a record', () => {
    let reads = 0;
    const headers = {
      get: (name: string) => {
        reads += 1;
        return name === 'x-a' ? '1' : null;
      },
      forEach: () => undefined,
    };
    const inputs = new RequestInputs(requestWith(headers), '');

    expect(inputs.get('x-a')).toBe('1');
    expect(inputs.get('x-none')).toBeUndefined();
    expect(reads).toBe(2);
  });

  it('resolves a supplied address once and returns a known address untouched', () => {
    let calls = 0;
    const lazy = new RequestInputs(requestWith(new Headers()), () => {
      calls += 1;
      return '203.0.113.9';
    });
    expect(lazy.ip).toBe('203.0.113.9');
    expect(lazy.ip).toBe('203.0.113.9');
    expect(calls).toBe(1);

    const known = new RequestInputs(requestWith(new Headers()), '198.51.100.1');
    expect(known.ip).toBe('198.51.100.1');
  });
});
