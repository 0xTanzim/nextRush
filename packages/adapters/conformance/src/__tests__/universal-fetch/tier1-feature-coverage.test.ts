/**
 * E2E Conformance Suite - Tier 1: Feature Coverage
 *
 * Requirements Tested:
 * - Feature A: Multi-Prefix Router Mounting (app.route(prefixes, router))
 *   * Dual prefix mounting (['/api', '/v1'])
 *   * Multiple prefix mounting (['/a', '/b', '/c'])
 *   * Multi-method routing (GET, POST, PUT, DELETE, PATCH)
 *   * Parameter extraction (:id) across prefixes
 *   * Sub-router middleware chain across prefixes
 *   * Nested multi-prefix router mounting
 *
 * - Feature B: Universal app.fetch Invocation Ergonomics
 *   * Standard 1-arg invocation: (request)
 *   * Cloudflare Workers 3-arg invocation: (request, env, ctx) with ctx.env and ctx.waitUntil
 *   * Vercel Edge 2-arg invocation: (request, ctx) with ctx.waitUntil
 *   * Bun 2-arg invocation: (request, server) with server.requestIP
 *   * Deno 2-arg invocation: (request, info) with info.remoteAddr
 *   * Instance-bound property destructuring safety ({ fetch } = app)
 */

import { describe, expect, it } from 'vitest';
import { createApp } from '@nextrush/core';
import { Router } from '@nextrush/router';
import {
  createMockBunServer,
  createMockCloudflareContext,
  createMockDenoInfo,
  createMockVercelContext,
  createRequest,
  createUniversalApp,
  unwrapResponse,
} from './universal-fetch-harness';

