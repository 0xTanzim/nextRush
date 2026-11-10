/**
 * E2E Conformance Suite - Tier 4: Real-World Application Scenarios
 *
 * Requirements Tested:
 * - TC-4.1: Production API Gateway with Multi-Version Routing (/api, /v1, /v2, /internal)
 * - TC-4.2: Cloudflare Workers Microservice Export Pattern (export default app;)
 * - TC-4.3: Bun High-Performance Edge Service Export Pattern (export default app;)
 * - TC-4.4: Vercel Edge Serverless Function Export Pattern (export default app;)
 * - TC-4.5: Multi-Tenant SaaS Routing Ingress across multiple aliases (/app, /tenant, /workspace)
 */

import { describe, expect, it } from 'vitest';
import { createApp } from '@nextrush/core';
import { Router } from '@nextrush/router';
import {
  createMockBunServer,
  createMockCloudflareContext,
  createMockVercelContext,
  createRequest,
  createUniversalApp,
  unwrapResponse,
} from './universal-fetch-harness';

describe('Tier 4: Real-World Application Scenarios', () => {
  it('TC-4.1: Production API Gateway with Multi-Version Routing (/api, /v1, /v2, /internal)', async () => {
    const app = createApp();

    // 1. Shared V1 Router (legacy & default API) mounted at ['/api', '/v1']
    const v1Router = new Router();
    v1Router.get('/users/:id', (ctx) => {
      return ctx.json({
        version: 'v1',
        id: ctx.params.id,
        name: 'Legacy User Format',
        deprecated: true,
      });
    });

    // 2. V2 Router (modern API) mounted at ['/v2']
    const v2Router = new Router();
    v2Router.get('/users/:id', (ctx) => {
      return ctx.json({
        version: 'v2',
        id: ctx.params.id,
        user: { firstName: 'Modern', lastName: 'User' },
        deprecated: false,
      });
    });

    // 3. Internal Ops Router mounted at ['/internal', '/_ops'] with API token guard
    const opsRouter = new Router();
    opsRouter.use(async (ctx, next) => {
      const token = ctx.get('x-internal-token');
      if (token !== 'ops-secret-key-999') {
        ctx.status = 403;
        ctx.json({ error: 'Forbidden: Internal Ops only' });
        return;
      }
      await next();
    });
    opsRouter.get('/stats', (ctx) => {
      return ctx.json({ activeWorkers: 12, memoryUsageMb: 85 });
    });

    app.route(['/api', '/v1'], v1Router);
    app.route('/v2', v2Router);
    app.route(['/internal', '/_ops'], opsRouter);

    // Verify v1 routes on both /api and /v1
    const resApi = await unwrapResponse(app.fetch(createRequest('/api/users/u-42')));
    expect(resApi.json()).toEqual({
      version: 'v1',
      id: 'u-42',
      name: 'Legacy User Format',
      deprecated: true,
    });

    const resV1 = await unwrapResponse(app.fetch(createRequest('/v1/users/u-42')));
    expect(resV1.json()).toEqual({
      version: 'v1',
      id: 'u-42',
      name: 'Legacy User Format',
      deprecated: true,
    });

    // Verify v2 route on /v2
    const resV2 = await unwrapResponse(app.fetch(createRequest('/v2/users/u-42')));
    expect(resV2.json()).toEqual({
      version: 'v2',
      id: 'u-42',
      user: { firstName: 'Modern', lastName: 'User' },
      deprecated: false,
    });

    // Verify internal ops unauthorized
    const resForbidden = await unwrapResponse(app.fetch(createRequest('/internal/stats')));
    expect(resForbidden.status).toBe(403);
    expect(resForbidden.json()).toEqual({ error: 'Forbidden: Internal Ops only' });

    // Verify internal ops authorized on both prefixes
    for (const prefix of ['/internal', '/_ops']) {
      const resAllowed = await unwrapResponse(
        app.fetch(
          createRequest(`${prefix}/stats`, {
            headers: { 'x-internal-token': 'ops-secret-key-999' },
          })
        )
      );
      expect(resAllowed.status).toBe(200);
      expect(resAllowed.json()).toEqual({ activeWorkers: 12, memoryUsageMb: 85 });
    }
  });

  it('TC-4.2: Cloudflare Workers Microservice Export Pattern (export default app;)', async () => {
    // Standard NextRush Cloudflare Worker app definition
    const app = createUniversalApp({
      proxy: 1, // Trust Cloudflare edge proxy
    });

    // Mock KV storage
    const kvStore = new Map<string, string>();
    kvStore.set('session:tok_123', JSON.stringify({ userId: 'usr_abc', role: 'admin' }));

    const metricsFlushed: string[] = [];

    app.get('/auth/session', async (ctx) => {
      const env = ctx.env as { KV: { get: (k: string) => Promise<string | null> } };
      const authHeader = ctx.get('authorization') ?? '';
      const token = authHeader.replace('Bearer ', '');

      const sessionJson = await env.KV.get(`session:${token}`);
      if (!sessionJson) {
        ctx.status = 401;
        ctx.json({ error: 'Invalid session' });
        return;
      }

      // Schedule asynchronous metrics emission
      ctx.waitUntil(
        (async () => {
          metricsFlushed.push(`session_validated_for_${token}_from_${ctx.ip}`);
        })()
      );

      ctx.json({ session: JSON.parse(sessionJson), clientIp: ctx.ip });
    });

    // Simulate Cloudflare Workers runtime invocation: export default app;
    const workerModule = { default: app };

    const { env, ctx } = createMockCloudflareContext({
      KV: {
        get: async (key: string) => kvStore.get(key) ?? null,
      },
    });

    // Request from Cloudflare edge with cf-connecting-ip
    const req = createRequest('/auth/session', {
      headers: {
        authorization: 'Bearer tok_123',
        'cf-connecting-ip': '203.0.113.195',
      },
    });

    const res = await unwrapResponse(workerModule.default.fetch(req, env, ctx));
    expect(res.status).toBe(200);
    expect(res.json()).toEqual({
      session: { userId: 'usr_abc', role: 'admin' },
      clientIp: '203.0.113.195',
    });

    // Verify background telemetry flushed via ctx.waitUntil
    await Promise.all(ctx.scheduledPromises);
    expect(metricsFlushed).toEqual([
      'session_validated_for_tok_123_from_203.0.113.195',
    ]);
  });

  it('TC-4.3: Bun High-Performance Edge Service Export Pattern (export default app;)', async () => {
    const app = createUniversalApp();

    // High throughput synchronous route
    app.get('/api/lookup/:code', (ctx) => {
      const code = ctx.params.code;
      return ctx.json({
        code,
        active: true,
        ip: ctx.ip,
      });
    });

    // Emulate export default app; in Bun server
    const bunApp = { default: app };
    const bunServer = createMockBunServer('172.16.0.45');

    // Single synchronous fetch call
    const req = createRequest('/api/lookup/ABC-999');
    const syncRes = bunApp.default.fetch(req, bunServer);

    // Fast-path assertion: must be synchronous Response instance
    expect(syncRes).toBeInstanceOf(Response);

    const unwrapped = await unwrapResponse(syncRes);
    expect(unwrapped.status).toBe(200);
    expect(unwrapped.json()).toEqual({
      code: 'ABC-999',
      active: true,
      ip: '172.16.0.45',
    });
  });

  it('TC-4.4: Vercel Edge Serverless Function Export Pattern (export default app;)', async () => {
    const app = createUniversalApp();
    const cacheRevalidations: string[] = [];

    app.get('/edge/products/:id', (ctx) => {
      const productId = ctx.params.id;
      const country = ctx.get('x-vercel-ip-country') ?? 'US';

      // Revalidate cache in background via ctx.waitUntil
      ctx.waitUntil(
        (async () => {
          cacheRevalidations.push(`revalidated_product_${productId}_country_${country}`);
        })()
      );

      ctx.set('cache-control', 's-maxage=60, stale-while-revalidate=300');
      ctx.json({
        productId,
        country,
        priceFormatted: country === 'GB' ? '£49.99' : '$49.99',
      });
    });

    // Emulate export default app; on Vercel Edge (req, ctx)
    const vercelHandler = app.fetch;
    const vercelCtx = createMockVercelContext();

    const req = createRequest('/edge/products/prod_laptop', {
      headers: {
        'x-vercel-ip-country': 'GB',
      },
    });

    const res = await unwrapResponse(vercelHandler(req, vercelCtx));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('s-maxage=60, stale-while-revalidate=300');
    expect(res.json()).toEqual({
      productId: 'prod_laptop',
      country: 'GB',
      priceFormatted: '£49.99',
    });

    expect(vercelCtx.scheduledPromises.length).toBe(1);
    await Promise.all(vercelCtx.scheduledPromises);
    expect(cacheRevalidations).toEqual([
      'revalidated_product_prod_laptop_country_GB',
    ]);
  });

  it('TC-4.5: Multi-Tenant SaaS Routing Ingress across multiple aliases (/app, /tenant, /workspace)', async () => {
    const app = createApp();
    const tenantRouter = new Router();

    // Tenant scoped routes
    tenantRouter.get('/:tenantId/dashboard', (ctx) => {
      const tenantId = ctx.params.tenantId;
      return ctx.json({
        tenantId,
        ingressPath: ctx.path,
        features: ['analytics', 'billing'],
      });
    });

    tenantRouter.post('/:tenantId/settings', async (ctx) => {
      const tenantId = ctx.params.tenantId;
      const body = await ctx.bodySource.text();
      return ctx.json({
        tenantId,
        updated: true,
        payload: JSON.parse(body),
      });
    });

    // Mount tenant router across 3 ingress alias paths
    app.route(['/app', '/tenant', '/workspace'], tenantRouter);

    const aliases = ['/app', '/tenant', '/workspace'];
    for (const alias of aliases) {
      // 1. GET dashboard
      const getRes = await unwrapResponse(
        app.fetch(createRequest(`${alias}/acme_corp/dashboard`))
      );
      expect(getRes.status).toBe(200);
      expect(getRes.json()).toEqual({
        tenantId: 'acme_corp',
        ingressPath: '/acme_corp/dashboard',
        features: ['analytics', 'billing'],
      });

      // 2. POST settings
      const postRes = await unwrapResponse(
        app.fetch(
          createRequest(`${alias}/acme_corp/settings`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ theme: 'dark' }),
          })
        )
      );
      expect(postRes.status).toBe(200);
      expect(postRes.json()).toEqual({
        tenantId: 'acme_corp',
        updated: true,
        payload: { theme: 'dark' },
      });
    }
  });
});
