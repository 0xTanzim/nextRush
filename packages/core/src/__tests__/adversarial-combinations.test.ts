/**
 * @nextrush/core - Adversarial Combination & Interaction Matrix (Scenarios A through L)
 *
 * Implements the 12 failure-prone interaction combinations mandated by the
 * Adversarial Correctness specification. Exercises multi-layered interactions
 * between asynchronous suspension, error handling, short-circuiting, cancellation,
 * context restoration, and concurrent request isolation.
 */

import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../application';
import { compose } from '../middleware';
import { RESOLVED_PROMISE, type Context, type Middleware } from '@nextrush/types';
import { createMockContext } from './_shared/create-mock-context';

function markResponded(ctx: Context): void {
  (ctx as { responded: boolean }).responded = true;
}

function nextAwareContext(overrides: Partial<Context> = {}): Context {
  let stored: () => Promise<void> = () => Promise.resolve();
  const headers: Record<string, string> = {};
  const ctx = createMockContext({
    setNext: (fn: () => Promise<void>) => {
      stored = fn;
    },
    next: () => stored(),
    set: (k: string, v: string) => {
      headers[k.toLowerCase()] = v;
    },
    get: (k: string) => headers[k.toLowerCase()],
    json: vi.fn((data: unknown) => {
      markResponded(ctx);
      (ctx as Context & { responseBody?: unknown }).responseBody = data;
    }),
    headers,
    ...overrides,
  });
  return ctx;
}

