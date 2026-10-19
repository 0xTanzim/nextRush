/**
 * @nextrush/runtime — what constructing a Web context must NOT do.
 *
 * @remarks
 * The request path's per-request tax is dominated by work nobody asked for:
 * turning the platform's incoming headers into a record, and parsing the target
 * with a `URL`. Both are legitimate when a handler reads them and pure cost when
 * it does not, so the assertions here are about *absence* — measured against the
 * platform objects themselves (a counting request, a counting `URL`), which is
 * deterministic and runtime-independent. A heap figure cannot prove this: it
 * would count the record when it is allocated and show nothing when it is not,
 * which is the same number either way once the collector runs.
 */

import { describe, expect, it } from 'vitest';
import { WebContextBase } from '../web-context-base';
import type { WebStreamRunners } from '../web-context-base';

/** Minimal concrete subclass — a real subclass, not a mock of the base itself. */
class TestContext extends WebContextBase {
  constructor(request: Request) {
    super(request, '', 'bun', {
      runTextStream: async () => undefined,
      runSSEStream: async () => undefined,
      runNDJSONStream: async () => undefined,
    } satisfies WebStreamRunners);
  }
}

interface CountingRequest {
  readonly request: Request;
  /** Times the `headers` property itself was read. */
  headerReads: () => number;
  /** Times any method or member of the `Headers` object was touched. */
  headerOperations: () => number;
}

/**
 * A request whose `url` is carried verbatim and whose headers count their use.
 *
 * A stub rather than a real `Request` on purpose: a real `Request` parses its
 * URL (resolving dot segments) before anything here can observe it, and its
 * `headers` property cannot be instrumented.
 */
function countingRequest(target = '/path?a=1'): CountingRequest {
  const real = new Headers({ 'x-a': '1', 'user-agent': 'curl/8' });
  let headerReads = 0;
  let headerOperations = 0;
  const counting = new Proxy(real, {
    get(target_, prop) {
      if (typeof prop === 'string') headerOperations += 1;
      const value = Reflect.get(target_, prop, target_);
      return typeof value === 'function' ? value.bind(target_) : value;
    },
  });

  const request = {
    method: 'GET',
    url: `http://localhost${target}`,
    signal: new AbortController().signal,
    body: null,
    get headers(): Headers {
      headerReads += 1;
      return counting as Headers;
    },
  } as unknown as Request;

  return {
    request,
    headerReads: () => headerReads,
    headerOperations: () => headerOperations,
  };
}

describe('constructing a Web context does no work the handler did not ask for', () => {
  it('reads no incoming header', () => {
    const counting = countingRequest();
    new TestContext(counting.request);

    expect(counting.headerReads()).toBe(0);
    expect(counting.headerOperations()).toBe(0);
  });

  it('constructs no URL', () => {
    const counting = countingRequest('/files/archive.tar.gz?a=1&b=2');
    const RealURL = globalThis.URL;
    let constructed = 0;

    class CountingURL extends RealURL {
      constructor(...args: ConstructorParameters<typeof URL>) {
        super(...args);
        constructed += 1;
      }
    }

    globalThis.URL = CountingURL as unknown as typeof URL;
    try {
      const ctx = new TestContext(counting.request);
      expect(ctx.path).toBe('/files/archive.tar.gz');
      expect(ctx.query).toEqual({ a: '1', b: '2' });
    } finally {
      globalThis.URL = RealURL;
    }

    expect(constructed).toBe(0);
  });
});

describe('reading what a handler asked for is the only reason the work happens', () => {
  it('a single-name lookup reads the platform headers directly', () => {
    const counting = countingRequest();
    const ctx = new TestContext(counting.request);

    expect(ctx.get('X-A')).toBe('1');
    expect(counting.headerReads()).toBe(1);
    // One `get` on the platform object — not a walk that builds the whole record.
    expect(counting.headerOperations()).toBe(1);
  });

  it('the header record materialises once and keeps its prototype-less shape', () => {
    const counting = countingRequest();
    const ctx = new TestContext(counting.request);

    const record = ctx.headers;
    expect(ctx.headers).toBe(record);
    // Prototype-less in the security sense: nothing inherited is reachable.
    expect(Object.getPrototypeOf(record)?.hasOwnProperty).toBeUndefined();
    expect(record['x-a']).toBe('1');
    expect(record['user-agent']).toBe('curl/8');
    expect(counting.headerReads()).toBe(1);
  });

  it('keeps set-cookie as an array in the record and its first value through get()', () => {
    const headers = new Headers();
    headers.append('set-cookie', 'a=1; Path=/');
    headers.append('set-cookie', 'b=2; Path=/');
    const request = {
      method: 'GET',
      url: 'http://localhost/',
      signal: new AbortController().signal,
      body: null,
      headers,
    } as unknown as Request;

    const ctx = new TestContext(request);
    expect(ctx.get('SET-COOKIE')).toBe('a=1; Path=/');
    expect(ctx.headers['set-cookie']).toEqual(['a=1; Path=/', 'b=2; Path=/']);
  });
});
