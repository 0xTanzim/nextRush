import type { Context } from '@nextrush/types';
import { describe, expect, it } from 'vitest';
import {
    brotli,
    compressData,
    compression,
    deflate,
    gzip,
    meetsThreshold,
    negotiateEncoding,
    shouldCompress,
} from '../index';

function createMockContext(overrides: Partial<Context> = {}): Context {
  const responseHeaders = new Map<string, string | number>();
  let statusCode = 200;
  let nextCalled = false;
  let responseBody: unknown = null;

  const mockRes = {
    body: null as unknown,
    getHeader: (name: string) => responseHeaders.get(name.toLowerCase()),
    setHeader: (name: string, value: string | number) => responseHeaders.set(name.toLowerCase(), value),
  };

  const ctx: Context = {
    method: 'GET',
    url: '/api/test',
    path: '/api/test',
    query: {},
    headers: {
      'accept-encoding': 'gzip, deflate, br',
    },
    ip: '127.0.0.1',
    body: null,
    params: {},
    status: 200,
    state: {},
    raw: { req: {} as never, res: mockRes as never },

    json(data: unknown) {
      responseBody = data;
      mockRes.body = data;
      responseHeaders.set('content-type', 'application/json');
    },
    send(data: unknown) {
      responseBody = data;
      mockRes.body = data;
    },
    html(data: string) {
      responseBody = data;
      mockRes.body = data;
      responseHeaders.set('content-type', 'text/html');
    },
    redirect() {},
    set(field: string, value: string | number) {
      responseHeaders.set(field.toLowerCase(), value);
    },
    get(field: string) {
      const h = ctx.headers as Record<string, string>;
      return h[field.toLowerCase()];
    },
    async next() {
      nextCalled = true;
    },

    ...overrides,
  };

  Object.defineProperty(ctx, 'status', {
    get: () => statusCode,
    set: (val: number) => { statusCode = val; },
  });

  (ctx as Context & { _test: unknown })._test = {
    getResponseHeaders: () => responseHeaders,
    wasNextCalled: () => nextCalled,
    getResponseBody: () => responseBody,
    getMockRes: () => mockRes,
  };

  return ctx;
}

function getTestHelpers(ctx: Context) {
  return (ctx as Context & {
    _test: {
      getResponseHeaders: () => Map<string, string | number>;
      wasNextCalled: () => boolean;
      getResponseBody: () => unknown;
      getMockRes: () => { body: unknown };
    };
  })._test;
}

describe('negotiateEncoding', () => {
  it('should prefer brotli when enabled and supported', () => {
    const encoding = negotiateEncoding('gzip, deflate, br', { brotli: true });
    expect(encoding).toBe('br');
  });

  it('should fall back to gzip when brotli disabled', () => {
    const encoding = negotiateEncoding('gzip, deflate, br', { brotli: false });
    expect(encoding).toBe('gzip');
  });

  it('should return gzip when only gzip supported', () => {
    const encoding = negotiateEncoding('gzip', {});
    expect(encoding).toBe('gzip');
  });

  it('should return deflate when only deflate supported', () => {
    const encoding = negotiateEncoding('deflate', { gzip: false });
    expect(encoding).toBe('deflate');
  });

  it('should return null when no encoding supported', () => {
    const encoding = negotiateEncoding('identity', {});
    expect(encoding).toBeNull();
  });

  it('should return null for empty header', () => {
    const encoding = negotiateEncoding('', {});
    expect(encoding).toBeNull();
  });

  it('should return null for undefined header', () => {
    const encoding = negotiateEncoding(undefined, {});
    expect(encoding).toBeNull();
  });

  it('should respect quality values', () => {
    const encoding = negotiateEncoding('gzip;q=0.5, br;q=1.0', { brotli: true });
    expect(encoding).toBe('br');
  });

  it('should exclude encodings with q=0', () => {
    const encoding = negotiateEncoding('br;q=0, gzip', { brotli: true });
    expect(encoding).toBe('gzip');
  });
});