describe('Tier 1: Feature Coverage', () => {
  describe('Feature A: Multi-Prefix Router Mounting', () => {
    it('TC-1.1: app.route([\'/api\', \'/v1\'], router) dispatches handlers across both prefixes', async () => {
      const app = createApp();
      const subRouter = new Router();
      subRouter.get('/users', (ctx) => {
        return ctx.json({ users: ['alice', 'bob'] });
      });

      app.route(['/api', '/v1'], subRouter);

      // Verify prefix 1: /api/users
      const resApi = await unwrapResponse(app.fetch(createRequest('/api/users')));
      expect(resApi.status).toBe(200);
      expect(resApi.json()).toEqual({ users: ['alice', 'bob'] });

      // Verify prefix 2: /v1/users
      const resV1 = await unwrapResponse(app.fetch(createRequest('/v1/users')));
      expect(resV1.status).toBe(200);
      expect(resV1.json()).toEqual({ users: ['alice', 'bob'] });
    });

    it('TC-1.2: app.route([\'/a\', \'/b\', \'/c\'], router) dispatches across 3+ prefixes simultaneously', async () => {
      const app = createApp();
      const subRouter = new Router();
      subRouter.get('/ping', (ctx) => {
        return ctx.send('pong');
      });

      app.route(['/a', '/b', '/c'], subRouter);

      for (const prefix of ['/a', '/b', '/c']) {
        const res = await unwrapResponse(app.fetch(createRequest(`${prefix}/ping`)));
        expect(res.status).toBe(200);
        expect(res.text).toBe('pong');
      }
    });

    it('TC-1.3: Multi-method routing (GET, POST, PUT, DELETE, PATCH) on sub-router works across all prefixes', async () => {
      const app = createApp();
      const subRouter = new Router();

      subRouter.get('/resource', (ctx) => ctx.json({ method: 'GET' }));
      subRouter.post('/resource', (ctx) => ctx.json({ method: 'POST' }));
      subRouter.put('/resource', (ctx) => ctx.json({ method: 'PUT' }));
      subRouter.delete('/resource', (ctx) => ctx.json({ method: 'DELETE' }));
      subRouter.patch('/resource', (ctx) => ctx.json({ method: 'PATCH' }));

      app.route(['/v1', '/v2'], subRouter);

      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;
      for (const prefix of ['/v1', '/v2']) {
        for (const method of methods) {
          const res = await unwrapResponse(
            app.fetch(createRequest(`${prefix}/resource`, { method }))
          );
          expect(res.status).toBe(200);
          expect(res.json()).toEqual({ method });
        }
      }
    });

    it('TC-1.4: Dynamic path parameter extraction works identically across all mounted prefixes', async () => {
      const app = createApp();
      const subRouter = new Router();

      subRouter.get('/users/:userId/orders/:orderId', (ctx) => {
        return ctx.json({
          userId: ctx.params.userId,
          orderId: ctx.params.orderId,
        });
      });

      app.route(['/api', '/v1'], subRouter);

      const resApi = await unwrapResponse(
        app.fetch(createRequest('/api/users/usr_101/orders/ord_555'))
      );
      expect(resApi.status).toBe(200);
      expect(resApi.json()).toEqual({ userId: 'usr_101', orderId: 'ord_555' });

      const resV1 = await unwrapResponse(
        app.fetch(createRequest('/v1/users/usr_101/orders/ord_555'))
      );
      expect(resV1.status).toBe(200);
      expect(resV1.json()).toEqual({ userId: 'usr_101', orderId: 'ord_555' });
    });

    it('TC-1.5: Nested multi-prefix router mounting dispatches composed paths correctly', async () => {
      const app = createApp();
      const adminRouter = new Router();
      const leafRouter = new Router();

      leafRouter.get('/metrics', (ctx) => ctx.json({ status: 'ok', active: true }));

      // Mount leafRouter on adminRouter under dual prefixes
      adminRouter.mount(['/admin', '/internal'], leafRouter);

      // Mount adminRouter on app under dual prefixes
      app.route(['/api', '/v1'], adminRouter);

      const validPaths = [
        '/api/admin/metrics',
        '/api/internal/metrics',
        '/v1/admin/metrics',
        '/v1/internal/metrics',
      ];

      for (const path of validPaths) {
        const res = await unwrapResponse(app.fetch(createRequest(path)));
        expect(res.status).toBe(200);
        expect(res.json()).toEqual({ status: 'ok', active: true });
      }
    });

    it('TC-1.6: Sub-router middleware chain executes for all mounted prefixes', async () => {
      const app = createApp();
      const subRouter = new Router();

      subRouter.use(async (ctx, next) => {
        ctx.state.intercepted = true;
        ctx.set('x-sub-router', 'true');
        await next();
      });

      subRouter.get('/check', (ctx) => {
        return ctx.json({ intercepted: ctx.state.intercepted });
      });

      app.route(['/api', '/v1'], subRouter);

      for (const prefix of ['/api', '/v1']) {
        const res = await unwrapResponse(app.fetch(createRequest(`${prefix}/check`)));
        expect(res.status).toBe(200);
        expect(res.headers.get('x-sub-router')).toBe('true');
        expect(res.json()).toEqual({ intercepted: true });
      }
    });
  });

  describe('Feature B: Universal app.fetch Invocation Ergonomics', () => {
    it('TC-1.7: Standard 1-argument invocation app.fetch(request) runs without adapter imports', async () => {
      const app = createUniversalApp();
      app.get('/health', (ctx) => ctx.json({ healthy: true }));

      const res = await unwrapResponse(app.fetch(createRequest('/health')));
      expect(res.status).toBe(200);
      expect(res.json()).toEqual({ healthy: true });
    });

    it('TC-1.8: Cloudflare Workers 3-arg invocation (req, env, ctx) binds ctx.env and delegates ctx.waitUntil', async () => {
      const app = createUniversalApp();
      let backgroundExecuted = false;

      app.get('/cf-endpoint', (ctx) => {
        const env = ctx.env as { KV: { get: (k: string) => string }; SECRET_KEY: string };
        const secret = env.SECRET_KEY;
        const kvVal = env.KV.get('hello');

        ctx.waitUntil(
          (async () => {
            backgroundExecuted = true;
          })()
        );

        return ctx.json({ secret, kvVal });
      });

      const { env, ctx } = createMockCloudflareContext({
        SECRET_KEY: 'cf-secret-xyz',
        KV: { get: (k: string) => `value_for_${k}` },
      });

      const res = await unwrapResponse(
        app.fetch(createRequest('/cf-endpoint'), env, ctx)
      );

      expect(res.status).toBe(200);
      expect(res.json()).toEqual({ secret: 'cf-secret-xyz', kvVal: 'value_for_hello' });
      expect(ctx.scheduledPromises.length).toBe(1);

      // Await the scheduled promise in the mock execution context
      await Promise.all(ctx.scheduledPromises);
      expect(backgroundExecuted).toBe(true);
    });

    it('TC-1.9: Vercel Edge 2-arg invocation (req, ctx) delegates ctx.waitUntil', async () => {
      const app = createUniversalApp();
      let vercelBgExecuted = false;

      app.get('/vercel-edge', (ctx) => {
        ctx.waitUntil(
          (async () => {
            vercelBgExecuted = true;
          })()
        );
        return ctx.send('vercel response');
      });

      const vercelCtx = createMockVercelContext();
      const res = await unwrapResponse(
        app.fetch(createRequest('/vercel-edge'), vercelCtx)
      );

      expect(res.status).toBe(200);
      expect(res.text).toBe('vercel response');
      expect(vercelCtx.scheduledPromises.length).toBe(1);

      await Promise.all(vercelCtx.scheduledPromises);
      expect(vercelBgExecuted).toBe(true);
    });

    it('TC-1.10: Bun 2-arg invocation (req, server) resolves client IP via server.requestIP', async () => {
      const app = createUniversalApp();
      app.get('/client-ip', (ctx) => {
        return ctx.json({ ip: ctx.ip });
      });

      const bunServer = createMockBunServer('203.0.113.195');
      const res = await unwrapResponse(
        app.fetch(createRequest('/client-ip'), bunServer)
      );

      expect(res.status).toBe(200);
      expect(res.json()).toEqual({ ip: '203.0.113.195' });
    });

    it('TC-1.11: Deno 2-arg invocation (req, info) resolves client IP via info.remoteAddr.hostname', async () => {
      const app = createUniversalApp();
      app.get('/deno-ip', (ctx) => {
        return ctx.json({ ip: ctx.ip });
      });

      const denoInfo = createMockDenoInfo('198.51.100.42');
      const res = await unwrapResponse(
        app.fetch(createRequest('/deno-ip'), denoInfo)
      );

      expect(res.status).toBe(200);
      expect(res.json()).toEqual({ ip: '198.51.100.42' });
    });

    it('TC-1.12: Instance-bound fetch property survives destructuring without losing application context', async () => {
      const app = createUniversalApp();
      app.get('/destructured', (ctx) => ctx.json({ success: true }));

      // Destructure fetch directly (standard export default { fetch: app.fetch } pattern)
      const { fetch } = app;
      const res = await unwrapResponse(fetch(createRequest('/destructured')));

      expect(res.status).toBe(200);
      expect(res.json()).toEqual({ success: true });
    });
  });
});
