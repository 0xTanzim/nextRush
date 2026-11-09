/**
 * @nextrush/adapter-conformance - Adversarial Cross-Adapter Conformance Suite
 *
 * Runs adversarial middleware, routing, error-handling, and lifecycle scenarios
 * across every built-in adapter driver (Node, Bun, Deno, Edge, Serverless, Next.js).
 *
 * Operationalizes the project-wide mandate: "every adapter must behave identically".
 */

import { describe, expect, it } from 'vitest';
import { drivers } from '../drivers';
import type { ConformanceDriver } from '../drivers/types';

describe.each(drivers)('adversarial cross-adapter conformance [$name]', (driver: ConformanceDriver) => {
  it('1. executes 3-middleware onion pipeline preserving FIFO entry and LIFO exit', async () => {
    const traces: string[] = [];

    const res = await driver.dispatch(
      (app) => {
        app.use(async (ctx, next) => {
          traces.push('m1-in');
          await next();
          traces.push('m1-out');
          ctx.set('x-pipeline', 'verified');
        });

        app.use(async (_ctx, next) => {
          traces.push('m2-in');
          await next();
          traces.push('m2-out');
        });

        app.use((ctx) => {
          traces.push('m3-handler');
          ctx.status = 200;
          ctx.json({ outcome: 'complete' });
        });
      },
      { method: 'GET', path: '/test-pipeline' }
    );

    expect(res.status).toBe(200);
    expect(res.header('x-pipeline')).toBe('verified');
    expect(traces).toEqual(['m1-in', 'm2-in', 'm3-handler', 'm2-out', 'm1-out']);
    expect(JSON.parse(res.text())).toEqual({ outcome: 'complete' });
  });

  it('2. short-circuits early when middleware halts without next(), skipping downstream', async () => {
    let downstreamCalled = false;

    const res = await driver.dispatch(
      (app) => {
        app.use((ctx) => {
          ctx.status = 403;
          ctx.set('x-guard', 'blocked');
          ctx.json({ error: 'forbidden' });
          // Short-circuit: no next()
        });

        app.use(() => {
          downstreamCalled = true;
        });
      },
      { method: 'GET', path: '/guarded' }
    );

    expect(res.status).toBe(403);
    expect(res.header('x-guard')).toBe('blocked');
    expect(downstreamCalled).toBe(false);
    expect(JSON.parse(res.text())).toEqual({ error: 'forbidden' });
  });

  it('3. catches synchronous exceptions in middleware and answers 500 without hanging', async () => {
    const res = await driver.dispatch(
      (app) => {
        app.use(() => {
          throw new Error('sync crash in adapter test');
        });
      },
      { method: 'GET', path: '/crash' }
    );

    expect(res.status).toBe(500);
    const body = JSON.parse(res.text());
    expect(body.status).toBe(500);
    expect(body.message).toBe('Internal Server Error');
  });

  it('4. catches asynchronous rejections and commits 500 response', async () => {
    const res = await driver.dispatch(
      (app) => {
        app.use(async () => {
          await new Promise((r) => setTimeout(r, 5));
          throw new Error('async rejection in adapter test');
        });
      },
      { method: 'GET', path: '/async-crash' }
    );

    expect(res.status).toBe(500);
    const body = JSON.parse(res.text());
    expect(body.status).toBe(500);
    expect(body.message).toBe('Internal Server Error');
  });

  it('5. returns 404 with normalized response on unmatched route miss', async () => {
    const res = await driver.dispatch(
      (app) => {
        app.get('/known-endpoint', (ctx) => {
          ctx.status = 200;
        });
      },
      { beforeBoot: true, method: 'GET', path: '/completely-unregistered-path' }
    );

    expect(res.status).toBe(404);
  });

  it('6. repeated dispatches through the same driver instance maintain isolated state', async () => {
    let callCount = 0;

    const setup = (app: import('@nextrush/core').Application) => {
      app.use((ctx) => {
        callCount++;
        ctx.status = 200;
        ctx.json({ call: callCount, trace: ctx.headers['x-trace-id'] });
      });
    };

    const res1 = await driver.dispatch(setup, {
      method: 'GET',
      path: '/run1',
      headers: { 'x-trace-id': 'TRACE-111' },
    });

    const res2 = await driver.dispatch(setup, {
      method: 'GET',
      path: '/run2',
      headers: { 'x-trace-id': 'TRACE-222' },
    });

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(JSON.parse(res1.text())).toEqual({ call: 1, trace: 'TRACE-111' });
    expect(JSON.parse(res2.text())).toEqual({ call: 2, trace: 'TRACE-222' });
  });
});
