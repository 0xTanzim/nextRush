/**
 * @nextrush/body-parser - Lazy parsing (RFC-047)
 *
 * Pins the contract that justifies the option: an unread request performs no
 * read, no parse, no depth walk and no `verify`; an explicit `readBody()` does
 * the eager path's work exactly once and caches both success and failure.
 *
 * The mock context delegates `readBody()` through the same {@link BODY_READER}
 * slot the real contexts use, so these tests fail if the install protocol and
 * the accessor disagree.
 */

import { BODY_READER, type BodyReaderCarrier } from '@nextrush/types';
import { describe, expect, it, vi } from 'vitest';

import { bodyParser, BodyParserError, json, text } from '../index';
import type { BodyParserBodySource, BodyParserContext } from '../types';

interface TestContext extends BodyParserContext {
  readBody<T = unknown>(): Promise<T>;
}

interface SpySource extends BodyParserBodySource {
  readonly reads: number;
  readTextIfProvenWithin?(limit: number): Promise<string | undefined>;
}

function createSource(raw: string, contentLength?: number): SpySource {
  const bytes = new TextEncoder().encode(raw);
  let reads = 0;
  return {
    async text() {
      reads += 1;
      return raw;
    },
    async buffer() {
      reads += 1;
      return bytes;
    },
    async json<T>() {
      reads += 1;
      return JSON.parse(raw) as T;
    },
    async readTextIfProvenWithin() {
      reads += 1;
      return raw;
    },
    get consumed() {
      return reads > 0;
    },
    get contentLength() {
      return contentLength;
    },
    get contentType() {
      return 'application/json';
    },
    get reads() {
      return reads;
    },
  } as SpySource;
}

function createContext(
  source: SpySource,
  options: { method?: string; contentType?: string; contentLength?: number } = {}
): TestContext {
  const headers: Record<string, string> = {};
  if (options.contentType !== undefined) headers['content-type'] = options.contentType;
  if (options.contentLength !== undefined) {
    headers['content-length'] = String(options.contentLength);
  }

  const ctx: TestContext = {
    method: options.method ?? 'POST',
    path: '/',
    headers,
    bodySource: source,
    body: undefined,
    readBody<T = unknown>(): Promise<T> {
      const reader = (ctx as BodyReaderCarrier)[BODY_READER];
      return reader === undefined ? Promise.resolve(ctx.body as T) : reader.read<T>();
    },
  };
  return ctx;
}

/** Read `ctx.body` and return whatever it throws, or the value. */
function readBodyProperty(ctx: TestContext): { value?: unknown; error?: unknown } {
  try {
    return { value: ctx.body };
  } catch (error) {
    return { error };
  }
}

const JSON_TYPE = 'application/json';

