import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Context } from '@nextrush/types';

import { correlationId, requestId, traceId } from '../index';

function createMockContext(
  overrides: Partial<{
    headers: Record<string, string>;
  }> = {}
): Context {
  const headers = new Map<string, string>();
  const responseHeaders = new Map<string, string>();
  const state: Record<string, unknown> = {};

  if (overrides.headers) {
    for (const [key, value] of Object.entries(overrides.headers)) {
      headers.set(key.toLowerCase(), value);
    }
  }

  let nextCalled = false;

  return {
    state,
    get: (name: string) => headers.get(name.toLowerCase()),
    set: (name: string, value: string) => {
      responseHeaders.set(name.toLowerCase(), value);
    },
    next: async () => {
      nextCalled = true;
    },
    _responseHeaders: responseHeaders,
    _nextCalled: () => nextCalled,
  } as unknown as Context & {
    _responseHeaders: Map<string, string>;
    _nextCalled: () => boolean;
  };
}

describe('@nextrush/request-id', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('requestId()', () => {
    it('should generate a request ID and store in state', async () => {
      const middleware = requestId();
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.state.requestId).toBeDefined();
      expect(typeof ctx.state.requestId).toBe('string');
      expect(ctx.state.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should set X-Request-Id response header by default', async () => {
      const middleware = requestId();
      const ctx = createMockContext();

      await middleware(ctx);

      const responseHeaders = (ctx as unknown as { _responseHeaders: Map<string, string> })
        ._responseHeaders;
      expect(responseHeaders.get('x-request-id')).toBe(ctx.state.requestId);
    });

    it('should call next()', async () => {
      const middleware = requestId();
      const ctx = createMockContext();

      await middleware(ctx);

      expect((ctx as unknown as { _nextCalled: () => boolean })._nextCalled()).toBe(true);
    });

    it('should trust incoming request ID by default', async () => {
      const incomingId = 'existing-request-id-123';
      const middleware = requestId();
      const ctx = createMockContext({
        headers: { 'X-Request-Id': incomingId },
      });

      await middleware(ctx);

      expect(ctx.state.requestId).toBe(incomingId);
    });

    it('should not trust incoming request ID when trustIncoming is false', async () => {
      const incomingId = 'existing-request-id-123';
      const middleware = requestId({ trustIncoming: false });
      const ctx = createMockContext({
        headers: { 'X-Request-Id': incomingId },
      });

      await middleware(ctx);

      expect(ctx.state.requestId).not.toBe(incomingId);
      expect(ctx.state.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should use custom header name', async () => {
      const middleware = requestId({ header: 'X-Custom-Id' });
      const ctx = createMockContext({
        headers: { 'X-Custom-Id': 'custom-id-value' },
      });

      await middleware(ctx);

      expect(ctx.state.requestId).toBe('custom-id-value');
      const responseHeaders = (ctx as unknown as { _responseHeaders: Map<string, string> })
        ._responseHeaders;
      expect(responseHeaders.get('x-custom-id')).toBe('custom-id-value');
    });

    it('should use custom state key', async () => {
      const middleware = requestId({ stateKey: 'myRequestId' });
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.state.myRequestId).toBeDefined();
      expect(ctx.state.requestId).toBeUndefined();
    });

    it('should use custom generator', async () => {
      const customId = 'custom-generated-id';
      const generator = vi.fn(() => customId);
      const middleware = requestId({ generator });
      const ctx = createMockContext();

      await middleware(ctx);

      expect(generator).toHaveBeenCalled();
      expect(ctx.state.requestId).toBe(customId);
    });

    it('should not expose header when exposeHeader is false', async () => {
      const middleware = requestId({ exposeHeader: false });
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.state.requestId).toBeDefined();
      const responseHeaders = (ctx as unknown as { _responseHeaders: Map<string, string> })
        ._responseHeaders;
      expect(responseHeaders.size).toBe(0);
    });

    it('should generate unique IDs for each request', async () => {
      const middleware = requestId();
      const ctx1 = createMockContext();
      const ctx2 = createMockContext();
      const ctx3 = createMockContext();

      await middleware(ctx1);
      await middleware(ctx2);
      await middleware(ctx3);

      const ids = new Set([ctx1.state.requestId, ctx2.state.requestId, ctx3.state.requestId]);

      expect(ids.size).toBe(3);
    });
  });

  describe('correlationId()', () => {
    it('should use X-Correlation-Id header', async () => {
      const middleware = correlationId();
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.state.correlationId).toBeDefined();
      const responseHeaders = (ctx as unknown as { _responseHeaders: Map<string, string> })
        ._responseHeaders;
      expect(responseHeaders.get('x-correlation-id')).toBe(ctx.state.correlationId);
    });

    it('should trust incoming correlation ID', async () => {
      const incomingId = 'correlation-123';
      const middleware = correlationId();
      const ctx = createMockContext({
        headers: { 'X-Correlation-Id': incomingId },
      });

      await middleware(ctx);

      expect(ctx.state.correlationId).toBe(incomingId);
    });

    it('should accept custom generator', async () => {
      const customId = 'corr-custom-123';
      const middleware = correlationId({ generator: () => customId });
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.state.correlationId).toBe(customId);
    });
  });

  describe('traceId()', () => {
    it('should use X-Trace-Id header', async () => {
      const middleware = traceId();
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.state.traceId).toBeDefined();
      const responseHeaders = (ctx as unknown as { _responseHeaders: Map<string, string> })
        ._responseHeaders;
      expect(responseHeaders.get('x-trace-id')).toBe(ctx.state.traceId);
    });

    it('should trust incoming trace ID', async () => {
      const incomingId = 'trace-456';
      const middleware = traceId();
      const ctx = createMockContext({
        headers: { 'X-Trace-Id': incomingId },
      });

      await middleware(ctx);

      expect(ctx.state.traceId).toBe(incomingId);
    });
  });

  describe('edge cases', () => {
    it('should handle empty incoming header', async () => {
      const middleware = requestId();
      const ctx = createMockContext({
        headers: { 'X-Request-Id': '' },
      });

      await middleware(ctx);

      // Empty string is falsy, so should generate new ID
      expect(ctx.state.requestId).toBeDefined();
      expect(ctx.state.requestId).not.toBe('');
    });

    it('should work with all options combined', async () => {
      const customId = 'all-options-id';
      const middleware = requestId({
        header: 'X-My-Request',
        generator: () => customId,
        trustIncoming: false,
        stateKey: 'myId',
        exposeHeader: true,
      });
      const ctx = createMockContext({
        headers: { 'X-My-Request': 'incoming-ignored' },
      });

      await middleware(ctx);

      expect(ctx.state.myId).toBe(customId);
      const responseHeaders = (ctx as unknown as { _responseHeaders: Map<string, string> })
        ._responseHeaders;
      expect(responseHeaders.get('x-my-request')).toBe(customId);
    });
  });
});
