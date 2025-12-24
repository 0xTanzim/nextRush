import type { Context } from '@nextrush/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createMemoryStore,
    extractClientIp,
    fixedWindow,
    getAlgorithm,
    isIpInList,
    normalizeIp,
    parseWindow,
    rateLimit,
    slidingWindow,
    tieredRateLimit,
    tokenBucket,
} from '../index';

function createMockContext(overrides: Partial<Context> = {}): Context {
  const responseHeaders = new Map<string, string | number>();
  let statusCode = 200;
  let nextCalled = false;
  let responseBody: unknown = null;

  const ctx: Context = {
    method: 'GET',
    url: '/api/test',
    path: '/api/test',
    query: {},
    headers: {},
    ip: '192.168.1.1',
    body: null,
    params: {},
    status: 200,
    state: {},
    raw: { req: {} as never, res: {} as never },

    json(data: unknown) {
      responseBody = data;
      responseHeaders.set('Content-Type', 'application/json');
    },
    send() {},
    html() {},
    redirect() {},
    set(field: string, value: string | number) {
      responseHeaders.set(field, value);
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
    resetNextCalled: () => { nextCalled = false; },
  };

  return ctx;
}

function getTestHelpers(ctx: Context) {
  return (ctx as Context & { _test: {
    getResponseHeaders: () => Map<string, string | number>;
    wasNextCalled: () => boolean;
    getResponseBody: () => unknown;
    resetNextCalled: () => void;
  }})._test;
}

describe('parseWindow', () => {
  it('should parse seconds', () => {
    expect(parseWindow('1s')).toBe(1000);
    expect(parseWindow('30s')).toBe(30000);
    expect(parseWindow('1sec')).toBe(1000);
    expect(parseWindow('5seconds')).toBe(5000);
  });

  it('should parse minutes', () => {
    expect(parseWindow('1m')).toBe(60000);
    expect(parseWindow('5m')).toBe(300000);
    expect(parseWindow('15min')).toBe(900000);
    expect(parseWindow('1minute')).toBe(60000);
  });

  it('should parse hours', () => {
    expect(parseWindow('1h')).toBe(3600000);
    expect(parseWindow('2hr')).toBe(7200000);
    expect(parseWindow('1hour')).toBe(3600000);
  });

  it('should parse days', () => {
    expect(parseWindow('1d')).toBe(86400000);
    expect(parseWindow('7days')).toBe(604800000);
  });

  it('should accept milliseconds as number', () => {
    expect(parseWindow(5000)).toBe(5000);
    expect(parseWindow(60000)).toBe(60000);
  });

  it('should throw for invalid format', () => {
    expect(() => parseWindow('invalid')).toThrow();
    expect(() => parseWindow('5x')).toThrow();
    expect(() => parseWindow('')).toThrow();
  });
});

describe('MemoryStore', () => {
  let store: ReturnType<typeof createMemoryStore>;

  beforeEach(() => {
    store = createMemoryStore({ disableCleanup: true });
  });

  afterEach(async () => {
    await store.shutdown();
  });

  it('should store and retrieve entries', async () => {
    await store.set('key1', { count: 5, windowStart: Date.now() }, 60000);
    const entry = await store.get('key1');

    expect(entry).not.toBeNull();
    expect(entry?.count).toBe(5);
  });

  it('should return null for non-existent keys', async () => {
    const entry = await store.get('nonexistent');
    expect(entry).toBeNull();
  });

  it('should increment counter', async () => {
    const count1 = await store.increment('key1', 60000);
    const count2 = await store.increment('key1', 60000);
    const count3 = await store.increment('key1', 60000);

    expect(count1).toBe(1);
    expect(count2).toBe(2);
    expect(count3).toBe(3);
  });

  it('should reset entries', async () => {
    await store.set('key1', { count: 10, windowStart: Date.now() }, 60000);
    await store.reset('key1');

    const entry = await store.get('key1');
    expect(entry).toBeNull();
  });

  it('should expire entries', async () => {
    await store.set('key1', { count: 5, windowStart: Date.now() }, 1);
    await new Promise((r) => setTimeout(r, 10));

    const entry = await store.get('key1');
    expect(entry).toBeNull();
  });

  it('should cleanup expired entries', async () => {
    await store.set('key1', { count: 5, windowStart: Date.now() }, 1);
    await store.set('key2', { count: 5, windowStart: Date.now() }, 60000);

    await new Promise((r) => setTimeout(r, 10));
    await store.cleanup();

    expect(store.size).toBe(1);
  });
});

describe('Algorithms', () => {
  let store: ReturnType<typeof createMemoryStore>;

  beforeEach(() => {
    store = createMemoryStore({ disableCleanup: true });
  });

  afterEach(async () => {
    await store.shutdown();
  });

  describe('getAlgorithm', () => {
    it('should return correct algorithms', () => {
      expect(getAlgorithm('token-bucket').name).toBe('token-bucket');
      expect(getAlgorithm('sliding-window').name).toBe('sliding-window');
      expect(getAlgorithm('fixed-window').name).toBe('fixed-window');
    });

    it('should throw for unknown algorithm', () => {
      expect(() => getAlgorithm('unknown' as never)).toThrow();
    });
  });

  describe('Token Bucket', () => {
    it('should allow requests within limit', async () => {
      const info = await tokenBucket.consume('key1', 10, 60000, store);

      expect(info.allowed).toBe(true);
      expect(info.remaining).toBeLessThanOrEqual(10);
    });

    it('should block requests over limit', async () => {
      for (let i = 0; i < 10; i++) {
        await tokenBucket.consume('key1', 10, 60000, store);
      }

      const info = await tokenBucket.consume('key1', 10, 60000, store);
      expect(info.allowed).toBe(false);
      expect(info.remaining).toBe(0);
    });

    it('should refill tokens over time', async () => {
      for (let i = 0; i < 10; i++) {
        await tokenBucket.consume('key1', 10, 1000, store);
      }

      let info = await tokenBucket.consume('key1', 10, 1000, store);
      expect(info.allowed).toBe(false);

      await new Promise((r) => setTimeout(r, 200));

      info = await tokenBucket.consume('key1', 10, 1000, store);
      expect(info.allowed).toBe(true);
    });
  });

  describe('Sliding Window', () => {
    it('should allow requests within limit', async () => {
      const info = await slidingWindow.consume('key1', 10, 60000, store);

      expect(info.allowed).toBe(true);
      expect(info.remaining).toBe(9);
    });

    it('should block requests over limit', async () => {
      for (let i = 0; i < 10; i++) {
        await slidingWindow.consume('key1', 10, 60000, store);
      }

      const info = await slidingWindow.consume('key1', 10, 60000, store);
      expect(info.allowed).toBe(false);
    });

    it('should use weighted previous window', async () => {
      for (let i = 0; i < 8; i++) {
        await slidingWindow.consume('key1', 10, 100, store);
      }

      await new Promise((r) => setTimeout(r, 150));

      const info = await slidingWindow.consume('key1', 10, 100, store);
      expect(info.allowed).toBe(true);
    });
  });

  describe('Fixed Window', () => {
    it('should allow requests within limit', async () => {
      const info = await fixedWindow.consume('key1', 10, 60000, store);

      expect(info.allowed).toBe(true);
      expect(info.remaining).toBe(9);
    });

    it('should block requests over limit', async () => {
      for (let i = 0; i < 10; i++) {
        await fixedWindow.consume('key1', 10, 60000, store);
      }

      const info = await fixedWindow.consume('key1', 10, 60000, store);
      expect(info.allowed).toBe(false);
    });

    it('should reset at window boundary', async () => {
      for (let i = 0; i < 10; i++) {
        await fixedWindow.consume('key1', 10, 50, store);
      }

      await new Promise((r) => setTimeout(r, 60));

      const info = await fixedWindow.consume('key1', 10, 50, store);
      expect(info.allowed).toBe(true);
    });
  });
});

describe('IP Utilities', () => {
  describe('normalizeIp', () => {
    it('should handle IPv4', () => {
      expect(normalizeIp('192.168.1.1')).toBe('192.168.1.1');
      expect(normalizeIp('  192.168.1.1  ')).toBe('192.168.1.1');
    });

    it('should handle IPv4-mapped IPv6', () => {
      expect(normalizeIp('::ffff:192.168.1.1')).toBe('192.168.1.1');
    });

    it('should handle IPv6 brackets', () => {
      expect(normalizeIp('[::1]')).toBe('::1');
    });

    it('should lowercase IPv6', () => {
      expect(normalizeIp('2001:DB8::1')).toBe('2001:db8::1');
    });
  });

  describe('extractClientIp', () => {
    it('should use ctx.ip when trustProxy is false', () => {
      const ctx = createMockContext({
        ip: '192.168.1.1',
        headers: { 'x-forwarded-for': '10.0.0.1' },
      });

      expect(extractClientIp(ctx, false)).toBe('192.168.1.1');
    });

    it('should use X-Forwarded-For when trustProxy is true', () => {
      const ctx = createMockContext({
        ip: '192.168.1.1',
        headers: { 'x-forwarded-for': '10.0.0.1, 172.16.0.1' },
      });

      expect(extractClientIp(ctx, true)).toBe('10.0.0.1');
    });

    it('should use CF-Connecting-IP when present', () => {
      const ctx = createMockContext({
        ip: '192.168.1.1',
        headers: {
          'cf-connecting-ip': '203.0.113.1',
          'x-forwarded-for': '10.0.0.1',
        },
      });

      expect(extractClientIp(ctx, true)).toBe('203.0.113.1');
    });
  });

  describe('isIpInList', () => {
    it('should match IPs in list', () => {
      const list = ['192.168.1.1', '10.0.0.1'];
      expect(isIpInList('192.168.1.1', list)).toBe(true);
      expect(isIpInList('10.0.0.1', list)).toBe(true);
    });

    it('should not match IPs not in list', () => {
      const list = ['192.168.1.1'];
      expect(isIpInList('192.168.1.2', list)).toBe(false);
    });

    it('should normalize before comparing', () => {
      const list = ['::ffff:192.168.1.1'];
      expect(isIpInList('192.168.1.1', list)).toBe(true);
    });
  });
});

describe('rateLimit Middleware', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should allow requests within limit', async () => {
    const middleware = rateLimit({ max: 10, window: '1m' });
    const ctx = createMockContext();
    const helpers = getTestHelpers(ctx);

    await middleware(ctx);

    expect(helpers.wasNextCalled()).toBe(true);
    expect(ctx.status).toBe(200);

    await middleware.shutdown();
  });

  it('should block requests over limit', async () => {
    const middleware = rateLimit({ max: 3, window: '1m' });
    const ctx = createMockContext();
    const helpers = getTestHelpers(ctx);

    for (let i = 0; i < 3; i++) {
      helpers.resetNextCalled();
      await middleware(ctx);
    }

    helpers.resetNextCalled();
    await middleware(ctx);

    expect(helpers.wasNextCalled()).toBe(false);
    expect(ctx.status).toBe(429);

    await middleware.shutdown();
  });

  it('should set rate limit headers', async () => {
    const middleware = rateLimit({ max: 100, window: '1m' });
    const ctx = createMockContext();
    const helpers = getTestHelpers(ctx);

    await middleware(ctx);

    const headers = helpers.getResponseHeaders();
    expect(headers.has('X-RateLimit-Limit')).toBe(true);
    expect(headers.has('X-RateLimit-Remaining')).toBe(true);
    expect(headers.has('RateLimit-Limit')).toBe(true);

    await middleware.shutdown();
  });

  it('should use custom key generator', async () => {
    const middleware = rateLimit({
      max: 2,
      window: '1m',
      keyGenerator: (ctx) => `api:${ctx.get('x-api-key')}`,
    });

    const ctx1 = createMockContext({ headers: { 'x-api-key': 'key1' } });
    const ctx2 = createMockContext({ headers: { 'x-api-key': 'key2' } });

    await middleware(ctx1);
    await middleware(ctx1);
    await middleware(ctx1);

    const helpers1 = getTestHelpers(ctx1);
    expect(ctx1.status).toBe(429);

    await middleware(ctx2);
    const helpers2 = getTestHelpers(ctx2);
    expect(helpers2.wasNextCalled()).toBe(true);

    await middleware.shutdown();
  });

  it('should skip when skip function returns true', async () => {
    const middleware = rateLimit({
      max: 1,
      window: '1m',
      skip: (ctx) => ctx.path === '/health',
    });

    const ctx = createMockContext({ path: '/health' });
    const helpers = getTestHelpers(ctx);

    await middleware(ctx);
    await middleware(ctx);
    await middleware(ctx);

    expect(helpers.wasNextCalled()).toBe(true);
    expect(ctx.status).toBe(200);

    await middleware.shutdown();
  });

  it('should skip whitelisted IPs', async () => {
    const middleware = rateLimit({
      max: 1,
      window: '1m',
      whitelist: ['192.168.1.100'],
    });

    const ctx = createMockContext({ ip: '192.168.1.100' });
    const helpers = getTestHelpers(ctx);

    await middleware(ctx);
    await middleware(ctx);
    await middleware(ctx);

    expect(helpers.wasNextCalled()).toBe(true);

    await middleware.shutdown();
  });

  it('should apply lower limits to blacklisted IPs', async () => {
    const middleware = rateLimit({
      max: 10,
      window: '1m',
      blacklist: ['192.168.1.200'],
      blacklistMultiplier: 0.1,
    });

    const ctx = createMockContext({ ip: '192.168.1.200' });

    await middleware(ctx);
    await middleware(ctx);

    expect(ctx.status).toBe(429);

    await middleware.shutdown();
  });

  it('should use custom handler', async () => {
    let handlerCalled = false;

    const middleware = rateLimit({
      max: 1,
      window: '1m',
      handler: (ctx, info) => {
        handlerCalled = true;
        ctx.status = 503;
        ctx.json({ custom: 'response', reset: info.resetIn });
      },
    });

    const ctx = createMockContext();
    await middleware(ctx);
    await middleware(ctx);

    expect(handlerCalled).toBe(true);
    expect(ctx.status).toBe(503);

    await middleware.shutdown();
  });

  it('should call onRateLimited callback', async () => {
    let callbackInfo: unknown = null;

    const middleware = rateLimit({
      max: 1,
      window: '1m',
      onRateLimited: (_ctx, info) => {
        callbackInfo = info;
      },
    });

    const ctx = createMockContext();
    await middleware(ctx);
    await middleware(ctx);

    expect(callbackInfo).not.toBeNull();
    expect((callbackInfo as { allowed: boolean }).allowed).toBe(false);

    await middleware.shutdown();
  });

  it('should support different algorithms', async () => {
    const algorithms = ['token-bucket', 'sliding-window', 'fixed-window'] as const;

    for (const algorithm of algorithms) {
      const middleware = rateLimit({ algorithm, max: 5, window: '1m' });
      const ctx = createMockContext({ ip: `test-${algorithm}` });
      const helpers = getTestHelpers(ctx);

      await middleware(ctx);

      expect(helpers.wasNextCalled()).toBe(true);
      await middleware.shutdown();
    }
  });

  it('should expose reset method', async () => {
    const middleware = rateLimit({ max: 2, window: '1m' });
    const ctx = createMockContext();

    await middleware(ctx);
    await middleware(ctx);
    await middleware(ctx);

    expect(ctx.status).toBe(429);

    await middleware.reset('rl:192.168.1.1');

    const ctx2 = createMockContext();
    const helpers = getTestHelpers(ctx2);
    await middleware(ctx2);

    expect(helpers.wasNextCalled()).toBe(true);

    await middleware.shutdown();
  });

  it('should support trustProxy option', async () => {
    const middleware = rateLimit({
      max: 2,
      window: '1m',
      trustProxy: true,
    });

    const ctx = createMockContext({
      ip: '127.0.0.1',
      headers: { 'x-forwarded-for': '10.0.0.50' },
    });

    await middleware(ctx);
    await middleware(ctx);
    await middleware(ctx);

    expect(ctx.status).toBe(429);

    await middleware.shutdown();
  });
});