describe('Adversarial Interaction Matrix — Scenarios A through L', () => {
  // Scenario A
  it('Combination A: Outer awaits inner; inner rejects; error handler commits response', async () => {
    const app = createApp({ env: 'test' });
    let outerCaught = false;

    app.use(async (_ctx, next) => {
      try {
        await next();
      } catch (err: unknown) {
        outerCaught = true;
        throw err;
      }
    });

    app.use(async () => {
      await new Promise((r) => setTimeout(r, 5));
      throw new Error('inner-failure');
    });

    app.setErrorHandler((err, ctx) => {
      ctx.status = 500;
      ctx.json({ error: (err as Error).message });
      markResponded(ctx);
    });

    await app.ready();
    const handle = app.callback();
    const ctx = nextAwareContext();

    await handle(ctx);

    expect(outerCaught).toBe(true);
    expect(ctx.status).toBe(500);
    expect(ctx.responded).toBe(true);
    expect(ctx.json).toHaveBeenCalledWith({ error: 'inner-failure' });
  });

  // Scenario B
  it('Combination B: Middleware short-circuits after modifying headers; downstream skipped', async () => {
    const app = createApp({ env: 'test' });
    let downstreamExecuted = false;

    app.use((ctx) => {
      ctx.set('x-auth-status', 'denied');
      ctx.status = 401;
      markResponded(ctx);
      // Short-circuit: no next()
    });

    app.use(() => {
      downstreamExecuted = true;
    });

    await app.ready();
    const handle = app.callback();
    const ctx = nextAwareContext();

    await handle(ctx);

    expect(ctx.get('x-auth-status')).toBe('denied');
    expect(ctx.status).toBe(401);
    expect(downstreamExecuted).toBe(false);
  });

  // Scenario C
  it('Combination C: Unawaited downstream rejects; error caught/logged, no socket hang', async () => {
    const app = createApp({ env: 'test' });
    let unhandledOccurred = false;

    app.use((_ctx, next) => {
      // Intentionally not awaiting next()
      void next().catch(() => {
        unhandledOccurred = true;
      });
      return RESOLVED_PROMISE;
    });

    app.use(async () => {
      await new Promise((r) => setTimeout(r, 10));
      throw new Error('unawaited background error');
    });

    await app.ready();
    const handle = app.callback();
    const ctx = nextAwareContext();

    const res = handle(ctx);
    // Callback resolves synchronously
    expect(res).toBe(RESOLVED_PROMISE);

    // Wait for the background task to settle
    await new Promise((r) => setTimeout(r, 25));
    expect(unhandledOccurred).toBe(true);
  });

  // Scenario D
  it('Combination D: Nested dispatch modifies context state; inner throws; outer restores state', async () => {
    const innerStack: Middleware[] = [
      (ctx) => {
        ctx.state.tenant = 'nested-tenant';
        throw new Error('nested failure');
      },
    ];
    const innerCompose = compose(innerStack);

    const outerFn = compose([
      async (ctx, next) => {
        ctx.state.tenant = 'root-tenant';
        try {
          await next();
        } catch {
          // outer handles inner exception and restores tenant
          ctx.state.tenant = 'restored-root-tenant';
        }
      },
      async (ctx) => {
        await innerCompose(ctx);
      },
    ]);

    const ctx = nextAwareContext();
    await outerFn(ctx);

    expect(ctx.state.tenant).toBe('restored-root-tenant');
  });

  // Scenario E
  it('Combination E: 3-layer stack combining sync execution, async suspension, short-circuit, and error', async () => {
    const events: string[] = [];

    const fn = compose([
      // Layer 1: Synchronous entry, awaits downstream
      async (_ctx, next) => {
        events.push('l1-start');
        try {
          await next();
        } catch (err: unknown) {
          events.push(`l1-catch:${(err as Error).message}`);
        }
        events.push('l1-end');
      },
      // Layer 2: Asynchronous suspension, branches based on query
      async (ctx, next) => {
        events.push('l2-start');
        await new Promise((r) => setTimeout(r, 5));
        if (ctx.query.shortCircuit === 'true') {
          events.push('l2-short');
          return;
        }
        await next();
        events.push('l2-end');
      },
      // Layer 3: Throws downstream error
      () => {
        events.push('l3-throw');
        throw new Error('l3-explosion');
      },
    ]);

    // Sub-case 1: Path with error
    const ctx1 = nextAwareContext({ query: { shortCircuit: 'false' } });
    await fn(ctx1);
    expect(events).toEqual(['l1-start', 'l2-start', 'l3-throw', 'l1-catch:l3-explosion', 'l1-end']);

    // Sub-case 2: Path with short-circuit
    events.length = 0;
    const ctx2 = nextAwareContext({ query: { shortCircuit: 'true' } });
    await fn(ctx2);
    expect(events).toEqual(['l1-start', 'l2-start', 'l2-short', 'l1-end']);
  });

  // Scenario F
  it('Combination F: Response completion races with late async work; no double write', async () => {
    const app = createApp({ env: 'test' });
    let lateWriteAttempted = false;

    app.use(async (ctx, next) => {
      // Start late async work
      setTimeout(() => {
        if (!ctx.responded) {
          ctx.json({ late: true });
        } else {
          lateWriteAttempted = true;
        }
      }, 10);

      // Early response
      ctx.status = 200;
      ctx.json({ immediate: true });
      markResponded(ctx);
      await next();
    });

    app.use(() => undefined);

    await app.ready();
    const handle = app.callback();
    const ctx = nextAwareContext();

    await handle(ctx);
    expect(ctx.responded).toBe(true);

    await new Promise((r) => setTimeout(r, 25));
    expect(lateWriteAttempted).toBe(true);
    expect(ctx.json).toHaveBeenCalledTimes(1);
  });

  // Scenario G
  it('Combination G: One request fails while concurrent request succeeds; context isolation', async () => {
    const app = createApp({ env: 'test' });

    app.use(async (ctx) => {
      if (ctx.url === '/fail') {
        throw new Error('request-failure');
      }
      await new Promise((r) => setTimeout(r, 10));
      ctx.status = 200;
      ctx.json({ id: ctx.state.id });
      markResponded(ctx);
    });

    await app.ready();
    const handle = app.callback();

    const ctxFail = nextAwareContext({ url: '/fail', state: { id: 'FAIL-1' } });
    const ctxOk = nextAwareContext({ url: '/ok', state: { id: 'OK-2' } });

    await Promise.all([
      handle(ctxFail),
      handle(ctxOk),
    ]);

    // Failing request settled with 500 error
    expect(ctxFail.status).toBe(500);
    // Successful request maintained isolated state and answered 200
    expect(ctxOk.status).toBe(200);
    expect(ctxOk.json).toHaveBeenCalledWith({ id: 'OK-2' });
  });

  // Scenario H
  it('Combination H: Route miss triggers not-found handling through middleware and encounters error', async () => {
    const app = createApp({ env: 'test' });

    app.use(async (ctx, next) => {
      await next();
      if (!ctx.responded) {
        // Not found intercepted
        ctx.status = 404;
        throw new Error('404 post-processing failure');
      }
    });

    await app.ready();
    const handle = app.callback();
    const ctx = nextAwareContext({ url: '/unmatched-route' });

    await handle(ctx);

    // The post-processing error was caught and committed via handleError
    expect(ctx.status).toBe(500);
    expect(ctx.responded).toBe(true);
  });

  // Scenario I
  it('Combination I: Request-body parsing error after middleware modified context', async () => {
    const app = createApp({ env: 'test' });

    app.use(async (ctx, next) => {
      ctx.set('x-trace-id', 'trace-12345');
      ctx.state.user = 'authenticated-admin';
      await next();
    });

    app.use(() => {
      // Simulate body parser syntax error
      const syntaxError = new SyntaxError('Unexpected token in JSON at position 4');
      (syntaxError as Error & { status: number }).status = 400;
      throw syntaxError;
    });

    await app.ready();
    const handle = app.callback();
    const ctx = nextAwareContext();

    await handle(ctx);

    // Context modifications prior to failure are preserved
    expect(ctx.get('x-trace-id')).toBe('trace-12345');
    expect(ctx.state.user).toBe('authenticated-admin');
    // Error handler committed appropriate response
    expect(ctx.status).toBe(400);
    expect(ctx.responded).toBe(true);
  });

  // Scenario J
  it('Combination J: Client abort signal triggers while middleware is awaiting downstream', async () => {
    const app = createApp({ env: 'test' });
    const controller = new AbortController();
    let abortedDuringAwait = false;

    app.use(async (ctx, next) => {
      ctx.signal.addEventListener('abort', () => {
        abortedDuringAwait = true;
      });
      await next();
    });

    app.use(async (ctx) => {
      // Simulate client aborting during long downstream execution
      controller.abort();
      if (ctx.signal.aborted) {
        ctx.status = 499; // Client Closed Request
        markResponded(ctx);
      }
    });

    await app.ready();
    const handle = app.callback();
    const ctx = nextAwareContext({ signal: controller.signal });

    await handle(ctx);

    expect(abortedDuringAwait).toBe(true);
    expect(ctx.status).toBe(499);
  });

  // Scenario K
  it('Combination K: Custom error handler itself throws; default error handler recovers and answers', async () => {
    const app = createApp({ env: 'test' });

    app.use(() => {
      throw new Error('primary request error');
    });

    app.setErrorHandler(() => {
      throw new Error('catastrophic error inside custom onError');
    });

    await app.ready();
    const handle = app.callback();
    const ctx = nextAwareContext();

    // Must NOT throw unhandled out of callback()
    await expect(handle(ctx)).resolves.not.toThrow();

    // Default error handler catches and commits 500
    expect(ctx.status).toBe(500);
    expect(ctx.responded).toBe(true);
  });

  // Scenario L
  it('Combination L: Repeated application invocations after earlier rejection leave no stale state', async () => {
    const app = createApp({ env: 'test' });

    app.use(async (ctx) => {
      if (ctx.query.action === 'throw') {
        throw new Error('intentional failure');
      }
      ctx.status = 200;
      ctx.json({ result: 'clean' });
      markResponded(ctx);
    });

    await app.ready();
    const handle = app.callback();

    // 1. Invocation that throws
    const ctx1 = nextAwareContext({ query: { action: 'throw' } });
    await handle(ctx1);
    expect(ctx1.status).toBe(500);

    // 2. Immediate subsequent invocation must succeed cleanly
    const ctx2 = nextAwareContext({ query: { action: 'ok' } });
    await handle(ctx2);
    expect(ctx2.status).toBe(200);
    expect(ctx2.json).toHaveBeenCalledWith({ result: 'clean' });

    // 3. Third invocation must also succeed cleanly
    const ctx3 = nextAwareContext({ query: { action: 'ok' } });
    await handle(ctx3);
    expect(ctx3.status).toBe(200);
  });
});
