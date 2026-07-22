/**
 * @nextrush/health - Middleware tests
 *
 * Covers the liveness/readiness contract (design.md D5):
 * - /livez never depends on registered checks
 * - /readyz depends on registered checks, 503 on any failure/throw
 * - a hung check produces a bounded-time 503, not an indefinite hang
 * - both sync and async check functions are supported
 *
 * @packageDocumentation
 */

import type { Context, Next } from '@nextrush/types';
import { describe, expect, it, vi } from 'vitest';

import { health } from '../index';

// ============================================================================
// Minimal mock Context
// ============================================================================
//
// health() only reads ctx.path and writes ctx.status/ctx.json — no streaming,
// no headers, no body parsing. A lightweight mock (unlike static's raw
// req/res passthrough mock) is faithful to what the middleware actually uses.

interface MockContext extends Context {
  _json: unknown;
}

function createMockContext(path: string): MockContext {
  let status = 200;
  let jsonBody: unknown;

  return {
    method: 'GET',
    url: path,
    path,
    query: {},
    headers: {},
    ip: '127.0.0.1',
    body: null,
    params: {},
    get status() {
      return status;
    },
    set status(value: number) {
      status = value;
    },
    json(data: unknown) {
      jsonBody = data;
    },
    get _json() {
      return jsonBody;
    },
  } as unknown as MockContext;
}

const noopNext: Next = vi.fn(async () => {});

// ============================================================================
// 2.2 — /livez never depends on registered checks (D5)
// ============================================================================

describe('livez', () => {
  it('returns 200 with no checks registered', async () => {
    const { middleware } = health();
    const ctx = createMockContext('/livez');

    await middleware(ctx, noopNext);

    expect(ctx.status).toBe(200);
    expect(ctx._json).toMatchObject({ status: 'ok' });
  });

  it('remains 200 even when a registered check fails', async () => {
    const { middleware, registerCheck } = health();
    registerCheck('always-fails', () => false);
    const ctx = createMockContext('/livez');

    await middleware(ctx, noopNext);

    expect(ctx.status).toBe(200);
  });

  it('remains 200 even when a registered check throws', async () => {
    const { middleware, registerCheck } = health();
    registerCheck('always-throws', () => {
      throw new Error('boom');
    });
    const ctx = createMockContext('/livez');

    await middleware(ctx, noopNext);

    expect(ctx.status).toBe(200);
  });
});

// ============================================================================
// 2.3 — /readyz depends on registered checks
// ============================================================================

describe('readyz', () => {
  it('returns 200 when all registered checks pass', async () => {
    const { middleware, registerCheck } = health();
    registerCheck('db', () => true);
    registerCheck('cache', () => true);
    const ctx = createMockContext('/readyz');

    await middleware(ctx, noopNext);

    expect(ctx.status).toBe(200);
    expect(ctx._json).toMatchObject({ status: 'ok' });
  });

  it('returns 200 when no checks are registered', async () => {
    const { middleware } = health();
    const ctx = createMockContext('/readyz');

    await middleware(ctx, noopNext);

    expect(ctx.status).toBe(200);
  });

  it('returns 503 when a registered check fails', async () => {
    const { middleware, registerCheck } = health();
    registerCheck('db', () => true);
    registerCheck('cache', () => false);
    const ctx = createMockContext('/readyz');

    await middleware(ctx, noopNext);

    expect(ctx.status).toBe(503);
    expect(ctx._json).toMatchObject({ status: 'error' });
  });

  it('returns 503 when a registered check throws', async () => {
    const { middleware, registerCheck } = health();
    registerCheck('db', () => {
      throw new Error('connection refused');
    });
    const ctx = createMockContext('/readyz');

    await middleware(ctx, noopNext);

    expect(ctx.status).toBe(503);
  });

  it('calls next() and does not respond for unrelated paths', async () => {
    const { middleware } = health();
    const ctx = createMockContext('/api/users');
    const next = vi.fn(async () => {});

    await middleware(ctx, next);

    expect(next).toHaveBeenCalledOnce();
    expect(ctx.status).toBe(200); // untouched default, middleware didn't write a response
  });
});

// ============================================================================
// 2.4 — a hung check must not hang /readyz indefinitely
// ============================================================================