describe('tieredRateLimit Middleware', () => {
  it('should apply different limits per tier', async () => {
    const middleware = tieredRateLimit({
      tiers: {
        free: { max: 2, window: '1m' },
        premium: { max: 100, window: '1m' },
      },
      tierResolver: (ctx) => (ctx.state as { tier?: string }).tier || 'free',
    });

    const freeCtx = createMockContext({ state: { tier: 'free' } });

    await middleware(freeCtx);
    await middleware(freeCtx);
    await middleware(freeCtx);

    expect(freeCtx.status).toBe(429);

    const premiumCtx = createMockContext({ state: { tier: 'premium' } });
    const premiumHelpers = getTestHelpers(premiumCtx);

    await middleware(premiumCtx);
    await middleware(premiumCtx);
    await middleware(premiumCtx);

    expect(premiumHelpers.wasNextCalled()).toBe(true);

    await middleware.shutdown();
  });

  it('should use default tier for unknown tiers', async () => {
    const middleware = tieredRateLimit({
      tiers: {
        anonymous: { max: 1, window: '1m' },
        user: { max: 10, window: '1m' },
      },
      tierResolver: () => 'unknown',
      defaultTier: 'anonymous',
    });

    const ctx = createMockContext();

    await middleware(ctx);
    await middleware(ctx);

    expect(ctx.status).toBe(429);

    await middleware.shutdown();
  });

  it('should throw if no tiers defined', () => {
    expect(() =>
      tieredRateLimit({
        tiers: {},
        tierResolver: () => 'any',
      })
    ).toThrow('At least one tier must be defined');
  });
});

