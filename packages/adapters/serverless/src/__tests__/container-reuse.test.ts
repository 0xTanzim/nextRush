/**
 * Container-reuse conformance (spec: serverless-adapter + runtime-proof-harness,
 * task group 7). A warm serverless instance reuses one booted app across
 * invocations, so two guarantees must hold:
 *
 *  1. `app.ready()` boots exactly once, even under concurrent warm invocations
 *     (the edge engine memoizes the boot barrier via `bootPromise ??= ...`,
 *     which the serverless adapter reuses).
 *  2. No request state leaks between invocations on the same warm instance —
 *     each invocation builds a fresh `Context`.
 *
 * These assert the observable behavior (boot side-effect count; per-request
 * state isolation), not the memoization mechanism itself.
 */

import { describe, expect, it } from 'vitest';
import { createApp } from '@nextrush/core';
import { createLambdaHandler, type LambdaEvent } from '../index';

function v2Get(path: string): LambdaEvent {
  return {
    version: '2.0',
    rawPath: path,
    requestContext: { http: { method: 'GET' } },
  };
}

describe('container reuse (warm-instance)', () => {
  it('7.1 boots the app exactly once across concurrent warm invocations', async () => {
    const boot = { count: 0 };
    const app = createApp();
    // An extension's setup() runs once, during ready() — the boot barrier.
    app.extend({
      name: 'boot-counter',
      setup() {
        boot.count += 1;
      },
    });
    app.use((ctx) => ctx.json({ ok: true }));

    const handler = createLambdaHandler(app);

    // Fire many invocations concurrently against the one warm handler.
    const results = await Promise.all(
      Array.from({ length: 8 }, () => handler(v2Get('/'))),
    );

    expect(boot.count).toBe(1);
    for (const r of results) expect(r.statusCode).toBe(200);
  });

  it('7.2 does not leak request state between invocations on one warm instance', async () => {
    const app = createApp();
    app.use((ctx) => {
      // Read any leaked marker from a prior invocation, then set our own.
      const seen = (ctx.state as Record<string, unknown>).marker ?? null;
      (ctx.state as Record<string, unknown>).marker = 'set-by-this-invocation';
      ctx.json({ seen });
    });

    const handler = createLambdaHandler(app);

    const first = await handler(v2Get('/one'));
    const second = await handler(v2Get('/two'));

    // Each invocation starts with a fresh Context: neither observes the other's state.
    expect(JSON.parse(first.body)).toEqual({ seen: null });
    expect(JSON.parse(second.body)).toEqual({ seen: null });
  });
});
