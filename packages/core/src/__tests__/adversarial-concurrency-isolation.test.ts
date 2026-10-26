/**
 * @nextrush/core - Adversarial Concurrency & Request Isolation Suite
 *
 * Exercises a shared Application instance under heavy bounded parallel load (100+ concurrent
 * requests) mixing successes, 404 misses, synchronous throws, and asynchronous rejections.
 *
 * Verifies that request-local state, URL parameters, error conditions, headers, and
 * continuation state (ctx.setNext) never leak or cross-contaminate between requests.
 */

import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../application';
import type { Context } from '@nextrush/types';
import { createMockContext } from './_shared/create-mock-context';

function createConcurrentContext(id: string, path: string): Context {
  let stored: () => Promise<void> = () => Promise.resolve();
  const headers: Record<string, string> = { 'x-request-id': id };
  const ctx = createMockContext({
    url: path,
    path,
    headers,
    state: { requestId: id, traces: [] as string[] },
    setNext: (fn: () => Promise<void>) => {
      stored = fn;
    },
    next: () => stored(),
    json: vi.fn((data: unknown) => {
      (ctx as { responded: boolean }).responded = true;
      (ctx as Context & { responseBody?: unknown }).responseBody = data;
    }),
    send: vi.fn((data: unknown) => {
      (ctx as { responded: boolean }).responded = true;
      (ctx as Context & { responseBody?: unknown }).responseBody = data;
    }),
    set: vi.fn((k: string, v: string) => {
      headers[k.toLowerCase()] = v;
    }),
    get: (k: string) => headers[k.toLowerCase()],
  });
  return ctx;
}

