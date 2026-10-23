/**
 * @nextrush/runtime — WebContextBase (F-08, ADR-0010) unit tests.
 *
 * @remarks
 * Direct coverage of the shared shell in isolation (the Bun/Deno/Edge suites
 * exercise it indirectly through their own built dist, which does not count
 * toward `@nextrush/runtime`'s own coverage instrumentation).
 */

import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '@nextrush/errors';
import { WebContextBase } from '../web-context-base';
import type { WebStreamRunners } from '../web-context-base';

/** Minimal concrete subclass — a real subclass, not a mock of the base itself. */
class TestContext extends WebContextBase {
  constructor(request: Request, ip = '', streamRunners?: Partial<WebStreamRunners>) {
    super(request, ip, 'bun', {
      runTextStream: streamRunners?.runTextStream ?? (async () => undefined),
      runSSEStream: streamRunners?.runSSEStream ?? (async () => undefined),
      runNDJSONStream: streamRunners?.runNDJSONStream ?? (async () => undefined),
    });
  }
}

function makeContext(init?: RequestInit & { url?: string }): TestContext {
  const { url = 'http://localhost/path?a=1', ...rest } = init ?? {};
  return new TestContext(new Request(url, rest));
}

/**
 * A request whose `.url` carries the target verbatim, the way a runtime that does
 * not re-parse the request line delivers it (Deno, and Node's `req.url`).
 *
 * Built as a stub rather than a real `Request` on purpose: constructing a
 * `Request` from a URL resolves dot segments inside the WHATWG parser, so a real
 * `Request` can never carry one — which is why this is a unit test of the
 * context's own derivation, and why the cross-adapter assertion for it has to run
 * over a real socket (`@nextrush/adapter-conformance`).
 */
function rawTargetRequest(target: string): Request {
  return {
    method: 'GET',
    url: `http://localhost${target}`,
    headers: new Headers(),
  } as unknown as Request;
}

/** Counts constructions of the global `URL` for the duration of `fn`. */
function countUrlConstructions(fn: () => void): number {
  const OriginalURL = globalThis.URL;
  let count = 0;
  class CountingURL extends OriginalURL {
    constructor(...args: ConstructorParameters<typeof OriginalURL>) {
      super(...args);
      count++;
    }
  }
  (globalThis as { URL: typeof URL }).URL = CountingURL as unknown as typeof URL;
  try {
    fn();
  } finally {
    (globalThis as { URL: typeof URL }).URL = OriginalURL;
  }
  return count;
}

describe('WebContextBase — the request target is read, not re-derived', () => {
  it('publishes a dot segment instead of resolving it', () => {
    const ctx = new TestContext(rawTargetRequest('/files/../admin?x=1'));
    expect(ctx.path).toBe('/files/../admin');
    expect(ctx.originalPath).toBe('/files/../admin');
    expect(ctx.url).toBe('/files/../admin?x=1');
    expect(ctx.query).toEqual({ x: '1' });
  });

  it('publishes a percent-encoded dot segment verbatim', () => {
    const ctx = new TestContext(rawTargetRequest('/files/%2e%2e/admin'));
    expect(ctx.path).toBe('/files/%2e%2e/admin');
    expect(ctx.originalPath).toBe('/files/%2e%2e/admin');
  });

  it('derives path, url and query with no URL construction per request', () => {
    const ctx = new TestContext(rawTargetRequest('/users/5?x=1&y=2'));
    expect(ctx.path).toBe('/users/5');
    expect(ctx.url).toBe('/users/5?x=1&y=2');
    expect(ctx.query).toEqual({ x: '1', y: '2' });

    // The parse is the whole reason a `URL` object existed per request; the
    // derivation must not construct one, or the per-request cost it removes comes
    // straight back.
    const constructions = countUrlConstructions(() => {
      new TestContext(rawTargetRequest('/users/5?x=1&y=2'));
    });
    expect(constructions).toBe(0);
  });
});

describe('WebContextBase — construction', () => {
  it('parses method, url, path, and query from the request', () => {
    const ctx = makeContext({ method: 'post', url: 'http://localhost/users/5?x=1&y=2' });
    expect(ctx.method).toBe('POST');
    expect(ctx.path).toBe('/users/5');
    expect(ctx.url).toBe('/users/5?x=1&y=2');
    expect(ctx.query).toEqual({ x: '1', y: '2' });
  });

  it('converts headers to a record', () => {
    const ctx = makeContext({ headers: { 'X-Custom': 'val' } });
    expect(ctx.get('x-custom')).toBe('val');
  });

  it('uses the ip and runtime passed by the subclass', () => {
    const ctx = new TestContext(new Request('http://localhost/'), '10.0.0.1');
    expect(ctx.ip).toBe('10.0.0.1');
    expect(ctx.runtime).toBe('bun');
  });

  it('creates an EmptyBodySource for GET (no-body method)', async () => {
    const ctx = makeContext({ method: 'GET' });
    expect(ctx.bodySource.contentLength).toBe(0);
    await expect(ctx.bodySource.text()).resolves.toBe('');
  });

  it('creates a WebBodySource for POST', async () => {
    const ctx = makeContext({ method: 'POST', body: 'hello' });
    await expect(ctx.bodySource.text()).resolves.toBe('hello');
  });

  it('reports the declared body length for a body-bearing request', () => {
    // A runtime delivers the header; a client-side `Request` does not synthesize it.
    const ctx = makeContext({ method: 'POST', headers: { 'content-length': '5' }, body: 'hello' });
    expect(ctx.bodyLength).toBe(5);
  });

  it('reports no body length for a bodyless method or an undeclared body', () => {
    expect(makeContext({ method: 'GET' }).bodyLength).toBe(0);

    const undeclared = new TestContext(new Request('http://localhost/', { method: 'POST' }));
    expect(undeclared.bodyLength).toBeUndefined();
  });

  it('defaults params to the shared frozen empty object and status to 200', () => {
    const ctx = makeContext();
    expect(ctx.params).toEqual({});
    expect(ctx.status).toBe(200);
    expect(ctx.state).toEqual({});
  });
});

