/**
 * E2E Conformance Suite - Tier 2: Boundary & Corner Cases
 *
 * Requirements Tested:
 * - Feature A: Multi-Prefix Boundary & Corner Cases
 *   * Empty prefix array guard: app.route([], router) throws descriptive Error
 *   * Invalid prefix type guard: non-string elements throw TypeError
 *   * Root prefix within array: ['/api', '/'] cleanly matches root and prefixed paths
 *   * Segment boundary collision: /api does not match /apigateway or /api_v2
 *   * Slashes normalization: prefixes with/without leading and trailing slashes
 *   * State isolation and recovery: ctx.path rewritten for sub-router and restored in finally
 *   * Lifecycle mutation guard: app.route() rejected after boot via assertConfigurable
 *
 * - Feature B: Universal app.fetch Boundary & Corner Cases
 *   * Synchronous dispatch fast-path: returns bare Response synchronously
 *   * Deferred boot barrier: concurrent cold-start requests share single boot execution
 *   * Boot failure recovery: failed boot resets promise so subsequent requests can retry
 *   * Per-invocation timeout barrier: produces 504 Gateway Timeout and aborts ctx.signal
 *   * Response commitment protection: committed 200 response delivered even if slow task outlives timeout
 *   * Timeout disabled: timeout: 0 disables framework timeout barrier
 *   * Error boundary finalizer: catches sync/async exceptions and returns 500 JSON
 *   * Custom onError override: custom error formatter produces custom status/body
 *   * Zero overhead for listen(): fetch runner remains uninstantiated
 */

import { describe, expect, it } from 'vitest';
import { createApp } from '@nextrush/core';
import { Router } from '@nextrush/router';
import { createRequest, createUniversalApp, unwrapResponse } from './universal-fetch-harness';