describe('Edge Cases', () => {
  it('should handle concurrent requests', async () => {
    const middleware = rateLimit({ max: 100, window: '1m' });

    const contexts = Array.from({ length: 50 }, () => createMockContext());
    await Promise.all(contexts.map((ctx) => middleware(ctx)));

    const allPassed = contexts.every((ctx) => getTestHelpers(ctx).wasNextCalled());
    expect(allPassed).toBe(true);

    await middleware.shutdown();
  });

  it('should handle very short windows', async () => {
    const middleware = rateLimit({ max: 5, window: 50 });
    const ctx = createMockContext();

    for (let i = 0; i < 5; i++) {
      await middleware(ctx);
    }

    await new Promise((r) => setTimeout(r, 60));

    const ctx2 = createMockContext();
    const helpers = getTestHelpers(ctx2);
    await middleware(ctx2);

    expect(helpers.wasNextCalled()).toBe(true);

    await middleware.shutdown();
  });

  it('should not set Retry-After on allowed requests', async () => {
    const middleware = rateLimit({ max: 100, window: '1m' });
    const ctx = createMockContext();
    const helpers = getTestHelpers(ctx);

    await middleware(ctx);

    const headers = helpers.getResponseHeaders();
    expect(headers.has('Retry-After')).toBe(false);

    await middleware.shutdown();
  });

  it('should set Retry-After on blocked requests', async () => {
    const middleware = rateLimit({ max: 1, window: '1m' });
    const ctx = createMockContext();
    const helpers = getTestHelpers(ctx);

    await middleware(ctx);
    await middleware(ctx);

    const headers = helpers.getResponseHeaders();
    expect(headers.has('Retry-After')).toBe(true);

    await middleware.shutdown();
  });

  it('should handle getInfo for non-existent keys', async () => {
    const middleware = rateLimit({ max: 100, window: '1m' });

    const info = await middleware.getInfo('nonexistent');
    expect(info).not.toBeNull();
    expect(info?.remaining).toBe(100);

    await middleware.shutdown();
  });
});