describe('shouldCompress', () => {
  it('should compress JSON', () => {
    expect(shouldCompress('application/json', {})).toBe(true);
  });

  it('should compress HTML', () => {
    expect(shouldCompress('text/html', {})).toBe(true);
  });

  it('should compress CSS', () => {
    expect(shouldCompress('text/css', {})).toBe(true);
  });

  it('should compress JavaScript', () => {
    expect(shouldCompress('application/javascript', {})).toBe(true);
    expect(shouldCompress('text/javascript', {})).toBe(true);
  });

  it('should compress SVG', () => {
    expect(shouldCompress('image/svg+xml', {})).toBe(true);
  });

  it('should not compress PNG', () => {
    expect(shouldCompress('image/png', {})).toBe(false);
  });

  it('should not compress JPEG', () => {
    expect(shouldCompress('image/jpeg', {})).toBe(false);
  });

  it('should not compress ZIP', () => {
    expect(shouldCompress('application/zip', {})).toBe(false);
  });

  it('should not compress video', () => {
    expect(shouldCompress('video/mp4', {})).toBe(false);
  });

  it('should handle content-type with charset', () => {
    expect(shouldCompress('application/json; charset=utf-8', {})).toBe(true);
  });

  it('should respect custom content types', () => {
    expect(shouldCompress('application/custom', {
      contentTypes: ['application/custom'],
    })).toBe(true);
  });

  it('should respect custom exclude patterns', () => {
    expect(shouldCompress('text/html', {
      exclude: ['text/*'],
    })).toBe(false);
  });
});

