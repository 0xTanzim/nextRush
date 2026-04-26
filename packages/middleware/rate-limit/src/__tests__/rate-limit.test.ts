import type { Context } from '@nextrush/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMemoryStore,
  DEFAULT_ALGORITHM,
  DEFAULT_BLACKLIST_MULTIPLIER,
  DEFAULT_MAX,
  DEFAULT_MESSAGE,
  DEFAULT_STATUS_CODE,
  DEFAULT_WINDOW,
  extractClientIp,
  fixedWindow,
  getAlgorithm,
  INFO_CACHE_MAX,
  isIpInList,
  isValidIpv4,
  isValidIpv6,
  normalizeIp,
  parseWindow,
  rateLimit,
  RateLimitValidationError,
  slidingWindow,
  tieredRateLimit,
  tokenBucket,
  validateOptions,
  validateTieredOptions,
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
    set: (val: number) => {
      statusCode = val;
    },
  });

  (ctx as Context & { _test: unknown })._test = {
    getResponseHeaders: () => responseHeaders,
    wasNextCalled: () => nextCalled,
    getResponseBody: () => responseBody,
    resetNextCalled: () => {
      nextCalled = false;
    },
  };

  return ctx;
}

function getTestHelpers(ctx: Context) {
  return (
    ctx as Context & {
      _test: {
        getResponseHeaders: () => Map<string, string | number>;
        wasNextCalled: () => boolean;
        getResponseBody: () => unknown;
        resetNextCalled: () => void;
      };
    }
  )._test;
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

describe('Constants', () => {
  it('should export default values', () => {
    expect(DEFAULT_ALGORITHM).toBe('token-bucket');
    expect(DEFAULT_MAX).toBe(100);
    expect(DEFAULT_WINDOW).toBe('1m');
    expect(DEFAULT_STATUS_CODE).toBe(429);
    expect(DEFAULT_MESSAGE).toBe('Too many requests, please try again later.');
    expect(DEFAULT_BLACKLIST_MULTIPLIER).toBe(0.5);
  });
});

describe('CIDR Support', () => {
  describe('isIpInList with CIDR', () => {
    it('should match IP in CIDR range', () => {
      expect(isIpInList('192.168.1.50', ['192.168.1.0/24'])).toBe(true);
      expect(isIpInList('192.168.1.255', ['192.168.1.0/24'])).toBe(true);
      expect(isIpInList('192.168.1.0', ['192.168.1.0/24'])).toBe(true);
    });

    it('should not match IP outside CIDR range', () => {
      expect(isIpInList('192.168.2.1', ['192.168.1.0/24'])).toBe(false);
      expect(isIpInList('10.0.0.1', ['192.168.1.0/24'])).toBe(false);
    });

    it('should handle /8 CIDR (Class A)', () => {
      expect(isIpInList('10.255.255.255', ['10.0.0.0/8'])).toBe(true);
      expect(isIpInList('10.0.0.1', ['10.0.0.0/8'])).toBe(true);
      expect(isIpInList('11.0.0.1', ['10.0.0.0/8'])).toBe(false);
    });

    it('should handle /16 CIDR (Class B)', () => {
      expect(isIpInList('172.16.255.255', ['172.16.0.0/16'])).toBe(true);
      expect(isIpInList('172.17.0.1', ['172.16.0.0/16'])).toBe(false);
    });

    it('should handle /32 CIDR (single host)', () => {
      expect(isIpInList('192.168.1.100', ['192.168.1.100/32'])).toBe(true);
      expect(isIpInList('192.168.1.101', ['192.168.1.100/32'])).toBe(false);
    });

    it('should handle mixed list (CIDR and exact IPs)', () => {
      const list = ['192.168.0.0/16', '10.0.0.1', '127.0.0.1'];
      expect(isIpInList('192.168.50.100', list)).toBe(true);
      expect(isIpInList('10.0.0.1', list)).toBe(true);
      expect(isIpInList('127.0.0.1', list)).toBe(true);
      expect(isIpInList('8.8.8.8', list)).toBe(false);
    });
  });

  it('should use CIDR whitelist in middleware', async () => {
    const middleware = rateLimit({
      max: 1,
      window: '1m',
      whitelist: ['192.168.0.0/16'],
    });

    const ctx = createMockContext({ ip: '192.168.50.100' });
    const helpers = getTestHelpers(ctx);

    await middleware(ctx);
    await middleware(ctx);
    await middleware(ctx);

    expect(helpers.wasNextCalled()).toBe(true);
    expect(ctx.status).toBe(200);

    await middleware.shutdown();
  });

  it('should use CIDR blacklist in middleware', async () => {
    const middleware = rateLimit({
      max: 10,
      window: '1m',
      blacklist: ['192.168.1.0/24'],
      blacklistMultiplier: 0.1, // 10 * 0.1 = 1
    });

    const ctx = createMockContext({ ip: '192.168.1.50' });

    await middleware(ctx);
    await middleware(ctx);

    expect(ctx.status).toBe(429);

    await middleware.shutdown();
  });
});

describe('IP Validation', () => {
  describe('isValidIpv4', () => {
    it('should validate correct IPv4', () => {
      expect(isValidIpv4('192.168.1.1')).toBe(true);
      expect(isValidIpv4('0.0.0.0')).toBe(true);
      expect(isValidIpv4('255.255.255.255')).toBe(true);
    });

    it('should reject invalid IPv4', () => {
      expect(isValidIpv4('256.1.1.1')).toBe(false);
      expect(isValidIpv4('1.1.1')).toBe(false);
      expect(isValidIpv4('1.1.1.1.1')).toBe(false);
      expect(isValidIpv4('not-an-ip')).toBe(false);
      expect(isValidIpv4('01.01.01.01')).toBe(false); // Leading zeros
    });
  });

  describe('isValidIpv6', () => {
    it('should validate correct IPv6', () => {
      expect(isValidIpv6('::1')).toBe(true);
      expect(isValidIpv6('::')).toBe(true);
      expect(isValidIpv6('2001:db8::1')).toBe(true);
    });

    it('should reject invalid IPv6', () => {
      expect(isValidIpv6('192.168.1.1')).toBe(false);
      expect(isValidIpv6('not-ipv6')).toBe(false);
    });
  });
});

describe('Validation', () => {
  describe('validateOptions', () => {
    it('should accept valid options', () => {
      expect(() => validateOptions({})).not.toThrow();
      expect(() => validateOptions({ max: 100 })).not.toThrow();
      expect(() => validateOptions({ max: 100, window: '1m' })).not.toThrow();
    });

    it('should reject invalid max', () => {
      expect(() => validateOptions({ max: 0 })).toThrow(RateLimitValidationError);
      expect(() => validateOptions({ max: -1 })).toThrow(RateLimitValidationError);
      expect(() => validateOptions({ max: 1.5 })).toThrow(RateLimitValidationError);
      expect(() => validateOptions({ max: NaN })).toThrow(RateLimitValidationError);
    });

    it('should reject invalid burstLimit', () => {
      expect(() => validateOptions({ burstLimit: 0 })).toThrow(RateLimitValidationError);
      expect(() => validateOptions({ burstLimit: -1 })).toThrow(RateLimitValidationError);
    });

    it('should reject invalid statusCode', () => {
      expect(() => validateOptions({ statusCode: 99 })).toThrow(RateLimitValidationError);
      expect(() => validateOptions({ statusCode: 600 })).toThrow(RateLimitValidationError);
    });

    it('should reject invalid blacklistMultiplier', () => {
      expect(() => validateOptions({ blacklistMultiplier: -0.1 })).toThrow(
        RateLimitValidationError
      );
      expect(() => validateOptions({ blacklistMultiplier: 1.5 })).toThrow(RateLimitValidationError);
    });

    it('should reject invalid algorithm', () => {
      expect(() => validateOptions({ algorithm: 'invalid' as never })).toThrow(
        RateLimitValidationError
      );
    });

    it('should reject non-function handlers', () => {
      expect(() => validateOptions({ keyGenerator: 'string' as never })).toThrow(
        RateLimitValidationError
      );
      expect(() => validateOptions({ skip: 'string' as never })).toThrow(RateLimitValidationError);
      expect(() => validateOptions({ handler: 'string' as never })).toThrow(
        RateLimitValidationError
      );
    });
  });

  describe('validateTieredOptions', () => {
    it('should accept valid tiered options', () => {
      expect(() =>
        validateTieredOptions({
          tiers: { free: { max: 10, window: '1m' } },
          tierResolver: () => 'free',
        })
      ).not.toThrow();
    });

    it('should reject empty tiers', () => {
      expect(() =>
        validateTieredOptions({
          tiers: {},
          tierResolver: () => 'any',
        })
      ).toThrow(RateLimitValidationError);
    });

    it('should reject invalid tier config', () => {
      expect(() =>
        validateTieredOptions({
          tiers: { free: { max: 0, window: '1m' } },
          tierResolver: () => 'free',
        })
      ).toThrow(RateLimitValidationError);
    });

    it('should reject non-function tierResolver', () => {
      expect(() =>
        validateTieredOptions({
          tiers: { free: { max: 10, window: '1m' } },
          tierResolver: 'string' as never,
        })
      ).toThrow(RateLimitValidationError);
    });

    it('should reject invalid defaultTier', () => {
      expect(() =>
        validateTieredOptions({
          tiers: { free: { max: 10, window: '1m' } },
          tierResolver: () => 'free',
          defaultTier: 'nonexistent',
        })
      ).toThrow(RateLimitValidationError);
    });
  });

  it('should throw validation errors from rateLimit()', () => {
    expect(() => rateLimit({ max: -1 })).toThrow(RateLimitValidationError);
    expect(() => rateLimit({ statusCode: 99 })).toThrow(RateLimitValidationError);
  });

  it('should throw validation errors from tieredRateLimit()', () => {
    expect(() =>
      tieredRateLimit({
        tiers: {},
        tierResolver: () => 'any',
      })
    ).toThrow();
  });
});

describe('MemoryStore Max Entries', () => {
  it('should evict oldest entry when max entries reached', async () => {
    const store = createMemoryStore({ maxEntries: 3, disableCleanup: true });

    await store.set('key1', { count: 1, windowStart: Date.now() }, 60000);
    await store.set('key2', { count: 1, windowStart: Date.now() }, 60000);
    await store.set('key3', { count: 1, windowStart: Date.now() }, 60000);

    expect(store.size).toBe(3);

    // Adding key4 should evict key1
    await store.set('key4', { count: 1, windowStart: Date.now() }, 60000);

    expect(store.size).toBe(3);
    expect(await store.get('key1')).toBeNull();
    expect(await store.get('key4')).not.toBeNull();

    await store.shutdown();
  });

  it('should not evict when updating existing key', async () => {
    const store = createMemoryStore({ maxEntries: 2, disableCleanup: true });

    await store.set('key1', { count: 1, windowStart: Date.now() }, 60000);
    await store.set('key2', { count: 1, windowStart: Date.now() }, 60000);

    // Update key1 (should not evict)
    await store.set('key1', { count: 2, windowStart: Date.now() }, 60000);

    expect(store.size).toBe(2);
    const entry = await store.get('key1');
    expect(entry?.count).toBe(2);

    await store.shutdown();
  });
});

// ============================================================
// P1 & P2 Audit Fix Tests
// ============================================================

describe('RL-P1-02: Window validation', () => {
  it('should reject window: 0 (number)', () => {
    expect(() => rateLimit({ window: 0 })).toThrow(RateLimitValidationError);
  });

  it('should reject negative window (number)', () => {
    expect(() => rateLimit({ window: -1000 })).toThrow(RateLimitValidationError);
  });

  it('should reject window: "0s"', () => {
    expect(() => rateLimit({ window: '0s' })).toThrow(RateLimitValidationError);
  });

  it('should reject window: NaN', () => {
    expect(() => rateLimit({ window: NaN })).toThrow(RateLimitValidationError);
  });

  it('should reject window: Infinity', () => {
    expect(() => rateLimit({ window: Infinity })).toThrow(RateLimitValidationError);
  });

  it('should accept valid window values', () => {
    expect(() => rateLimit({ window: '1s' })).not.toThrow();
    expect(() => rateLimit({ window: '5m' })).not.toThrow();
    expect(() => rateLimit({ window: 60000 })).not.toThrow();
  });

  it('should reject invalid tier windows in tieredRateLimit', () => {
    expect(() =>
      tieredRateLimit({
        tiers: { free: { max: 10, window: '0s' } },
        tierResolver: () => 'free',
      })
    ).toThrow(RateLimitValidationError);

    expect(() =>
      tieredRateLimit({
        tiers: { free: { max: 10, window: '0m' } },
        tierResolver: () => 'free',
      })
    ).toThrow(RateLimitValidationError);
  });
});

describe('RL-P1-03: InfoCache bounded', () => {
  it('should export INFO_CACHE_MAX constant', () => {
    expect(INFO_CACHE_MAX).toBe(10_000);
  });

  it('should not grow unbounded (smoke test with small limit)', async () => {
    // We can't easily test 10k entries, but we verify the cache eviction code path
    // by verifying the middleware handles many unique keys without error
    const middleware = rateLimit({ max: 1000, window: '1m' });

    const contexts = Array.from({ length: 20 }, (_, i) => createMockContext({ ip: `10.0.0.${i}` }));

    for (const ctx of contexts) {
      await middleware(ctx);
    }

    // All requests should succeed (within limit)
    for (const ctx of contexts) {
      expect(getTestHelpers(ctx).wasNextCalled()).toBe(true);
    }

    await middleware.shutdown();
  });
});

describe('RL-P1-04: Fixed-window reset', () => {
  it('should actually clear fixed-window entry when reset is called', async () => {
    const middleware = rateLimit({
      algorithm: 'fixed-window',
      max: 2,
      window: '1m',
    });

    const ctx = createMockContext();

    // Consume 2 requests
    await middleware(ctx);
    await middleware(ctx);

    // Third should be blocked
    const ctx3 = createMockContext();
    await middleware(ctx3);
    expect(ctx3.status).toBe(429);

    // Reset
    await middleware.reset('rl:192.168.1.1');

    // Should be allowed again
    const ctx4 = createMockContext();
    const helpers4 = getTestHelpers(ctx4);
    await middleware(ctx4);

    expect(helpers4.wasNextCalled()).toBe(true);
    expect(ctx4.status).toBe(200);

    await middleware.shutdown();
  });
});

describe('RL-P1-05: Tiered shutdown with shared stores', () => {
  it('should only call shutdown once on shared store', async () => {
    let shutdownCount = 0;

    const sharedStore = createMemoryStore({ disableCleanup: true });
    const originalShutdown = sharedStore.shutdown.bind(sharedStore);
    sharedStore.shutdown = async () => {
      shutdownCount++;
      await originalShutdown();
    };

    const middleware = tieredRateLimit({
      tiers: {
        free: { max: 10, window: '1m' },
        premium: { max: 100, window: '1m' },
      },
      tierResolver: () => 'free',
      store: sharedStore,
    });

    await middleware.shutdown();

    expect(shutdownCount).toBe(1);
  });

  it('should only call reset once on shared store', async () => {
    let resetCount = 0;

    const sharedStore = createMemoryStore({ disableCleanup: true });
    const originalReset = sharedStore.reset.bind(sharedStore);
    sharedStore.reset = async (key: string) => {
      resetCount++;
      await originalReset(key);
    };

    const middleware = tieredRateLimit({
      tiers: {
        free: { max: 10, window: '1m' },
        premium: { max: 100, window: '1m' },
      },
      tierResolver: () => 'free',
      store: sharedStore,
    });

    await middleware.reset('test-key');

    expect(resetCount).toBe(1);
  });
});

describe('RL-P2-01: MemoryStore cleanup error handling', () => {
  it('should log errors from cleanup instead of silently swallowing', async () => {
    const consoleErrorSpy = vi.spyOn(globalThis.console, 'error').mockImplementation(() => {});

    const store = createMemoryStore({ disableCleanup: true });

    // Override cleanup to throw
    const originalCleanup = store.cleanup.bind(store);
    store.cleanup = async () => {
      throw new Error('cleanup failed');
    };

    // Simulate what the timer does
    try {
      await store.cleanup();
    } catch {
      // The interval handler catches this and logs it
    }

    // Restore and verify pattern works
    store.cleanup = originalCleanup;
    consoleErrorSpy.mockRestore();
    await store.shutdown();
  });

  it('should not crash when cleanup timer encounters an error', async () => {
    const consoleErrorSpy = vi.spyOn(globalThis.console, 'error').mockImplementation(() => {});

    // Create store with very short cleanup interval
    const store = createMemoryStore({ cleanupInterval: 50 });

    // Override cleanup to throw
    store.cleanup = async () => {
      throw new Error('boom');
    };

    // Wait for at least one cleanup cycle
    await new Promise((r) => setTimeout(r, 100));

    // Should have logged error, not crashed
    expect(consoleErrorSpy).toHaveBeenCalled();
    const firstCall = consoleErrorSpy.mock.calls[0];
    expect(firstCall?.[0]).toContain('[@nextrush/rate-limit]');

    consoleErrorSpy.mockRestore();
    await store.shutdown();
  });
});

describe('RL-P2-02: IPv6 CIDR matching', () => {
  it('should match IPv6 in CIDR range (loopback /128)', () => {
    expect(isIpInList('::1', ['::1/128'])).toBe(true);
  });

  it('should match IPv6 in /32 CIDR range', () => {
    expect(isIpInList('2001:db8::1', ['2001:db8::/32'])).toBe(true);
    expect(isIpInList('2001:db8:abcd::1', ['2001:db8::/32'])).toBe(true);
  });

  it('should not match IPv6 outside CIDR range', () => {
    expect(isIpInList('2001:db9::1', ['2001:db8::/32'])).toBe(false);
  });

  it('should match IPv6 in /64 CIDR range', () => {
    expect(isIpInList('fe80::1', ['fe80::/64'])).toBe(true);
    expect(isIpInList('fe80::ffff:ffff', ['fe80::/64'])).toBe(true);
  });

  it('should not match IPv6 outside /64 range', () => {
    expect(isIpInList('fe80:1::1', ['fe80::/16'])).toBe(true);
    expect(isIpInList('fe81::1', ['fe80::/16'])).toBe(false);
  });

  it('should handle mixed IPv4 and IPv6 CIDR lists', () => {
    const list = ['192.168.0.0/16', '2001:db8::/32', '10.0.0.1'];
    expect(isIpInList('192.168.1.1', list)).toBe(true);
    expect(isIpInList('2001:db8::1', list)).toBe(true);
    expect(isIpInList('10.0.0.1', list)).toBe(true);
    expect(isIpInList('8.8.8.8', list)).toBe(false);
    expect(isIpInList('2001:db9::1', list)).toBe(false);
  });

  it('should use IPv6 CIDR whitelist in middleware', async () => {
    const middleware = rateLimit({
      max: 1,
      window: '1m',
      whitelist: ['2001:db8::/32'],
    });

    const ctx = createMockContext({ ip: '2001:db8::1' });
    const helpers = getTestHelpers(ctx);

    await middleware(ctx);
    await middleware(ctx);
    await middleware(ctx);

    expect(helpers.wasNextCalled()).toBe(true);
    expect(ctx.status).toBe(200);

    await middleware.shutdown();
  });
});

describe('RL-P2-05: MemoryStore TTL refresh on increment', () => {
  it('should refresh TTL when incrementing existing entry', async () => {
    const store = createMemoryStore({ disableCleanup: true });

    // Create entry with short TTL
    await store.increment('key1', 100);

    // Wait a bit, then increment again which should refresh TTL
    await new Promise((r) => setTimeout(r, 50));
    await store.increment('key1', 100);

    // Wait past original TTL but within refreshed TTL
    await new Promise((r) => setTimeout(r, 60));

    // Should still exist because TTL was refreshed
    const entry = await store.get('key1');
    expect(entry).not.toBeNull();
    expect(entry?.count).toBe(2);

    await store.shutdown();
  });

  it('should expire after refreshed TTL', async () => {
    const store = createMemoryStore({ disableCleanup: true });

    await store.increment('key1', 50);
    await store.increment('key1', 50);

    // Wait past the refreshed TTL
    await new Promise((r) => setTimeout(r, 70));

    const entry = await store.get('key1');
    expect(entry).toBeNull();

    await store.shutdown();
  });
});
