/**
 * Tests for Context Safety Utilities
 */

import type { Context } from '@/types/context';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ContextSafety,
  SafeContext,
  SafeContextPool,
  createSafeContext,
  createSafeMiddleware,
} from './immutable';

// Mock context helper
function createMockContext(): Context {
  const req = {} as any;
  const res = {} as any;

  return {
    req,
    res,
    body: undefined,
    method: 'GET',
    url: '/',
    path: '/',
    headers: { 'user-agent': 'test' },
    query: {},
    params: {},
    id: 'test-id-123',
    requestId: 'req-456',
    logger: {
      log: () => {},
      error: () => {},
      warn: () => {},
      info: () => {},
    },
    state: {},
    startTime: Date.now(),
    ip: '127.0.0.1',
    secure: false,
    protocol: 'http',
    hostname: 'localhost',
    host: 'localhost:3000',
    origin: 'http://localhost:3000',
    href: 'http://localhost:3000/',
    search: '',
    searchParams: new URLSearchParams(),
    status: 200,
    responseHeaders: {},
    fresh: () => false,
    stale: () => true,
    idempotent: () => false,
    cacheable: () => false,
    throw: (status: number, message?: string): never => {
      throw new Error(`${status}: ${message || 'Error'}`);
    },
    assert: () => {},
    set: () => {},
  };
}

describe('SafeContext', () => {
  let mockContext: Context;
  let safeContext: SafeContext;

  beforeEach(() => {
    mockContext = createMockContext();
    safeContext = createSafeContext(mockContext);
  });

  describe('constructor', () => {
    it('should create SafeContext from regular context', () => {
      expect(safeContext).toBeDefined();
      expect(safeContext.context).toBe(mockContext);
    });

    it('should freeze immutable properties', () => {
      const params = safeContext.params;
      const state = safeContext.state;

      expect(params).toEqual(mockContext.params);
      expect(state).toEqual(mockContext.state);
      expect(params).not.toBe(mockContext.params); // Should be different objects
      expect(state).not.toBe(mockContext.state); // Should be different objects
    });
  });

  describe('property access', () => {
    it('should return frozen copies of mutable properties', () => {
      mockContext.params = { userId: '123' };
      mockContext.state = { user: 'john' };

      const newSafeContext = createSafeContext(mockContext);

      expect(newSafeContext.params).toEqual({ userId: '123' });
      expect(newSafeContext.state).toEqual({ user: 'john' });

      // Should be different object references
      expect(newSafeContext.params).not.toBe(mockContext.params);
      expect(newSafeContext.state).not.toBe(mockContext.state);
    });

    it('should handle optional properties correctly', () => {
      const contextWithoutOptionals = { ...mockContext };
      delete contextWithoutOptionals.requestId;
      delete contextWithoutOptionals.logger;

      const safeCont = createSafeContext(contextWithoutOptionals);

      expect(safeCont.requestId).toBeUndefined();
      expect(safeCont.logger).toBeUndefined();
    });
  });

  describe('immutable updates', () => {
    it('should create new SafeContext with updated body', () => {
      const newBody = { message: 'hello' };
      const updated = safeContext.withBody(newBody);

      expect(updated).not.toBe(safeContext);
      expect(updated.body).toEqual(newBody);
      expect(safeContext.body).toBeUndefined(); // Original unchanged
    });

    it('should create new SafeContext with updated params', () => {
      const newParams = { userId: '123', postId: '456' };
      const updated = safeContext.withParams(newParams);

      expect(updated).not.toBe(safeContext);
      expect(updated.params).toEqual(newParams);
      expect(safeContext.params).toEqual({}); // Original unchanged
    });

    it('should create new SafeContext with added param', () => {
      safeContext = safeContext.withParam('userId', '123');
      const updated = safeContext.withParam('postId', '456');

      expect(updated.params).toEqual({ userId: '123', postId: '456' });
      expect(safeContext.params).toEqual({ userId: '123' }); // Original unchanged
    });

    it('should create new SafeContext with updated state', () => {
      const newState = { user: 'john', role: 'admin' };
      const updated = safeContext.withState(newState);

      expect(updated.state).toEqual(newState);
      expect(safeContext.state).toEqual({}); // Original unchanged
    });

    it('should create new SafeContext with added state property', () => {
      const updated = safeContext.withStateProperty('user', 'john');

      expect(updated.state).toEqual({ user: 'john' });
      expect(safeContext.state).toEqual({}); // Original unchanged
    });

    it('should create new SafeContext with updated query', () => {
      const newQuery = { search: 'test', limit: '10' };
      const updated = safeContext.withQuery(newQuery);

      expect(updated.query).toEqual(newQuery);
      expect(safeContext.query).toEqual({}); // Original unchanged
    });

    it('should create new SafeContext with updated request ID', () => {
      const newRequestId = 'new-req-789';
      const updated = safeContext.withRequestId(newRequestId);

      expect(updated.requestId).toBe(newRequestId);
      expect(safeContext.requestId).toBe('req-456'); // Original unchanged
    });
  });

  describe('bulk updates', () => {
    it('should apply multiple updates at once', () => {
      const updates = {
        body: { message: 'hello' },
        params: { userId: '123' },
        state: { user: 'john' },
        requestId: 'bulk-update-req',
      };

      const updated = safeContext.withUpdates(updates);

      expect(updated.body).toEqual(updates.body);
      expect(updated.params).toEqual(updates.params);
      expect(updated.state).toEqual(updates.state);
      expect(updated.requestId).toBe(updates.requestId);

      // Original should be unchanged
      expect(safeContext.body).toBeUndefined();
      expect(safeContext.params).toEqual({});
      expect(safeContext.state).toEqual({});
      expect(safeContext.requestId).toBe('req-456');
    });
  });

  describe('commit', () => {
    it('should apply changes back to original context', () => {
      const updated = safeContext
        .withBody({ message: 'hello' })
        .withParam('userId', '123')
        .withStateProperty('user', 'john');

      const committedContext = updated.commit();

      expect(committedContext).toBe(updated.context);
      expect(committedContext.body).toEqual({ message: 'hello' });
      expect(committedContext.params).toEqual({ userId: '123' });
      expect(committedContext.state).toEqual({ user: 'john' });
    });

    it('should handle optional properties correctly in commit', () => {
      const updated = safeContext.withRequestId('committed-req');
      const committedContext = updated.commit();

      expect(committedContext.requestId).toBe('committed-req');
    });
  });
});