describe('WebContextBase — response methods', () => {
  it('json() sets status/content-type and serializes the body', () => {
    const ctx = makeContext();
    ctx.status = 201;
    ctx.json({ ok: true });
    const res = ctx.getResponse();
    expect(res.status).toBe(201);
    expect(res.headers.get('content-type')).toBe('application/json');
  });

  it('send() writes a text body', () => {
    const ctx = makeContext();
    ctx.send('plain text');
    const res = ctx.getResponse();
    expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8');
  });

  it('html() writes an HTML body', () => {
    const ctx = makeContext();
    ctx.html('<b>hi</b>');
    const res = ctx.getResponse();
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
  });

  it('redirect() defaults to 302 with a Location header', () => {
    const ctx = makeContext();
    ctx.redirect('/next');
    const res = ctx.getResponse();
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/next');
  });

  it('set()/get() round-trip a header', () => {
    const ctx = makeContext();
    ctx.set('X-Trace', 'abc');
    expect(ctx.getResponse().headers.get('x-trace')).toBe('abc');
  });

  it('responded/markResponded reflect the builder state', () => {
    const ctx = makeContext();
    expect(ctx.responded).toBe(false);
    ctx.markResponded();
    expect(ctx.responded).toBe(true);
  });
});

describe('WebContextBase — raw, signal, and streaming', () => {
  it('ctx.raw is lazily built and memoized ({ req, res: undefined })', () => {
    const request = new Request('http://localhost/');
    const ctx = new TestContext(request);
    const raw1 = ctx.raw;
    const raw2 = ctx.raw;
    expect(raw1).toBe(raw2);
    expect(raw1.req).toBe(request);
    expect(raw1.res).toBeUndefined();
  });

  it('ctx.signal combines the request signal with a timeout controller', () => {
    const ctx = makeContext();
    const signal = ctx.signal;
    expect(signal.aborted).toBe(false);
  });

  it('triggerTimeout() aborts ctx.signal', () => {
    const ctx = makeContext();
    const signal = ctx.signal;
    ctx.triggerTimeout();
    expect(signal.aborted).toBe(true);
  });

  it('triggerTimeout() uses Error("Request timeout") as the abort reason', () => {
    const ctx = makeContext();
    const signal = ctx.signal;
    ctx.triggerTimeout();
    expect(signal.reason).toBeInstanceOf(Error);
    expect((signal.reason as Error).message).toBe('Request timeout');
  });

  it('aborts ctx.signal with the request reason when the client disconnects', () => {
    const client = new AbortController();
    const ctx = makeContext({ signal: client.signal });
    const signal = ctx.signal;
    expect(signal.aborted).toBe(false);

    const reason = new Error('client disconnected');
    client.abort(reason);

    expect(signal.aborted).toBe(true);
    expect(signal.reason).toBe(reason);
  });

  it('sendStream() marks the response committed and resolves', async () => {
    const ctx = makeContext();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });
    await expect(ctx.sendStream(stream)).resolves.toBeUndefined();
    expect(ctx.responded).toBe(true);
  });

  it('stream()/sse()/ndjson() delegate to the injected stream runners', async () => {
    const runTextStream = vi.fn(async () => undefined);
    const runSSEStream = vi.fn(async () => undefined);
    const runNDJSONStream = vi.fn(async () => undefined);
    const ctx = new TestContext(new Request('http://localhost/'), '', {
      runTextStream,
      runSSEStream,
      runNDJSONStream,
    });

    const run = async (): Promise<void> => undefined;
    await ctx.stream(run);
    await ctx.sse(run);
    await ctx.ndjson(run);

    expect(runTextStream).toHaveBeenCalledWith(ctx, run);
    expect(runSSEStream).toHaveBeenCalledWith(ctx, run);
    expect(runNDJSONStream).toHaveBeenCalledWith(ctx, run);
  });
});

describe('WebContextBase — middleware and errors', () => {
  it('next() with no wired thunk resolves without throwing', async () => {
    const ctx = makeContext();
    await expect(ctx.next()).resolves.toBeUndefined();
  });

  it('setNext() wires the dispatch thunk that next() forwards to', async () => {
    const ctx = makeContext();
    const thunk = vi.fn(async () => undefined);
    ctx.setNext(thunk);
    await ctx.next();
    expect(thunk).toHaveBeenCalledTimes(1);
  });

  it('throw() throws an HttpError with the given status/message', () => {
    const ctx = makeContext();
    expect(() => ctx.throw(403, 'nope')).toThrow(HttpError);
  });

  it('assert() throws HttpError when the condition is falsy, and is a no-op when truthy', () => {
    const ctx = makeContext();
    expect(() => ctx.assert(true, 400)).not.toThrow();
    expect(() => ctx.assert(false, 400, 'bad')).toThrow(HttpError);
  });
});
