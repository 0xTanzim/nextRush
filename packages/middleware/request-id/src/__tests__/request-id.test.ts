import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CORRELATION_HEADER,
  CORRELATION_STATE_KEY,
  DEFAULT_HEADER,
  DEFAULT_MAX_LENGTH,
  DEFAULT_STATE_KEY,
  TRACE_HEADER,
  TRACE_STATE_KEY,
  correlationId,
  createValidator,
  defaultGenerator,
  defaultValidator,
  isSafeId,
  isValidLength,
  isValidUuid,
  permissiveValidator,
  requestId,
  traceId,
  validateId,
} from '../index';
import type { RequestIdContext } from '../types';

function createMockContext(
  overrides: Partial<{
    headers: Record<string, string>;
  }> = {}
): RequestIdContext & {
  _responseHeaders: Map<string, string>;
  _nextCalled: () => boolean;
} {
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
  };
}

describe('@nextrush/request-id', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Constants Tests
  // ============================================================================

  describe('constants', () => {
    it('should export DEFAULT_HEADER', () => {
      expect(DEFAULT_HEADER).toBe('X-Request-Id');
    });

    it('should export CORRELATION_HEADER', () => {
      expect(CORRELATION_HEADER).toBe('X-Correlation-Id');
    });

    it('should export TRACE_HEADER', () => {
      expect(TRACE_HEADER).toBe('X-Trace-Id');
    });

    it('should export DEFAULT_STATE_KEY', () => {
      expect(DEFAULT_STATE_KEY).toBe('requestId');
    });

    it('should export CORRELATION_STATE_KEY', () => {
      expect(CORRELATION_STATE_KEY).toBe('correlationId');
    });

    it('should export TRACE_STATE_KEY', () => {
      expect(TRACE_STATE_KEY).toBe('traceId');
    });

    it('should export DEFAULT_MAX_LENGTH', () => {
      expect(DEFAULT_MAX_LENGTH).toBe(128);
    });

    it('should export defaultGenerator that creates UUIDs', () => {
      const id = defaultGenerator();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
  });

  // ============================================================================
  // Validation Tests
  // ============================================================================

  describe('validation', () => {
    describe('isValidUuid()', () => {
      it('should accept valid UUID v4', () => {
        expect(isValidUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
        expect(isValidUuid('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe(true);
      });

      it('should reject invalid UUIDs', () => {
        expect(isValidUuid('not-a-uuid')).toBe(false);
        expect(isValidUuid('550e8400-e29b-51d4-a716-446655440000')).toBe(false); // v5 not v4
        expect(isValidUuid('550e8400-e29b-41d4-c716-446655440000')).toBe(false); // Invalid variant
        expect(isValidUuid('')).toBe(false);
      });
    });

    describe('isSafeId()', () => {
      it('should accept safe IDs', () => {
        expect(isSafeId('abc123')).toBe(true);
        expect(isSafeId('my-id-123')).toBe(true);
        expect(isSafeId('my_id_456')).toBe(true);
        expect(isSafeId('ABC-XYZ')).toBe(true);
      });

      it('should reject unsafe IDs', () => {
        expect(isSafeId('id with space')).toBe(false);
        expect(isSafeId('id\r\ninjected')).toBe(false);
        expect(isSafeId('id\x00null')).toBe(false);
        expect(isSafeId('id:colon')).toBe(false);
        expect(isSafeId('')).toBe(false);
      });
    });

    describe('isValidLength()', () => {
      it('should accept valid lengths', () => {
        expect(isValidLength('a')).toBe(true);
        expect(isValidLength('a'.repeat(128))).toBe(true);
      });

      it('should reject invalid lengths', () => {
        expect(isValidLength('')).toBe(false);
        expect(isValidLength('a'.repeat(129))).toBe(false);
      });

      it('should respect custom max length', () => {
        expect(isValidLength('a'.repeat(10), 10)).toBe(true);
        expect(isValidLength('a'.repeat(11), 10)).toBe(false);
      });
    });

    describe('validateId()', () => {
      it('should validate both length and safety', () => {
        expect(validateId('safe-id-123')).toBe(true);
        expect(validateId('')).toBe(false);
        expect(validateId('a'.repeat(129))).toBe(false);
        expect(validateId('unsafe\r\nid')).toBe(false);
      });
    });

    describe('createValidator()', () => {
      it('should create validator with custom max length', () => {
        const validator = createValidator(10);
        expect(validator('a'.repeat(10))).toBe(true);
        expect(validator('a'.repeat(11))).toBe(false);
      });
    });

    describe('defaultValidator', () => {
      it('should validate UUID format', () => {
        expect(defaultValidator('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
        expect(defaultValidator('not-uuid')).toBe(false);
      });
    });

    describe('permissiveValidator', () => {
      it('should accept any safe ID (character check only)', () => {
        expect(permissiveValidator('my-custom-id-123')).toBe(true);
        expect(permissiveValidator('a'.repeat(128))).toBe(true);
        // Length is no longer checked by permissiveValidator (handled by middleware)
        expect(permissiveValidator('a'.repeat(129))).toBe(true);
      });
    });
  });

  // ============================================================================
  // requestId() Middleware Tests
  // ============================================================================

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

      expect(ctx._responseHeaders.get('x-request-id')).toBe(ctx.state.requestId);
    });

    it('should call next()', async () => {
      const middleware = requestId();
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx._nextCalled()).toBe(true);
    });

    it('should trust valid incoming UUID when trustIncoming is true', async () => {
      const incomingId = '550e8400-e29b-41d4-a716-446655440000';
      const middleware = requestId({ trustIncoming: true });
      const ctx = createMockContext({
        headers: { 'X-Request-Id': incomingId },
      });

      await middleware(ctx);

      expect(ctx.state.requestId).toBe(incomingId);
    });

    it('should not trust incoming IDs by default (secure-by-default)', async () => {
      const incomingId = '550e8400-e29b-41d4-a716-446655440000';
      const middleware = requestId();
      const ctx = createMockContext({
        headers: { 'X-Request-Id': incomingId },
      });

      await middleware(ctx);

      expect(ctx.state.requestId).not.toBe(incomingId);
    });

    it('should reject invalid incoming ID and generate new one', async () => {
      const incomingId = 'invalid-not-uuid';
      const middleware = requestId();
      const ctx = createMockContext({
        headers: { 'X-Request-Id': incomingId },
      });

      await middleware(ctx);

      expect(ctx.state.requestId).not.toBe(incomingId);
      expect(ctx.state.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should not trust incoming request ID when trustIncoming is false', async () => {
      const incomingId = '550e8400-e29b-41d4-a716-446655440000';
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

    it('should use custom header name with valid ID', async () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      const middleware = requestId({ header: 'X-Custom-Id', trustIncoming: true });
      const ctx = createMockContext({
        headers: { 'X-Custom-Id': validUuid },
      });

      await middleware(ctx);

      expect(ctx.state.requestId).toBe(validUuid);
      expect(ctx._responseHeaders.get('x-custom-id')).toBe(validUuid);
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

    it('should use custom validator for permissive IDs', async () => {
      const customId = 'my-custom-non-uuid-id';
      const middleware = requestId({ validator: permissiveValidator, trustIncoming: true });
      const ctx = createMockContext({
        headers: { 'X-Request-Id': customId },
      });

      await middleware(ctx);

      expect(ctx.state.requestId).toBe(customId);
    });

    it('should not expose header when exposeHeader is false', async () => {
      const middleware = requestId({ exposeHeader: false });
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.state.requestId).toBeDefined();
      expect(ctx._responseHeaders.size).toBe(0);
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

    it('should respect custom maxLength', async () => {
      const longId = 'a'.repeat(200) + '-' + '550e8400-e29b-41d4-a716-446655440000';
      const middleware = requestId({ maxLength: 50 });
      const ctx = createMockContext({
        headers: { 'X-Request-Id': longId },
      });

      await middleware(ctx);

      // Long ID should be rejected
      expect(ctx.state.requestId).not.toBe(longId);
    });
  });

  // ============================================================================
  // correlationId() Middleware Tests
  // ============================================================================

  describe('correlationId()', () => {
    it('should use X-Correlation-Id header', async () => {
      const middleware = correlationId();
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.state.correlationId).toBeDefined();
      expect(ctx._responseHeaders.get('x-correlation-id')).toBe(ctx.state.correlationId);
    });

    it('should trust valid incoming correlation ID', async () => {
      const incomingId = '550e8400-e29b-41d4-a716-446655440000';
      const middleware = correlationId({ trustIncoming: true });
      const ctx = createMockContext({
        headers: { 'X-Correlation-Id': incomingId },
      });

      await middleware(ctx);

      expect(ctx.state.correlationId).toBe(incomingId);
    });

    it('should accept permissive IDs with custom validator', async () => {
      const customId = 'correlation-123';
      const middleware = correlationId({ validator: permissiveValidator, trustIncoming: true });
      const ctx = createMockContext({
        headers: { 'X-Correlation-Id': customId },
      });

      await middleware(ctx);

      expect(ctx.state.correlationId).toBe(customId);
    });

    it('should accept custom generator', async () => {
      const customId = 'corr-custom-123';
      const middleware = correlationId({ generator: () => customId });
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.state.correlationId).toBe(customId);
    });
  });

  // ============================================================================
  // traceId() Middleware Tests
  // ============================================================================

  describe('traceId()', () => {
    it('should use X-Trace-Id header', async () => {
      const middleware = traceId();
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.state.traceId).toBeDefined();
      expect(ctx._responseHeaders.get('x-trace-id')).toBe(ctx.state.traceId);
    });

    it('should trust valid incoming trace ID', async () => {
      const incomingId = '550e8400-e29b-41d4-a716-446655440000';
      const middleware = traceId({ trustIncoming: true });
      const ctx = createMockContext({
        headers: { 'X-Trace-Id': incomingId },
      });

      await middleware(ctx);

      expect(ctx.state.traceId).toBe(incomingId);
    });

    it('should accept permissive IDs with custom validator', async () => {
      const customId = 'trace-456';
      const middleware = traceId({ validator: permissiveValidator, trustIncoming: true });
      const ctx = createMockContext({
        headers: { 'X-Trace-Id': customId },
      });

      await middleware(ctx);

      expect(ctx.state.traceId).toBe(customId);
    });
  });

  // ============================================================================
  // Security Tests
  // ============================================================================

  describe('security', () => {
    it('should reject CRLF injection attempts', async () => {
      const maliciousId = 'valid-part\r\nX-Injected: evil';
      const middleware = requestId({ validator: permissiveValidator });
      const ctx = createMockContext({
        headers: { 'X-Request-Id': maliciousId },
      });

      await middleware(ctx);

      // Should reject and generate new ID
      expect(ctx.state.requestId).not.toBe(maliciousId);
      expect(ctx.state.requestId).not.toContain('\r\n');
    });

    it('should reject null byte injection', async () => {
      const maliciousId = 'valid-part\x00evil';
      const middleware = requestId({ validator: permissiveValidator });
      const ctx = createMockContext({
        headers: { 'X-Request-Id': maliciousId },
      });

      await middleware(ctx);

      expect(ctx.state.requestId).not.toBe(maliciousId);
    });

    it('should reject IDs exceeding max length', async () => {
      const longId = 'a'.repeat(200);
      const middleware = requestId({ validator: permissiveValidator });
      const ctx = createMockContext({
        headers: { 'X-Request-Id': longId },
      });

      await middleware(ctx);

      expect(ctx.state.requestId).not.toBe(longId);
    });

    it('should reject IDs with special characters', async () => {
      const specialId = 'id:with:colons';
      const middleware = requestId({ validator: permissiveValidator });
      const ctx = createMockContext({
        headers: { 'X-Request-Id': specialId },
      });

      await middleware(ctx);

      expect(ctx.state.requestId).not.toBe(specialId);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle empty incoming header', async () => {
      const middleware = requestId();
      const ctx = createMockContext({
        headers: { 'X-Request-Id': '' },
      });

      await middleware(ctx);

      expect(ctx.state.requestId).toBeDefined();
      expect(ctx.state.requestId).not.toBe('');
    });

    it('should handle undefined incoming header', async () => {
      const middleware = requestId();
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.state.requestId).toBeDefined();
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
        headers: { 'X-My-Request': '550e8400-e29b-41d4-a716-446655440000' },
      });

      await middleware(ctx);

      expect(ctx.state.myId).toBe(customId);
      expect(ctx._responseHeaders.get('x-my-request')).toBe(customId);
    });
  });

  // ============================================================================
  // Multi-Runtime Compatibility Tests
  // ============================================================================

  describe('multi-runtime compatibility', () => {
    it('should use crypto.randomUUID() for ID generation', () => {
      const id = defaultGenerator();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should not use any Node.js-specific APIs', () => {
      // crypto.randomUUID() is available in all modern runtimes
      expect(typeof crypto.randomUUID).toBe('function');
    });
  });

  // ============================================================================
  // Production Hardening Tests
  // ============================================================================

  describe('production hardening', () => {
    describe('header name validation', () => {
      it('should reject header names with CRLF characters', () => {
        expect(() => requestId({ header: 'X-Bad\r\nHeader' })).toThrow(
          '[@nextrush/request-id] Invalid header name'
        );
      });

      it('should reject header names with null bytes', () => {
        expect(() => requestId({ header: 'X-Bad\x00Header' })).toThrow(
          '[@nextrush/request-id] Invalid header name'
        );
      });

      it('should reject header names with spaces', () => {
        expect(() => requestId({ header: 'X Bad Header' })).toThrow(
          '[@nextrush/request-id] Invalid header name'
        );
      });

      it('should accept valid HTTP token header names', () => {
        expect(() => requestId({ header: 'X-Custom-Request-Id' })).not.toThrow();
        expect(() => requestId({ header: 'X_Custom_ID' })).not.toThrow();
      });
    });

    describe('stateKey prototype pollution guard', () => {
      it('should reject __proto__ as stateKey', () => {
        expect(() => requestId({ stateKey: '__proto__' })).toThrow(
          '[@nextrush/request-id] Unsafe stateKey'
        );
      });

      it('should reject prototype as stateKey', () => {
        expect(() => requestId({ stateKey: 'prototype' })).toThrow(
          '[@nextrush/request-id] Unsafe stateKey'
        );
      });

      it('should reject constructor as stateKey', () => {
        expect(() => requestId({ stateKey: 'constructor' })).toThrow(
          '[@nextrush/request-id] Unsafe stateKey'
        );
      });

      it('should accept safe stateKey values', () => {
        expect(() => requestId({ stateKey: 'myRequestId' })).not.toThrow();
        expect(() => requestId({ stateKey: 'traceId' })).not.toThrow();
      });
    });

    describe('generated ID fallback', () => {
      it('should fallback to default generator when custom generator returns invalid ID', async () => {
        const middleware = requestId({ generator: () => '' });
        const ctx = createMockContext();

        await middleware(ctx);

        // Should still have a valid UUID from fallback
        expect(ctx.state.requestId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );
      });

      it('should fallback when custom generator returns oversized ID', async () => {
        const middleware = requestId({ generator: () => 'a'.repeat(200) });
        const ctx = createMockContext();

        await middleware(ctx);

        // Should still have a valid UUID from fallback
        expect(ctx.state.requestId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );
      });
    });

    describe('trustIncoming: false (default)', () => {
      it('should always generate new ID even with valid incoming UUID', async () => {
        const incomingId = '550e8400-e29b-41d4-a716-446655440000';
        const middleware = requestId();
        const ctx = createMockContext({
          headers: { 'X-Request-Id': incomingId },
        });

        await middleware(ctx);

        expect(ctx.state.requestId).not.toBe(incomingId);
        expect(ctx.state.requestId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );
      });

      it('should ignore incoming ID for correlationId when trustIncoming is default', async () => {
        const incomingId = '550e8400-e29b-41d4-a716-446655440000';
        const middleware = correlationId();
        const ctx = createMockContext({
          headers: { 'X-Correlation-Id': incomingId },
        });

        await middleware(ctx);

        expect(ctx.state.correlationId).not.toBe(incomingId);
      });

      it('should ignore incoming ID for traceId when trustIncoming is default', async () => {
        const incomingId = '550e8400-e29b-41d4-a716-446655440000';
        const middleware = traceId();
        const ctx = createMockContext({
          headers: { 'X-Trace-Id': incomingId },
        });

        await middleware(ctx);

        expect(ctx.state.traceId).not.toBe(incomingId);
      });
    });
  });
});