describe('createSafeMiddleware', () => {
  it('should convert regular middleware to work with SafeContext', async () => {
    const regularMiddleware = async (
      ctx: Context,
      next: () => Promise<void>
    ) => {
      ctx.state['middleware'] = 'executed';
      await next();
    };

    const safeMiddleware = createSafeMiddleware(regularMiddleware);
    const mockContext = createMockContext();
    const safeCtx = createSafeContext(mockContext);

    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
    };

    const result = await safeMiddleware(safeCtx, next);

    expect(nextCalled).toBe(true);
    expect(result).toBeInstanceOf(SafeContext);
    if (result) {
      expect(result.context.state['middleware']).toBe('executed');
    }
  });
});

describe('ContextSafety utilities', () => {
  let safeCtx1: SafeContext;
  let safeCtx2: SafeContext;

  beforeEach(() => {
    const mockCtx1 = createMockContext();
    const mockCtx2 = createMockContext();

    safeCtx1 = createSafeContext(mockCtx1);
    safeCtx2 = createSafeContext(mockCtx2);
  });

  describe('areEqual', () => {
    it('should return true for contexts with same immutable properties', () => {
      expect(ContextSafety.areEqual(safeCtx1, safeCtx2)).toBe(true);
    });

    it('should return false for contexts with different properties', () => {
      const updated = safeCtx2.withBody({ different: true });
      expect(ContextSafety.areEqual(safeCtx1, updated)).toBe(false);
    });
  });

  describe('snapshot', () => {
    it('should create context snapshot', () => {
      const updated = safeCtx1
        .withBody({ test: 'data' })
        .withParam('id', '123');

      const snapshot = ContextSafety.snapshot(updated);

      expect(snapshot).toHaveProperty('body', { test: 'data' });
      expect(snapshot).toHaveProperty('params', { id: '123' });
      expect(snapshot).toHaveProperty('timestamp');
      expect(typeof snapshot.timestamp).toBe('number');
    });
  });

  describe('validate', () => {
    it('should validate valid context', () => {
      expect(ContextSafety.validate(safeCtx1)).toBe(true);
    });

    it('should invalidate context with missing required properties', () => {
      const invalidContext = createMockContext();
      delete (invalidContext as any).req;
      const invalidSafeCtx = createSafeContext(invalidContext);

      expect(ContextSafety.validate(invalidSafeCtx)).toBe(false);
    });
  });

  describe('deepFreeze', () => {
    it('should deep freeze nested objects', () => {
      const obj = {
        level1: {
          level2: {
            value: 'test',
          },
        },
      };

      const frozen = ContextSafety.deepFreeze(obj);

      expect(Object.isFrozen(frozen)).toBe(true);
      expect(Object.isFrozen(frozen['level1'])).toBe(true);
      expect(Object.isFrozen((frozen['level1'] as any)['level2'])).toBe(true);
    });
  });
});

describe('SafeContextPool', () => {
  it('should acquire and track context instances', () => {
    const mockContext = createMockContext();
    const pooled = SafeContextPool.acquire(mockContext);

    expect(pooled).toBeInstanceOf(SafeContext);
    expect(pooled.context).toBe(mockContext);
  });

  it('should manage pool size', () => {
    const mockContext = createMockContext();
    const pooled = SafeContextPool.acquire(mockContext);

    SafeContextPool.release(pooled);
    SafeContextPool.clear();

    expect(SafeContextPool.size()).toBe(0);
  });
});