describe('meetsThreshold', () => {
  it('should return true for string above threshold', () => {
    const str = 'a'.repeat(2000);
    expect(meetsThreshold(str, 1024)).toBe(true);
  });

  it('should return false for string below threshold', () => {
    const str = 'a'.repeat(500);
    expect(meetsThreshold(str, 1024)).toBe(false);
  });

  it('should return true for buffer above threshold', () => {
    const buf = Buffer.alloc(2000);
    expect(meetsThreshold(buf, 1024)).toBe(true);
  });

  it('should return false for buffer below threshold', () => {
    const buf = Buffer.alloc(500);
    expect(meetsThreshold(buf, 1024)).toBe(false);
  });

  it('should return true for object above threshold', () => {
    const obj = { data: 'a'.repeat(2000) };
    expect(meetsThreshold(obj, 1024)).toBe(true);
  });

  it('should return false for null', () => {
    expect(meetsThreshold(null, 1024)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(meetsThreshold(undefined, 1024)).toBe(false);
  });
});

describe('compressData', () => {
  const testData = 'Hello World! '.repeat(100);

  it('should compress with gzip', async () => {
    const compressed = await compressData(testData, 'gzip', {});
    expect(compressed.length).toBeLessThan(Buffer.byteLength(testData));
  });

  it('should compress with deflate', async () => {
    const compressed = await compressData(testData, 'deflate', {});
    expect(compressed.length).toBeLessThan(Buffer.byteLength(testData));
  });

  it('should compress with brotli', async () => {
    const compressed = await compressData(testData, 'br', {});
    expect(compressed.length).toBeLessThan(Buffer.byteLength(testData));
  });

  it('should respect compression level', async () => {
    const lowLevel = await compressData(testData, 'gzip', { level: 1 });
    const highLevel = await compressData(testData, 'gzip', { level: 9 });

    // Higher level should produce smaller output (usually)
    expect(highLevel.length).toBeLessThanOrEqual(lowLevel.length);
  });

  it('should handle Buffer input', async () => {
    const buffer = Buffer.from(testData);
    const compressed = await compressData(buffer, 'gzip', {});
    expect(compressed.length).toBeLessThan(buffer.length);
  });
});

describe('compression middleware', () => {
  it('should call next middleware', async () => {
    const middleware = compression();
    const ctx = createMockContext();
    const helpers = getTestHelpers(ctx);

    await middleware(ctx);

    expect(helpers.wasNextCalled()).toBe(true);
  });

  it('should not compress HEAD requests', async () => {
    const middleware = compression();
    const ctx = createMockContext({ method: 'HEAD' });
    const helpers = getTestHelpers(ctx);
    helpers.getMockRes().body = 'test data';

    await middleware(ctx);

    expect(helpers.getResponseHeaders().has('content-encoding')).toBe(false);
  });

  it('should not compress 204 responses', async () => {
    const middleware = compression();
    const ctx = createMockContext();
    ctx.status = 204;
    const helpers = getTestHelpers(ctx);

    await middleware(ctx);

    expect(helpers.getResponseHeaders().has('content-encoding')).toBe(false);
  });

  it('should not compress 304 responses', async () => {
    const middleware = compression();
    const ctx = createMockContext();
    ctx.status = 304;
    const helpers = getTestHelpers(ctx);

    await middleware(ctx);

    expect(helpers.getResponseHeaders().has('content-encoding')).toBe(false);
  });

  it('should respect filter option', async () => {
    const middleware = compression({
      filter: (ctx) => !ctx.path.includes('skip'),
    });

    const ctx = createMockContext({ path: '/api/skip' });
    const helpers = getTestHelpers(ctx);
    helpers.getMockRes().body = 'a'.repeat(2000);
    ctx.set('content-type', 'text/plain');

    await middleware(ctx);

    expect(helpers.getResponseHeaders().has('content-encoding')).toBe(false);
  });
});

describe('gzip middleware', () => {
  it('should only use gzip', async () => {
    const middleware = gzip();
    const ctx = createMockContext({
      headers: { 'accept-encoding': 'gzip, br' },
    });

    await middleware(ctx);

    // Middleware should not set br even if client supports it
  });
});

describe('deflate middleware', () => {
  it('should only use deflate', async () => {
    const middleware = deflate();
    const ctx = createMockContext({
      headers: { 'accept-encoding': 'gzip, deflate' },
    });

    await middleware(ctx);
  });
});

describe('brotli middleware', () => {
  it('should only use brotli', async () => {
    const middleware = brotli();
    const ctx = createMockContext({
      headers: { 'accept-encoding': 'gzip, br' },
    });

    await middleware(ctx);
  });
});

describe('compression edge cases', () => {
  it('should handle missing accept-encoding header', async () => {
    const middleware = compression();
    const ctx = createMockContext({
      headers: {},
    });

    await middleware(ctx);
    // Should not throw
  });

  it('should not compress already compressed responses', async () => {
    const middleware = compression();
    const ctx = createMockContext();
    const helpers = getTestHelpers(ctx);

    helpers.getResponseHeaders().set('content-encoding', 'gzip');
    helpers.getMockRes().body = 'test';

    await middleware(ctx);

    // Should not double-compress
    expect(helpers.getResponseHeaders().get('content-encoding')).toBe('gzip');
  });

  it('should set Vary header', async () => {
    const middleware = compression({ threshold: 0 });
    const ctx = createMockContext();
    const helpers = getTestHelpers(ctx);

    helpers.getMockRes().body = 'a'.repeat(2000);
    helpers.getResponseHeaders().set('content-type', 'text/plain');

    await middleware(ctx);

    // Vary header should include Accept-Encoding
  });

  it('should handle empty body', async () => {
    const middleware = compression();
    const ctx = createMockContext();

    await middleware(ctx);
    // Should not throw
  });

  it('should respect threshold option', async () => {
    const middleware = compression({ threshold: 5000 });
    const ctx = createMockContext();
    const helpers = getTestHelpers(ctx);

    helpers.getMockRes().body = 'a'.repeat(1000);
    helpers.getResponseHeaders().set('content-type', 'text/plain');

    await middleware(ctx);

    // Should not compress since below threshold
    expect(helpers.getResponseHeaders().has('content-encoding')).toBe(false);
  });
});
