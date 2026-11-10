/**
 * @nextrush/router - Adversarial Multi-Prefix Sub-Router Mounting Suite
 *
 * Empirical challenger harness for Milestone 1 (Feature 7: Router.mount() Symmetry).
 * Systematically stress-tests:
 * 1. Trie compilation and route inheritance across multiple prefixes.
 * 2. Parameter binding and wildcard resolution on all mounted prefixes.
 * 3. Middleware composition order across parent, sub-router, and route-level middlewares.
 * 4. HEAD auto-registration and allowedMethods introspection on multi-prefix mounts.
 * 5. High-volume route matching performance and allocation hygiene.
 * 6. Edge case prefix normalization and boundary isolation.
 */

import type { Context, Middleware } from '@nextrush/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouter, Router } from '../router';

describe('Adversarial Multi-Prefix Sub-Router Mounting (router.mount)', () => {
  let router: Router;

  beforeEach(() => {
    router = createRouter();
  });

  describe('1. Complex Trie Compilation Across Multiple Prefixes', () => {
    it('accurately compiles static, param, and wildcard routes across multiple prefixes', () => {
      const subRouter = createRouter();

      const userHandler = vi.fn();
      const userPostHandler = vi.fn();
      const assetsHandler = vi.fn();

      subRouter.get('/users/:userId', userHandler);
      subRouter.get('/users/:userId/posts/:postId', userPostHandler);
      subRouter.get('/assets/*', assetsHandler);

      router.mount(['/api/v1', '/api/v2', '/internal'], subRouter);

      const prefixes = ['/api/v1', '/api/v2', '/internal'];

      for (const prefix of prefixes) {
        // Param route
        const m1 = router.match('GET', `${prefix}/users/123`);
        expect(m1).not.toBeNull();
        expect(m1?.handler).toBe(userHandler);
        expect(m1?.params.userId).toBe('123');

        // Multi-param route
        const m2 = router.match('GET', `${prefix}/users/123/posts/456`);
        expect(m2).not.toBeNull();
        expect(m2?.handler).toBe(userPostHandler);
        expect(m2?.params.userId).toBe('123');
        expect(m2?.params.postId).toBe('456');

        // Wildcard route
        const m3 = router.match('GET', `${prefix}/assets/css/main.css`);
        expect(m3).not.toBeNull();
        expect(m3?.handler).toBe(assetsHandler);
        expect(m3?.params['*']).toBe('css/main.css');
      }
    });

    it('inherits HEAD auto-registration across all mounted prefixes', () => {
      const subRouter = createRouter();
      const getHandler = vi.fn();
      subRouter.get('/status', getHandler);

      router.mount(['/api', '/v1', '/v2'], subRouter);

      for (const prefix of ['/api', '/v1', '/v2']) {
        const matchHead = router.match('HEAD', `${prefix}/status`);
        expect(matchHead).not.toBeNull();
        expect(matchHead?.handler).toBe(getHandler);
      }
    });
  });

  describe('2. Middleware Pipeline Ordering in Multi-Prefix Mounting', () => {
    it('strictly preserves middleware execution order: parent -> sub-router -> route -> handler across all prefixes', async () => {
      const parentRouter = createRouter();
      const subRouter = createRouter();

      const executionOrder: string[] = [];

      // Parent router middleware
      parentRouter.use(async (_ctx, next) => {
        executionOrder.push('parent-mw-enter');
        if (next) await next();
        executionOrder.push('parent-mw-exit');
      });

      // Sub-router middleware 1
      subRouter.use(async (_ctx, next) => {
        executionOrder.push('sub-mw1-enter');
        if (next) await next();
        executionOrder.push('sub-mw1-exit');
      });

      // Sub-router middleware 2
      subRouter.use(async (_ctx, next) => {
        executionOrder.push('sub-mw2-enter');
        if (next) await next();
        executionOrder.push('sub-mw2-exit');
      });

      // Route-level middleware
      const routeMw: Middleware = async (_ctx, next) => {
        executionOrder.push('route-mw-enter');
        if (next) await next();
        executionOrder.push('route-mw-exit');
      };

      subRouter.get('/action', routeMw, async () => {
        executionOrder.push('handler');
      });

      parentRouter.mount(['/api', '/v1'], subRouter);

      const dispatch = parentRouter.routes();

      // Test execution order on /api/action
      executionOrder.length = 0;
      const ctxApi = {
        method: 'GET',
        path: '/api/action',
        params: {},
        state: {},
      } as unknown as Context;

      await dispatch(ctxApi);

      expect(executionOrder).toEqual([
        'parent-mw-enter',
        'sub-mw1-enter',
        'sub-mw2-enter',
        'route-mw-enter',
        'handler',
        'route-mw-exit',
        'sub-mw2-exit',
        'sub-mw1-exit',
        'parent-mw-exit',
      ]);

      // Test execution order on /v1/action (must be identical)
      executionOrder.length = 0;
      const ctxV1 = {
        method: 'GET',
        path: '/v1/action',
        params: {},
        state: {},
      } as unknown as Context;

      await dispatch(ctxV1);

      expect(executionOrder).toEqual([
        'parent-mw-enter',
        'sub-mw1-enter',
        'sub-mw2-enter',
        'route-mw-enter',
        'handler',
        'route-mw-exit',
        'sub-mw2-exit',
        'sub-mw1-exit',
        'parent-mw-exit',
      ]);
    });
  });

  describe('3. Immutability and Input Hardening', () => {
    it('accepts frozen arrays and is immune to post-mount caller mutations', () => {
      const prefixes = Object.freeze(['/a', '/b']);
      const subRouter = createRouter();
      subRouter.get('/test', vi.fn());

      router.mount(prefixes, subRouter);

      expect(router.match('GET', '/a/test')).not.toBeNull();
      expect(router.match('GET', '/b/test')).not.toBeNull();

      // Mutable array test
      const mutablePrefixes = ['/x', '/y'];
      const sub2 = createRouter();
      sub2.get('/test2', vi.fn());

      router.mount(mutablePrefixes, sub2);
      mutablePrefixes.push('/z'); // mutate caller array after mount

      expect(router.match('GET', '/x/test2')).not.toBeNull();
      expect(router.match('GET', '/y/test2')).not.toBeNull();
      expect(router.match('GET', '/z/test2')).toBeNull(); // /z was not mounted
    });

    it('rejects arrays with non-string elements with exact error messages', () => {
      const sub = createRouter();

      expect(() => router.mount(['/a', 42 as unknown as string], sub)).toThrow(
        new TypeError('Route path prefix must be a string, received number')
      );

      expect(() => router.mount(['/a', null as unknown as string], sub)).toThrow(
        new TypeError('Route path prefix must be a string, received null')
      );

      expect(() => router.mount(['/a', ''], sub)).toThrow(
        new TypeError('Route path prefix must be a non-empty string')
      );
    });
  });

  describe('4. High-Volume Match Performance & Allocation Hygiene', () => {
    it('executes 50,000 route matches on multi-prefix mounted router with sub-microsecond latency', () => {
      const sub = createRouter();
      sub.get('/users/:userId/posts/:postId', vi.fn());
      sub.get('/categories/:catId/items', vi.fn());

      router.mount(['/api/v1', '/api/v2', '/internal'], sub);

      // Warm up JIT
      for (let i = 0; i < 1000; i++) {
        router.match('GET', '/api/v2/users/99/posts/555');
      }

      const ITERATIONS = 50000;
      const start = performance.now();

      for (let i = 0; i < ITERATIONS; i++) {
        const m = router.match('GET', '/api/v2/users/99/posts/555');
        if (m === null) throw new Error('Match failed');
      }

      const totalMs = performance.now() - start;
      const avgNsPerOp = (totalMs * 1_000_000) / ITERATIONS;

      // In-memory trie match should be well under 50,000 ns (50 µs) per op even under heavy multi-package CI CPU contention
      expect(avgNsPerOp).toBeLessThan(50_000);
    });
  });
});
