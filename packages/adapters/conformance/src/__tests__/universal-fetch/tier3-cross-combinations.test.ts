/**
 * E2E Conformance Suite - Tier 3: Cross-Feature Combinations
 *
 * Requirements Tested:
 * - TC-3.1: Multi-prefix mounting combined with universal app.fetch (query, params, body)
 * - TC-3.2: Multi-prefix routes with Cloudflare (req, env, ctx) accessing ctx.env and ctx.waitUntil
 * - TC-3.3: Multi-prefix routes with Bun/Deno resolving ctx.ip across multiple mounted prefixes
 * - TC-3.4: Multi-prefix routes with synchronous response bypass returning bare Response synchronously
 * - TC-3.5: Multi-prefix routes with custom fetch.onError error boundary
 * - TC-3.6: Multi-prefix routes with per-invocation timeout and cancellation
 * - TC-3.7: Multiple distinct routers mounted on distinct and overlapping prefix arrays without cross-talk
 * - TC-3.8: Multi-prefix router with global application middleware pipeline (auth, tracing headers)
 */

import { describe, expect, it } from 'vitest';
import { createApp } from '@nextrush/core';
import { Router } from '@nextrush/router';
import {
  createMockBunServer,
  createMockCloudflareContext,
  createRequest,
  unwrapResponse,
} from './universal-fetch-harness';