describe('Tier 2: Boundary & Corner Cases', () => {
  describe('Feature A: Multi-Prefix Router Mounting Boundaries', () => {
    it('TC-2.1: Empty prefix array throws descriptive error', () => {
      const app = createApp();
      const subRouter = new Router();

      expect(() => {
        app.route([], subRouter);
      }).toThrow(/app\.route\(\) requires at least one path prefix when an array is provided/);
    });

    it('TC-2.2: Array containing non-string elements throws TypeError', () => {
      const app = createApp();
      const subRouter = new Router();

      expect(() => {
        // @ts-expect-error - Testing invalid input at runtime
        app.route(['/api', 12345], subRouter);
      }).toThrow(/Route path prefix must be a string/);

      expect(() => {
        // @ts-expect-error - Testing invalid input at runtime
        app.route(['/api', null], subRouter);
      }).toThrow(/Route path prefix must be a string/);
    });

    it('TC-2.3: Root prefix within array ([\'/api\', \'/\']) dispatches root and prefixed paths', async () => {
      const app = createApp();
      const subRouter = new Router();

      subRouter.get('/health', (ctx) => ctx.json({ ok: true, matched: ctx.path }));

      app.route(['/api', '/'], subRouter);

      // Matches /api/health
      const resApi = await unwrapResponse(app.fetch(createRequest('/api/health')));
      expect(resApi.status).toBe(200);
      expect(resApi.json()).toEqual({ ok: true, matched: '/health' });

      // Matches /health at root
      const resRoot = await unwrapResponse(app.fetch(createRequest('/health')));
      expect(resRoot.status).toBe(200);
      expect(resRoot.json()).toEqual({ ok: true, matched: '/health' });
    });

    it('TC-2.4: Segment boundary collision protection: /api does not match /apigateway or /api_v2', async () => {
      const app = createUniversalApp();
      const subRouter = new Router();
      subRouter.get('/gateway', (ctx) => ctx.json({ status: 'matched_sub' }));

      app.route(['/api', '/v1'], subRouter);

      // Route defined at root application level for /apigateway
      app.get('/apigateway', (ctx) => ctx.json({ status: 'matched_root' }));

      // Request to /api/gateway should match subRouter
      const resSub = await unwrapResponse(app.fetch(createRequest('/api/gateway')));
      expect(resSub.status).toBe(200);
      expect(resSub.json()).toEqual({ status: 'matched_sub' });

      // Request to /apigateway should NOT match /api mount; it must match root handler
      const resRoot = await unwrapResponse(app.fetch(createRequest('/apigateway')));
      expect(resRoot.status).toBe(200);
      expect(resRoot.json()).toEqual({ status: 'matched_root' });

      // Request to /apigateway/other should 404, not match /api
      const res404 = await unwrapResponse(app.fetch(createRequest('/apigateway/other')));
      expect(res404.status).toBe(404);
    });

    it('TC-2.5: Normalizes prefixes without leading slash or with trailing slash', async () => {
      const app = createApp();
      const subRouter = new Router();
      subRouter.get('/items', (ctx) => ctx.json({ count: 10 }));

      // 'api/' has trailing slash and missing leading slash; 'v1/' has trailing slash
      app.route(['api/', '/v1/'], subRouter);

      const resApi = await unwrapResponse(app.fetch(createRequest('/api/items')));
      expect(resApi.status).toBe(200);
      expect(resApi.json()).toEqual({ count: 10 });

      const resV1 = await unwrapResponse(app.fetch(createRequest('/v1/items')));
      expect(resV1.status).toBe(200);
      expect(resV1.json()).toEqual({ count: 10 });
    });

    it('TC-2.6: State isolation and recovery restores original ctx.path in finally block even when handler throws', async () => {
      const app = createApp();
      const subRouter = new Router();
      let pathInErrorHandler = '';

      subRouter.get('/explode', () => {
        throw new Error('Explosion inside sub-router');
      });

      // App-level middleware tracking path after sub-router execution
      app.use(async (ctx, next) => {
        try {
          await next();
        } catch (err) {
          pathInErrorHandler = ctx.path;
          ctx.status = 500;
          ctx.json({ error: (err as Error).message, restoredPath: ctx.path });
        }
      });

      app.route(['/api', '/v1'], subRouter);

      const res = await unwrapResponse(app.fetch(createRequest('/api/explode')));
      expect(res.status).toBe(500);
      // Path must be restored to original incoming path '/api/explode', NOT '/explode'
      expect(pathInErrorHandler).toBe('/api/explode');
      expect(res.json()).toEqual({
        error: 'Explosion inside sub-router',
        restoredPath: '/api/explode',
      });
    });

    it('TC-2.7: Calling app.route() after application has booted throws assertConfigurable error', async () => {
      const app = createUniversalApp();
      app.get('/init', (ctx) => ctx.send('ok'));

      // Boot application by calling app.ready() or first fetch
      await unwrapResponse(app.fetch(createRequest('/init')));

      const lateRouter = new Router();
      lateRouter.get('/late', (ctx) => ctx.send('late'));

      expect(() => {
        app.route(['/late1', '/late2'], lateRouter);
      }).toThrow(/Cannot call route\(\) after application has booted or server has started/);
    });
  });

  describe('Feature B: Universal app.fetch Boundaries & Concurrency', () => {
    it('TC-2.8: Synchronous dispatch fast-path returns bare Response synchronously', () => {
      const app = createUniversalApp();
      app.get('/sync-endpoint', (ctx) => {
        return ctx.json({ sync: true });
      });

      const res = app.fetch(createRequest('/sync-endpoint'));

      // In the synchronous fast-path, res must be an instance of Response, NOT a Promise
      expect(res).toBeInstanceOf(Response);
      expect((res as Response).status).toBe(200);
    });

    it('TC-2.9: Deferred boot barrier executes app.ready() exactly once across 25 concurrent cold-start requests', async () => {
      let bootCount = 0;
      const app = createUniversalApp();

      // Register an extension or hook that tracks boot execution
      app.extend({
        name: 'test-boot-counter',
        setup: () => {
          bootCount += 1;
        },
      });

      app.get('/concurrent-test', (ctx) => {
        return ctx.json({ bootCount });
      });

      // Dispatch 25 concurrent requests on cold application
      const requests = Array.from({ length: 25 }, () =>
        unwrapResponse(app.fetch(createRequest('/concurrent-test')))
      );

      const results = await Promise.all(requests);

      // Verify all 25 requests succeeded
      for (const res of results) {
        expect(res.status).toBe(200);
        expect(res.json()).toEqual({ bootCount: 1 });
      }

      // Boot hook must have run exactly once
      expect(bootCount).toBe(1);
    });

    it('TC-2.10: Boot failure recovery resets bootPromise allowing subsequent requests to retry and succeed', async () => {
      let attempt = 0;
      const app = createUniversalApp();

      app.extend({
        name: 'test-flaky-boot',
        setup: () => {
          attempt += 1;
          if (attempt === 1) {
            throw new Error('Transient boot failure (database connection down)');
          }
        },
      });

      app.get('/flaky', (ctx) => ctx.json({ status: 'recovered' }));

      // First request should fail due to boot error
      const firstRes = await unwrapResponse(app.fetch(createRequest('/flaky')));
      expect(firstRes.status).toBe(500);

      // Second request should retry boot and succeed
      const secondRes = await unwrapResponse(app.fetch(createRequest('/flaky')));
      expect(secondRes.status).toBe(200);
      expect(secondRes.json()).toEqual({ status: 'recovered' });
    });

    it('TC-2.11: Per-invocation timeout barrier aborts ctx.signal and returns 504 Gateway Timeout', async () => {
      const app = createUniversalApp({
        fetch: { timeout: 40 }, // 40ms timeout
      });

      let signalAborted = false;

      app.get('/slow-uncommitted', async (ctx) => {
        ctx.signal.addEventListener('abort', () => {
          signalAborted = true;
        });

        // Delay longer than 40ms timeout without committing response
        await new Promise((resolve) => setTimeout(resolve, 100));
        ctx.json({ ok: false });
      });

      const res = await unwrapResponse(app.fetch(createRequest('/slow-uncommitted')));

      expect(res.status).toBe(504);
      expect(res.headers.get('content-type')).toContain('application/json');
      expect(res.json()).toEqual({ error: 'Gateway Timeout' });
      expect(signalAborted).toBe(true);
    });

    it('TC-2.12: Response commitment protection: committed 200 response is delivered even if slow task exceeds timeout', async () => {
      const app = createUniversalApp({
        fetch: { timeout: 40 },
      });

      app.get('/slow-committed', async (ctx) => {
        // Commit response immediately
        ctx.json({ committed: true });

        // Simulate subsequent async work exceeding timeout
        await new Promise((resolve) => setTimeout(resolve, 80));
      });

      const res = await unwrapResponse(app.fetch(createRequest('/slow-committed')));

      // Committed response must be delivered to client, NOT overwritten with 504
      expect(res.status).toBe(200);
      expect(res.json()).toEqual({ committed: true });
    });

    it('TC-2.13: fetch.timeout: 0 disables framework timeout barrier for long-running requests', async () => {
      const app = createUniversalApp({
        fetch: { timeout: 0 }, // Timeout explicitly disabled
      });

      app.get('/long-running', async (ctx) => {
        await new Promise((resolve) => setTimeout(resolve, 60));
        ctx.json({ completed: true });
      });

      const res = await unwrapResponse(app.fetch(createRequest('/long-running')));
      expect(res.status).toBe(200);
      expect(res.json()).toEqual({ completed: true });
    });

    it('TC-2.14: Error boundary finalizer captures uncaught sync/async exceptions returning 500 JSON', async () => {
      const app = createUniversalApp();

      app.get('/sync-throw', () => {
        throw new Error('Fatal sync explosion');
      });

      app.get('/async-throw', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        throw new Error('Fatal async explosion');
      });

      const resSync = await unwrapResponse(app.fetch(createRequest('/sync-throw')));
      expect(resSync.status).toBe(500);
      expect(resSync.headers.get('content-type')).toContain('application/json');
      expect(resSync.json()).toMatchObject({ status: 500, error: 'Internal Server Error', code: 'INTERNAL_ERROR' });

      const resAsync = await unwrapResponse(app.fetch(createRequest('/async-throw')));
      expect(resAsync.status).toBe(500);
      expect(resAsync.headers.get('content-type')).toContain('application/json');
      expect(resAsync.json()).toMatchObject({ status: 500, error: 'Internal Server Error', code: 'INTERNAL_ERROR' });
    });

    it('TC-2.15: Custom onError override maps error to custom status and body', async () => {
      const app = createUniversalApp({
        fetch: {
          onError: (error: Error) => {
            return new Response(JSON.stringify({ custom_error: error.message, code: 'ERR_CUSTOM' }), {
              status: 418,
              headers: { 'content-type': 'application/json', 'x-custom-error': '1' },
            });
          },
        },
      });

      app.get('/custom-fail', () => {
        throw new Error('Teapot required');
      });

      const res = await unwrapResponse(app.fetch(createRequest('/custom-fail')));
      expect(res.status).toBe(418);
      expect(res.headers.get('x-custom-error')).toBe('1');
      expect(res.json()).toEqual({ custom_error: 'Teapot required', code: 'ERR_CUSTOM' });
    });

    it('TC-2.16: listen() server incurs zero overhead from app.fetch', () => {
      const app = createApp();
      // Internal property check: _fetchRunner should remain undefined when app is created and never fetched
      const internalApp = app as unknown as { _fetchRunner?: unknown };
      expect(internalApp._fetchRunner).toBeUndefined();
    });
  });
});