describe('lazy mode — an unread request does no work', () => {
  it('does not touch the body source', async () => {
    const source = createSource('{"a":1}');
    const ctx = createContext(source, { contentType: JSON_TYPE });
    const next = vi.fn(async () => {});

    await bodyParser({ lazy: true })(ctx as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(source.reads).toBe(0);
    expect(source.consumed).toBe(false);
  });

  it('does not run verify', async () => {
    const source = createSource('{"a":1}');
    const ctx = createContext(source, { contentType: JSON_TYPE });
    const verify = vi.fn(async () => {});
    const next = vi.fn(async () => {});

    await bodyParser({ lazy: true, json: { verify } })(ctx as never, next);

    expect(verify).not.toHaveBeenCalled();
    expect(source.reads).toBe(0);
  });

  it('does not parse, so a malformed body produces no error', async () => {
    const source = createSource('{not json');
    const ctx = createContext(source, { contentType: JSON_TYPE });
    const next = vi.fn(async () => {});

    await expect(bodyParser({ lazy: true })(ctx as never, next)).resolves.toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
    expect(source.reads).toBe(0);
  });

  it('throws BODY_NOT_READ on ctx.body instead of returning undefined', async () => {
    const source = createSource('{"a":1}');
    const ctx = createContext(source, { contentType: JSON_TYPE });

    await bodyParser({ lazy: true })(ctx as never, async () => {});

    const { error } = readBodyProperty(ctx);
    expect(error).toBeInstanceOf(BodyParserError);
    expect((error as BodyParserError).code).toBe('BODY_NOT_READ');
    expect((error as BodyParserError).status).toBe(500);
    expect((error as BodyParserError).expose).toBe(false);
    expect((error as BodyParserError).message).toContain('readBody()');
  });

  it('leaves rawBody undefined until the body is read', async () => {
    const source = createSource('{"a":1}');
    const ctx = createContext(source, { contentType: JSON_TYPE });

    await bodyParser({ lazy: true, json: { rawBody: true } })(ctx as never, async () => {});

    expect(ctx.rawBody).toBeUndefined();
  });

  it('installs no reader for a bodyless method', async () => {
    const source = createSource('');
    const ctx = createContext(source, { method: 'GET', contentType: JSON_TYPE });

    await bodyParser({ lazy: true })(ctx as never, async () => {});

    expect((ctx as BodyReaderCarrier)[BODY_READER]).toBeUndefined();
    expect(ctx.body).toBeUndefined();
    await expect(ctx.readBody()).resolves.toBeUndefined();
  });
});

describe('lazy mode — readBody() happy path', () => {
  it('parses once and publishes ctx.body', async () => {
    const source = createSource('{"a":1}');
    const ctx = createContext(source, { contentType: JSON_TYPE });

    await bodyParser({ lazy: true })(ctx as never, async () => {});
    await expect(ctx.readBody()).resolves.toEqual({ a: 1 });

    expect(source.reads).toBe(1);
    expect(ctx.body).toEqual({ a: 1 });
  });

  it('returns the same object identity on repeated reads', async () => {
    const source = createSource('{"a":1}');
    const ctx = createContext(source, { contentType: JSON_TYPE });

    await bodyParser({ lazy: true })(ctx as never, async () => {});
    const first = await ctx.readBody();
    const second = await ctx.readBody();

    expect(second).toBe(first);
    expect(ctx.body).toBe(first);
    expect(source.reads).toBe(1);
  });

  it('shares one in-flight read between concurrent callers', async () => {
    const source = createSource('{"a":1}');
    const ctx = createContext(source, { contentType: JSON_TYPE });

    await bodyParser({ lazy: true })(ctx as never, async () => {});
    const [a, b] = await Promise.all([ctx.readBody(), ctx.readBody()]);

    expect(a).toBe(b);
    expect(source.reads).toBe(1);
  });

  it('resolves undefined for an empty JSON body', async () => {
    const source = createSource('');
    const ctx = createContext(source, { contentType: JSON_TYPE });

    await bodyParser({ lazy: true })(ctx as never, async () => {});

    await expect(ctx.readBody()).resolves.toBeUndefined();
    expect(ctx.body).toBeUndefined();
  });

  it('works through a standalone parser that opted in', async () => {
    const source = createSource('{"id":"x"}');
    const ctx = createContext(source, { contentType: JSON_TYPE });

    await json({ lazy: true })(ctx as never, async () => {});
    await expect(ctx.readBody<{ id: string }>()).resolves.toEqual({ id: 'x' });
  });

  it('keeps the text parser contract for an empty body', async () => {
    const source = createSource('');
    const ctx = createContext(source, { contentType: 'text/plain' });

    await text({ lazy: true })(ctx as never, async () => {});

    await expect(ctx.readBody()).resolves.toBe('');
    expect(ctx.body).toBe('');
  });
});

describe('lazy mode — failure caching and error mapping', () => {
  it('rejects invalid JSON at the read, not before next()', async () => {
    const source = createSource('{not json');
    const ctx = createContext(source, { contentType: JSON_TYPE });

    await bodyParser({ lazy: true })(ctx as never, async () => {});

    await expect(ctx.readBody()).rejects.toMatchObject({
      name: 'BodyParserError',
      code: 'INVALID_JSON',
      status: 400,
    });
  });

  it('caches the failure and never re-reads the stream', async () => {
    const source = createSource('{not json');
    const ctx = createContext(source, { contentType: JSON_TYPE });

    await bodyParser({ lazy: true })(ctx as never, async () => {});

    let first: unknown;
    let second: unknown;
    try {
      await ctx.readBody();
    } catch (error) {
      first = error;
    }
    try {
      await ctx.readBody();
    } catch (error) {
      second = error;
    }

    expect(first).toBeInstanceOf(BodyParserError);
    expect(second).toBe(first);
    expect(source.reads).toBe(1);
  });

  it('rethrows the cached failure from ctx.body', async () => {
    const source = createSource('{not json');
    const ctx = createContext(source, { contentType: JSON_TYPE });

    await bodyParser({ lazy: true })(ctx as never, async () => {});
    await expect(ctx.readBody()).rejects.toBeInstanceOf(BodyParserError);

    const { error } = readBodyProperty(ctx);
    expect(error).toBeInstanceOf(BodyParserError);
    expect((error as BodyParserError).code).toBe('INVALID_JSON');
  });

  it('rejects deep JSON after parsing', async () => {
    const source = createSource('[[[1]]]');
    const ctx = createContext(source, { contentType: JSON_TYPE });

    await bodyParser({ lazy: true, json: { maxDepth: 2 } })(ctx as never, async () => {});

    await expect(ctx.readBody()).rejects.toMatchObject({ code: 'JSON_DEPTH_EXCEEDED' });
  });

  it('rejects an oversized declared body without reading bytes', async () => {
    const source = createSource('{"a":1}', 200);
    const ctx = createContext(source, { contentType: JSON_TYPE, contentLength: 200 });

    await bodyParser({ lazy: true, json: { limit: '100b' } })(ctx as never, async () => {});

    await expect(ctx.readBody()).rejects.toMatchObject({ code: 'ENTITY_TOO_LARGE', status: 413 });
    expect(source.reads).toBe(0);
  });

  it('runs verify before publishing the body', async () => {
    const source = createSource('{"a":1}');
    const ctx = createContext(source, { contentType: JSON_TYPE });
    const order: string[] = [];
    const seen: unknown[] = [];
    const verify = vi.fn(async (_ctx: unknown, bytes: Uint8Array) => {
      order.push('verify');
      seen.push(bytes);
    });

    await bodyParser({ lazy: true, json: { verify, rawBody: true } })(ctx as never, async () => {});
    order.push('before-read');
    await ctx.readBody();

    expect(verify).toHaveBeenCalledTimes(1);
    expect(seen[0]).toBeInstanceOf(Uint8Array);
    expect(order).toEqual(['before-read', 'verify']);
    expect(ctx.rawBody).toBeInstanceOf(Uint8Array);
  });
});

describe('lazy mode — interaction with other middleware', () => {
  it('honours a body written upstream without throwing', async () => {
    const source = createSource('{"a":1}');
    const ctx = createContext(source, { contentType: JSON_TYPE });
    ctx.body = { upstream: true };

    const next = vi.fn(async () => {});
    await bodyParser({ lazy: true })(ctx as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(ctx.body).toEqual({ upstream: true });
    expect(source.reads).toBe(0);
  });

  it('keeps the unsupported-content-type rejection eager', async () => {
    const source = createSource('<xml/>');
    const ctx = createContext(source, { contentType: 'application/xml' });

    await expect(
      bodyParser({ lazy: true, onUnsupportedContentType: 'reject' })(ctx as never, async () => {})
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_CONTENT_TYPE', status: 415 });
    expect(source.reads).toBe(0);
  });

  it('parses once when two lazy body parsers are registered', async () => {
    const source = createSource('{"a":1}');
    const ctx = createContext(source, { contentType: JSON_TYPE });

    await bodyParser({ lazy: true })(ctx as never, async () => {});
    await bodyParser({ lazy: true })(ctx as never, async () => {});

    await expect(ctx.readBody()).resolves.toEqual({ a: 1 });
    expect(source.reads).toBe(1);
  });
});

describe('lazy mode — writes and reads agree on one body', () => {
  it('returns a written body from a later readBody() without reading the stream', async () => {
    const source = createSource('{"a":1}');
    const ctx = createContext(source, { contentType: JSON_TYPE });
    await bodyParser({ lazy: true })(ctx as never, async () => {});

    // A validation coercion or any other middleware write.
    ctx.body = { coerced: true };

    await expect(ctx.readBody()).resolves.toEqual({ coerced: true });
    expect(ctx.body).toEqual({ coerced: true });
    expect(source.reads).toBe(0);
  });

  it('keeps a write that lands while the read is in flight', async () => {
    let reads = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const source = {
      async text() {
        reads += 1;
        await gate;
        return '{"a":1}';
      },
      async buffer() {
        reads += 1;
        await gate;
        return new TextEncoder().encode('{"a":1}');
      },
      async json<T>() {
        return { a: 1 } as T;
      },
      get consumed() {
        return reads > 0;
      },
      get contentLength() {
        return undefined;
      },
      get contentType() {
        return 'application/json';
      },
    } as unknown as SpySource;
    const ctx = createContext(source, { contentType: JSON_TYPE });
    await bodyParser({ lazy: true })(ctx as never, async () => {});

    const pending = ctx.readBody<{ a: number }>();
    ctx.body = { written: true };
    release();

    // The caller that already awaited gets its read; the later state is the write.
    await expect(pending).resolves.toEqual({ a: 1 });
    expect(ctx.body).toEqual({ written: true });
    await expect(ctx.readBody()).resolves.toEqual({ written: true });
  });

  it('reports the request as claimed, so a later eager parser does not read it', async () => {
    const source = createSource('{"a":1}');
    const ctx = createContext(source, { contentType: JSON_TYPE });

    await bodyParser({ lazy: true })(ctx as never, async () => {});
    await json()(ctx as never, async () => {});

    expect(source.reads).toBe(0);
    await expect(ctx.readBody()).resolves.toEqual({ a: 1 });
    expect(source.reads).toBe(1);
  });

  it('maps a body that only exceeds the limit while streaming to the eager 413', async () => {
    // No Content-Length: the source discovers the size mid-read, exactly as the
    // adapter's incremental limit does.
    const source = {
      async buffer() {
        const error = new Error('body too large');
        error.name = 'BodyTooLargeError';
        throw error;
      },
      async text() {
        return '';
      },
      async json<T>() {
        return undefined as T;
      },
      get consumed() {
        return false;
      },
      get contentLength() {
        return undefined;
      },
      get contentType() {
        return 'application/json';
      },
    } as unknown as SpySource;
    const ctx = createContext(source, { contentType: JSON_TYPE });
    await bodyParser({ lazy: true })(ctx as never, async () => {});

    await expect(ctx.readBody()).rejects.toMatchObject({
      code: 'ENTITY_TOO_LARGE',
      status: 413,
    });
  });
});

describe('eager mode — unchanged, and readBody() works there too', () => {
  it('publishes ctx.body before next() runs', async () => {
    const source = createSource('{"a":1}');
    const ctx = createContext(source, { contentType: JSON_TYPE });
    let seen: unknown;

    await bodyParser()(ctx as never, async () => {
      seen = ctx.body;
    });

    expect(seen).toEqual({ a: 1 });
  });

  it('resolves readBody() from the already-parsed value', async () => {
    const source = createSource('{"a":1}');
    const ctx = createContext(source, { contentType: JSON_TYPE });

    await bodyParser()(ctx as never, async () => {});

    await expect(ctx.readBody()).resolves.toEqual({ a: 1 });
    expect(source.reads).toBe(1);
    expect((ctx as BodyReaderCarrier)[BODY_READER]).toBeUndefined();
  });

  it('keeps the eager 413 before next() runs', async () => {
    const source = createSource('{"a":1}', 200);
    const ctx = createContext(source, { contentType: JSON_TYPE, contentLength: 200 });
    const next = vi.fn(async () => {});

    await expect(bodyParser({ json: { limit: '100b' } })(ctx as never, next)).rejects.toMatchObject(
      { code: 'ENTITY_TOO_LARGE' }
    );
    expect(next).not.toHaveBeenCalled();
  });
});