describe('Tier 3: Cross-Feature Combinations', () => {
  it('TC-3.1: Multi-prefix mounting combined with universal app.fetch handles query, params, and body', async () => {
    const app = createApp();
    const router = new Router();

    router.post('/posts/:postId/comments', async (ctx) => {
      const postId = ctx.params.postId;
      const format = ctx.query.format ?? 'full';
      // Read body text
      const bodyText = await ctx.bodySource.text();
      return ctx.json({
        postId,
        format,
        receivedBody: bodyText,
        path: ctx.path,
      });
    });

    app.route(['/api', '/v1'], router);

    const prefixes = ['/api', '/v1'];
    for (const prefix of prefixes) {
      const req = createRequest(`${prefix}/posts/post_99/comments?format=summary`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ comment: 'Hello world' }),
      });

      const res = await unwrapResponse(app.fetch(req));
      expect(res.status).toBe(200);
      expect(res.json()).toEqual({
        postId: 'post_99',
        format: 'summary',
        receivedBody: JSON.stringify({ comment: 'Hello world' }),
        path: '/posts/post_99/comments',
      });
    }
  });

  it('TC-3.2: Multi-prefix routes with Cloudflare Workers (req, env, ctx) access ctx.env and schedule ctx.waitUntil', async () => {
    const app = createApp();
    const router = new Router();
    const scheduledAuditLogs: string[] = [];

    router.post('/orders', async (ctx) => {
      const env = ctx.env as { ORDER_QUEUE: { push: (msg: string) => void }; APP_REGION: string };
      const region = env.APP_REGION;

      ctx.waitUntil(
        (async () => {
          scheduledAuditLogs.push(`audit_order_in_${region}`);
        })()
      );

      return ctx.json({ status: 'created', region });
    });

    app.route(['/api', '/v2'], router);

    const { env, ctx } = createMockCloudflareContext({
      APP_REGION: 'us-east-1',
      ORDER_QUEUE: { push: () => {} },
    });

    // Test on /api prefix
    const resApi = await unwrapResponse(
      app.fetch(createRequest('/api/orders', { method: 'POST' }), env, ctx)
    );
    expect(resApi.status).toBe(200);
    expect(resApi.json()).toEqual({ status: 'created', region: 'us-east-1' });

    // Test on /v2 prefix
    const resV2 = await unwrapResponse(
      app.fetch(createRequest('/v2/orders', { method: 'POST' }), env, ctx)
    );
    expect(resV2.status).toBe(200);
    expect(resV2.json()).toEqual({ status: 'created', region: 'us-east-1' });

    expect(ctx.scheduledPromises.length).toBe(2);
    await Promise.all(ctx.scheduledPromises);
    expect(scheduledAuditLogs).toEqual(['audit_order_in_us-east-1', 'audit_order_in_us-east-1']);
  });

  it('TC-3.3: Multi-prefix routes resolve Bun server.requestIP client IP on all mounted prefixes', async () => {
    const app = createApp();
    const router = new Router();

    router.get('/whoami', (ctx) => {
      return ctx.json({ ip: ctx.ip, prefixMatched: ctx.path });
    });

    app.route(['/public', '/gateway'], router);

    const bunServer = createMockBunServer('10.200.50.1');

    for (const prefix of ['/public', '/gateway']) {
      const res = await unwrapResponse(
        app.fetch(createRequest(`${prefix}/whoami`), bunServer)
      );
      expect(res.status).toBe(200);
      expect(res.json()).toEqual({
        ip: '10.200.50.1',
        prefixMatched: '/whoami',
      });
    }
  });

  it('TC-3.4: Multi-prefix routes with synchronous handlers resolve cleanly', async () => {
    const app = createApp();
    const router = new Router();

    router.get('/fast-json', (ctx) => {
      return ctx.json({ speed: 'fast' });
    });

    app.route(['/fast', '/instant'], router);

    // Call on /fast/fast-json
    const resFast = await unwrapResponse(app.fetch(createRequest('/fast/fast-json')));
    expect(resFast.status).toBe(200);
    expect(resFast.json()).toEqual({ speed: 'fast' });

    // Call on /instant/fast-json
    const resInstant = await unwrapResponse(app.fetch(createRequest('/instant/fast-json')));
    expect(resInstant.status).toBe(200);
    expect(resInstant.json()).toEqual({ speed: 'fast' });
  });

  it('TC-3.5: Multi-prefix routes combined with custom fetch.onError error boundary', async () => {
    const app = createApp({
      fetch: {
        onError: (err: Error) => {
          return new Response(JSON.stringify({ custom_boundary: true, message: err.message }), {
            status: 422,
            headers: { 'content-type': 'application/json', 'x-error-boundary': 'custom' },
          });
        },
      },
    });

    const router = new Router();
    router.get('/bad-input', () => {
      throw new Error('Unprocessable entity inside multi-prefix router');
    });

    app.route(['/v1', '/v2'], router);

    for (const prefix of ['/v1', '/v2']) {
      const res = await unwrapResponse(app.fetch(createRequest(`${prefix}/bad-input`)));
      expect(res.status).toBe(422);
      expect(res.headers.get('x-error-boundary')).toBe('custom');
      expect(res.json()).toEqual({
        custom_boundary: true,
        message: 'Unprocessable entity inside multi-prefix router',
      });
    }
  });

  it('TC-3.6: Multi-prefix routes combined with per-invocation timeout and cancellation', async () => {
    const app = createApp({
      fetch: { timeout: 35 },
    });

    const router = new Router();
    let abortedCount = 0;

    router.get('/slow-task', async (ctx) => {
      ctx.signal.addEventListener('abort', () => {
        abortedCount += 1;
      });
      await new Promise((resolve) => setTimeout(resolve, 80));
      ctx.json({ ok: false });
    });

    app.route(['/api', '/v1'], router);

    for (const prefix of ['/api', '/v1']) {
      const res = await unwrapResponse(app.fetch(createRequest(`${prefix}/slow-task`)));
      expect(res.status).toBe(504);
      expect(res.json()).toEqual({ error: 'Gateway Timeout' });
    }

    expect(abortedCount).toBe(2);
  });

  it('TC-3.7: Multiple distinct routers mounted on distinct and overlapping prefix arrays maintain strict routing isolation', async () => {
    const app = createApp();

    const publicRouter = new Router();
    publicRouter.get('/info', (ctx) => ctx.json({ audience: 'public' }));

    const adminRouter = new Router();
    adminRouter.get('/info', (ctx) => ctx.json({ audience: 'admin' }));

    const rootRouter = new Router();
    rootRouter.get('/root-status', (ctx) => ctx.json({ audience: 'root' }));

    // Mount public router on /api and /v1
    app.route(['/api', '/v1'], publicRouter);
    // Mount admin router on /admin and /internal
    app.route(['/admin', '/internal'], adminRouter);
    // Mount root router on / and /app
    app.route(['/', '/app'], rootRouter);

    // Verify public router
    const resApi = await unwrapResponse(app.fetch(createRequest('/api/info')));
    expect(resApi.json()).toEqual({ audience: 'public' });
    const resV1 = await unwrapResponse(app.fetch(createRequest('/v1/info')));
    expect(resV1.json()).toEqual({ audience: 'public' });

    // Verify admin router
    const resAdmin = await unwrapResponse(app.fetch(createRequest('/admin/info')));
    expect(resAdmin.json()).toEqual({ audience: 'admin' });
    const resInternal = await unwrapResponse(app.fetch(createRequest('/internal/info')));
    expect(resInternal.json()).toEqual({ audience: 'admin' });

    // Verify root router
    const resRoot = await unwrapResponse(app.fetch(createRequest('/root-status')));
    expect(resRoot.json()).toEqual({ audience: 'root' });
    const resApp = await unwrapResponse(app.fetch(createRequest('/app/root-status')));
    expect(resApp.json()).toEqual({ audience: 'root' });

    // Verify that nonexistent routes 404 cleanly
    const res404 = await unwrapResponse(app.fetch(createRequest('/api/root-status')));
    expect(res404.status).toBe(404);
  });

  it('TC-3.8: Multi-prefix router with global application middleware pipeline sets tracing headers and enforces auth', async () => {
    const app = createApp();

    // Global tracing and auth middleware
    app.use(async (ctx, next) => {
      ctx.set('x-trace-id', 'trace-global-123');
      const authHeader = ctx.get('authorization');
      if (ctx.path.includes('/secure') && authHeader !== 'Bearer secret-token') {
        ctx.status = 401;
        ctx.json({ error: 'Unauthorized' });
        return;
      }
      await next();
    });

    const securedRouter = new Router();
    securedRouter.get('/secure/data', (ctx) => ctx.json({ data: [1, 2, 3] }));
    securedRouter.get('/public/data', (ctx) => ctx.json({ data: ['open'] }));

    app.route(['/api', '/v1'], securedRouter);

    for (const prefix of ['/api', '/v1']) {
      // 1. Unauthorized request to secured route returns 401 with trace header
      const unauthRes = await unwrapResponse(app.fetch(createRequest(`${prefix}/secure/data`)));
      expect(unauthRes.status).toBe(401);
      expect(unauthRes.headers.get('x-trace-id')).toBe('trace-global-123');
      expect(unauthRes.json()).toEqual({ error: 'Unauthorized' });

      // 2. Authorized request to secured route succeeds
      const authRes = await unwrapResponse(
        app.fetch(
          createRequest(`${prefix}/secure/data`, {
            headers: { authorization: 'Bearer secret-token' },
          })
        )
      );
      expect(authRes.status).toBe(200);
      expect(authRes.headers.get('x-trace-id')).toBe('trace-global-123');
      expect(authRes.json()).toEqual({ data: [1, 2, 3] });

      // 3. Request to public route succeeds without auth
      const pubRes = await unwrapResponse(app.fetch(createRequest(`${prefix}/public/data`)));
      expect(pubRes.status).toBe(200);
      expect(pubRes.headers.get('x-trace-id')).toBe('trace-global-123');
      expect(pubRes.json()).toEqual({ data: ['open'] });
    }
  });
});