describe('check timeout', () => {
  it('produces a bounded-time 503 when a check never resolves', async () => {
    const { middleware, registerCheck } = health({ checkTimeoutMs: 50 });
    registerCheck('hangs-forever', () => new Promise<boolean>(() => {}));
    const ctx = createMockContext('/readyz');

    const start = Date.now();
    await middleware(ctx, noopNext);
    const elapsed = Date.now() - start;

    expect(ctx.status).toBe(503);
    // Bounded means "close to the configured timeout", not instant and not indefinite.
    expect(elapsed).toBeLessThan(1000);
  });
});

// ============================================================================
// 2.5 — both sync and async check functions are supported
// ============================================================================

describe('sync and async checks', () => {
  it('supports a sync check returning boolean directly', async () => {
    const { middleware, registerCheck } = health();
    registerCheck('sync-ok', () => true);
    const ctx = createMockContext('/readyz');

    await middleware(ctx, noopNext);

    expect(ctx.status).toBe(200);
  });

  it('supports an async check returning Promise<boolean>', async () => {
    const { middleware, registerCheck } = health();
    registerCheck('async-ok', async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return true;
    });
    const ctx = createMockContext('/readyz');

    await middleware(ctx, noopNext);

    expect(ctx.status).toBe(200);
  });

  it('flips 503 when a mix of sync and async checks includes one failure', async () => {
    const { middleware, registerCheck } = health();
    registerCheck('sync-ok', () => true);
    registerCheck('async-fails', async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return false;
    });
    const ctx = createMockContext('/readyz');

    await middleware(ctx, noopNext);

    expect(ctx.status).toBe(503);
  });
});

// ============================================================================
// 10.1 — cancellable readiness checks on timeout (F-08, D7)
// ============================================================================
//
// A timed-out check's in-flight work must be cancellable, not merely
// abandoned: runCheckWithTimeout passes an AbortSignal to the check that is
// aborted the moment the timeout fires. A cooperative check can observe this
// to stop its own work; a signal-ignoring (existing) check keeps behaving
// exactly as before — this is additive, not a breaking change (design.md D7).

describe('check cancellation on timeout', () => {
  it('aborts the signal passed to a cooperative check once checkTimeoutMs elapses', async () => {
    const { middleware, registerCheck } = health({ checkTimeoutMs: 20 });
    let capturedSignal: AbortSignal | undefined;

    registerCheck('cooperative-hangs', (signal) => {
      capturedSignal = signal;
      // Never resolves on its own — only the timeout's abort ends this check.
      return new Promise<boolean>(() => {});
    });

    const ctx = createMockContext('/readyz');
    await middleware(ctx, noopNext);

    // The timed-out check is still reported as a failure (unchanged contract).
    expect(ctx.status).toBe(503);
    expect(capturedSignal).toBeInstanceOf(AbortSignal);
    expect(capturedSignal?.aborted).toBe(true);
  });

  it('gives each check invocation its own fresh signal (no cross-probe leakage)', async () => {
    const { middleware, registerCheck } = health({ checkTimeoutMs: 20 });
    const signals: AbortSignal[] = [];

    registerCheck('probe-a', (signal) => {
      if (signal) signals.push(signal);
      return new Promise<boolean>(() => {});
    });
    registerCheck('probe-b', (signal) => {
      if (signal) signals.push(signal);
      return new Promise<boolean>(() => {});
    });

    const ctx = createMockContext('/readyz');
    await middleware(ctx, noopNext);

    expect(signals).toHaveLength(2);
    expect(signals[0]).not.toBe(signals[1]);
    expect(signals.every((s) => s.aborted)).toBe(true);
  });

  it('still passes/fails correctly for an existing check that ignores the signal argument', async () => {
    const { middleware, registerCheck } = health({ checkTimeoutMs: 50 });
    // Existing-style signalless check — must keep working exactly as before.
    registerCheck('legacy-check', () => true);
    const ctx = createMockContext('/readyz');

    await middleware(ctx, noopNext);

    expect(ctx.status).toBe(200);
  });

  it('does not abort the signal when a cooperative check settles before the timeout', async () => {
    const { middleware, registerCheck } = health({ checkTimeoutMs: 200 });
    let capturedSignal: AbortSignal | undefined;

    registerCheck('fast-ok', (signal) => {
      capturedSignal = signal;
      return true;
    });

    const ctx = createMockContext('/readyz');
    await middleware(ctx, noopNext);

    expect(ctx.status).toBe(200);
    expect(capturedSignal?.aborted).toBe(false);
  });
});