describe('Adversarial Concurrency & Request Isolation Suite', () => {
  it('100 concurrent heterogeneous requests execute with strict state isolation and zero cross-contamination', async () => {
    const app = createApp({ env: 'test' });

    // Application-level shared counter to verify shared state is intentional
    let totalRequestsHandled = 0;

    // Middleware 1: Request tracing and ID validation
    app.use(async (ctx, next) => {
      totalRequestsHandled++;
      const reqId = ctx.headers['x-request-id'];
      (ctx.state.traces as string[]).push(`enter:${reqId}`);
      await next();
      (ctx.state.traces as string[]).push(`exit:${reqId}`);
    });

    // Middleware 2: Path-based routing and failure injection
    app.use(async (ctx, next) => {
      const path = ctx.path;
      const reqId = ctx.headers['x-request-id'];

      if (path.startsWith('/success/')) {
        // Asynchronous delay to interleave execution with failing requests
        await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 10) + 1));
        ctx.status = 200;
        ctx.json({ id: reqId, status: 'ok' });
        return;
      }

      if (path.startsWith('/sync-throw/')) {
        throw new Error(`sync-boom-${reqId}`);
      }

      if (path.startsWith('/async-reject/')) {
        await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 10) + 1));
        throw new Error(`async-boom-${reqId}`);
      }

      // Default: Fall through to 404 not found
      await next();
      if (!ctx.responded) {
        ctx.status = 404;
        ctx.json({ id: reqId, status: 'not_found' });
      }
    });

    await app.ready();
    const handle = app.callback();

    // Prepare 100 concurrent requests:
    // 25 success, 25 sync-throw, 25 async-reject, 25 not-found
    const requests: { id: string; type: string; ctx: Context }[] = [];

    for (let i = 0; i < 25; i++) {
      const id = `REQ-SUCC-${i}`;
      requests.push({ id, type: 'success', ctx: createConcurrentContext(id, `/success/${i}`) });
    }
    for (let i = 0; i < 25; i++) {
      const id = `REQ-STHR-${i}`;
      requests.push({ id, type: 'sync-throw', ctx: createConcurrentContext(id, `/sync-throw/${i}`) });
    }
    for (let i = 0; i < 25; i++) {
      const id = `REQ-AREJ-${i}`;
      requests.push({ id, type: 'async-reject', ctx: createConcurrentContext(id, `/async-reject/${i}`) });
    }
    for (let i = 0; i < 25; i++) {
      const id = `REQ-MISS-${i}`;
      requests.push({ id, type: 'not-found', ctx: createConcurrentContext(id, `/miss/${i}`) });
    }

    // Shuffle requests to maximize concurrency interleaving
    for (let i = requests.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = requests[i]!;
      requests[i] = requests[j]!;
      requests[j] = temp;
    }

    // Execute all 100 requests simultaneously via Promise.all
    await Promise.all(requests.map((r) => handle(r.ctx)));

    // Invariant Verification:
    expect(totalRequestsHandled).toBe(100);

    for (const req of requests) {
      const { id, type, ctx } = req;
      const traces = ctx.state.traces as string[];

      // 1. Strict Request Isolation: traces must contain ONLY this request's ID
      expect(traces[0]).toBe(`enter:${id}`);

      if (type === 'success') {
        expect(ctx.status).toBe(200);
        expect(ctx.responded).toBe(true);
        expect(ctx.json).toHaveBeenCalledWith({ id, status: 'ok' });
        expect(traces[1]).toBe(`exit:${id}`);
      } else if (type === 'sync-throw' || type === 'async-reject') {
        expect(ctx.status).toBe(500);
        expect(ctx.responded).toBe(true);
        // Error response handled by app.handleError; 5xx masked for security
        expect(ctx.json).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 500,
            message: 'Internal Server Error',
            code: 'INTERNAL_ERROR',
          })
        );
      } else if (type === 'not-found') {
        expect(ctx.status).toBe(404);
        expect(ctx.responded).toBe(true);
        expect(ctx.json).toHaveBeenCalledWith({ id, status: 'not_found' });
        expect(traces[1]).toBe(`exit:${id}`);
      }

      // Assert no cross-request foreign keys in context state
      expect(ctx.state.requestId).toBe(id);
      expect(ctx.headers['x-request-id']).toBe(id);
    }
  });

  it('preserves request isolation when one request stalls on a barrier while others complete', async () => {
    const app = createApp({ env: 'test' });

    let releaseStalled: (() => void) | undefined;
    const stalledPromise = new Promise<void>((resolve) => {
      releaseStalled = resolve;
    });

    app.use(async (ctx) => {
      if (ctx.url === '/stalled') {
        await stalledPromise;
        ctx.status = 200;
        ctx.json({ outcome: 'stalled-released' });
        return;
      }
      ctx.status = 200;
      ctx.json({ outcome: `fast-${ctx.state.seq}` });
    });

    await app.ready();
    const handle = app.callback();

    const ctxStalled = createConcurrentContext('STALLED-1', '/stalled');
    const stalledExecution = handle(ctxStalled);

    // Run 10 fast requests while stalled request is suspended
    for (let i = 0; i < 10; i++) {
      const fastCtx = createConcurrentContext(`FAST-${i}`, `/fast/${i}`);
      fastCtx.state.seq = i;
      await handle(fastCtx);
      expect(fastCtx.status).toBe(200);
      expect(fastCtx.json).toHaveBeenCalledWith({ outcome: `fast-${i}` });
    }

    // Verify stalled request has not resolved or leaked into fast requests
    expect(ctxStalled.responded).toBe(false);

    // Release the barrier
    releaseStalled?.();
    await stalledExecution;

    expect(ctxStalled.status).toBe(200);
    expect(ctxStalled.json).toHaveBeenCalledWith({ outcome: 'stalled-released' });
  });

  it('maintains independent ctx.setNext pointers across concurrent nested dispatches', async () => {
    const app = createApp({ env: 'test' });

    app.use(async (_ctx, next) => {
      // Each request calls next() concurrently
      await next();
    });

    app.use(async (ctx) => {
      // Verify that calling ctx.next() from the innermost handler fails with MULTIPLE_NEXT
      // or settles cleanly without invoking other requests' next pointers
      await ctx.next();
      ctx.status = 200;
    });

    await app.ready();
    const handle = app.callback();

    const c1 = createConcurrentContext('C1', '/');
    const c2 = createConcurrentContext('C2', '/');

    await Promise.all([handle(c1), handle(c2)]);

    expect(c1.status).toBe(200);
    expect(c2.status).toBe(200);
  });
});
