import { describe, expect, it, vi } from 'vitest';
import type { Logger } from '@nextrush/types';
import { createUniversalFetchHandler } from '../universal-runner';
import type { WebRunnerApp } from '../web-runner';
import { UniversalWebContext } from '../universal-context';

function createMockApp(
  dispatch: (ctx: UniversalWebContext) => Promise<void> | void,
  options: {
    syncDispatchSafe?: boolean;
    isReady?: boolean;
    bootDelayMs?: number;
    bootError?: Error;
  } = {}
): WebRunnerApp<(ctx: UniversalWebContext) => Promise<void>> & { readyCalls: number } {
  let readyCalls = 0;
  const logger: Logger = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  };

  return {
    isReady: options.isReady ?? false,
    isProduction: true,
    logger,
    syncDispatchSafe: options.syncDispatchSafe ?? true,
    get readyCalls() {
      return readyCalls;
    },
    ready: () => {
      readyCalls += 1;
      if (options.bootError) {
        return Promise.reject(options.bootError);
      }
      if (options.bootDelayMs && options.bootDelayMs > 0) {
        return new Promise<void>((resolve) => {
          setTimeout(resolve, options.bootDelayMs);
        });
      }
      return Promise.resolve();
    },
    start: vi.fn(),
    callback: () => {
      return (ctx: UniversalWebContext) => {
        const res = dispatch(ctx);
        return res instanceof Promise ? res : Promise.resolve();
      };
    },
  };
}

describe('Challenger Stress & Boundary Suite: Milestone 2 Iteration 2', () => {
  // =========================================================================
  // Verification 1: Concurrent Stress Across 5 Calling Conventions (1,500+ calls)
  // =========================================================================
  describe('Verification 1: Rapid Concurrent Invocation Across All 5 Calling Conventions', () => {
    it('executes 1,500 rapid concurrent calls mixing Cloudflare, Vercel Edge, Bun, Deno, and 1-arg styles', async () => {
      const TOTAL_REQUESTS = 1500;
      let handledCount = 0;

      const app = createMockApp((ctx) => {
        handledCount += 1;
        // Verify path, query, and IP resolution during execution
        const clientIp = ctx.ip;
        ctx.json({
          handled: handledCount,
          path: ctx.path,
          query: ctx.query,
          ip: clientIp,
          hasEnv: ctx.env !== undefined,
        });
      }, { syncDispatchSafe: false });

      const fetch = createUniversalFetchHandler(app, { timeout: 10000 });

      // Build 1,500 requests cycling across all 5 styles
      const promises: Promise<Response>[] = [];

      for (let i = 0; i < TOTAL_REQUESTS; i++) {
        const style = i % 5;
        const iStr = String(i);
        const styleStr = String(style);
        const req = new Request(`http://localhost/stress/${iStr}?index=${iStr}&style=${styleStr}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (style === 0) {
          // Cloudflare Workers (3-arg: req, env, ctx)
          const env = { KV_STORE: `kv-${iStr}`, DB: `d1-${iStr}` };
          const execCtx = { waitUntil: vi.fn() };
          promises.push(Promise.resolve(fetch(req, env, execCtx)));
        } else if (style === 1) {
          // Vercel Edge (2-arg: req, ctx with waitUntil)
          const execCtx = { waitUntil: vi.fn() };
          promises.push(Promise.resolve(fetch(req, execCtx)));
        } else if (style === 2) {
          // Bun (2-arg: req, server with requestIP)
          const ipIndex = String((i % 250) + 1);
          const server = {
            requestIP: (_r: Request) => ({
              address: `192.168.1.${ipIndex}`,
              port: 3000,
              family: 'IPv4',
            }),
          };
          promises.push(Promise.resolve(fetch(req, server)));
        } else if (style === 3) {
          // Deno (2-arg: req, info with remoteAddr)
          const ipIndex = String((i % 250) + 1);
          const info = {
            remoteAddr: {
              transport: 'tcp' as const,
              hostname: `10.0.0.${ipIndex}`,
              port: 8000 + (i % 1000),
            },
          };
          promises.push(Promise.resolve(fetch(req, info)));
        } else {
          // Standard 1-arg: req
          promises.push(Promise.resolve(fetch(req)));
        }
      }

      // Execute all 1,500 requests concurrently
      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(TOTAL_REQUESTS);
      expect(handledCount).toBe(TOTAL_REQUESTS);

      for (let i = 0; i < TOTAL_REQUESTS; i++) {
        const res = responses[i];
        const iStr = String(i);
        const style = i % 5;
        const styleStr = String(style);
        expect(res.status).toBe(200);
        const data = (await res.json()) as {
          path: string;
          query: Record<string, string>;
          ip: string;
          hasEnv: boolean;
        };
        expect(data.path).toBe(`/stress/${iStr}`);
        expect(data.query).toEqual({ index: iStr, style: styleStr });

        if (style === 0) {
          expect(data.hasEnv).toBe(true);
        } else if (style === 2) {
          const ipIndex = String((i % 250) + 1);
          expect(data.ip).toBe(`192.168.1.${ipIndex}`);
        } else if (style === 3) {
          const ipIndex = String((i % 250) + 1);
          expect(data.ip).toBe(`10.0.0.${ipIndex}`);
        }
      }
    });

    it('handles cold-start boot delay under concurrent mixed-style invocations', async () => {
      const CONCURRENCY = 250;
      let handledCount = 0;

      const app = createMockApp(
        (ctx) => {
          handledCount += 1;
          ctx.json({ path: ctx.path, index: handledCount });
        },
        {
          isReady: false,
          bootDelayMs: 40, // 40ms simulated cold-start delay
        }
      );

      const fetch = createUniversalFetchHandler(app);

      // Fire 250 requests of cycling styles simultaneously before boot resolves
      const batch: Promise<Response>[] = Array.from({ length: CONCURRENCY }, (_, i) => {
        const iStr = String(i);
        const req = new Request(`http://localhost/cold-start/${iStr}`);
        const style = i % 5;
        if (style === 0) {
          return Promise.resolve(fetch(req, { BINDING: 'val' }, {
            waitUntil() {
              void 0;
            },
          }));
        } else if (style === 1) {
          return Promise.resolve(fetch(req, {
            waitUntil() {
              void 0;
            },
          }));
        } else if (style === 2) {
          return Promise.resolve(fetch(req, {
            requestIP: () => ({ address: '1.2.3.4', port: 80, family: 'IPv4' }),
          }));
        } else if (style === 3) {
          return Promise.resolve(fetch(req, { remoteAddr: { hostname: '5.6.7.8', port: 80, transport: 'tcp' } }));
        } else {
          return Promise.resolve(fetch(req));
        }
      });

      const responses = await Promise.all(batch);

      expect(app.readyCalls).toBe(1); // Boot gate ran exactly once
      expect(responses).toHaveLength(CONCURRENCY);
      for (const res of responses) {
        expect(res.status).toBe(200);
      }
      expect(handledCount).toBe(CONCURRENCY);
    });
  });

  // =========================================================================
  // Verification 2: Error Boundary & Custom onError Handling (universal-runner.ts:196)
  // =========================================================================
  describe('Verification 2: Error Boundary & Custom onError Handling (universal-runner:196)', () => {
    it('handles synchronous custom Response returned by onError', async () => {
      const app = createMockApp(() => {
        throw new Error('Sync failure in route');
      });

      const fetch = createUniversalFetchHandler(app, {
        onError: (err, ctx) => {
          return new Response(
            JSON.stringify({
              handledSync: true,
              message: err.message,
              path: ctx.path,
            }),
            {
              status: 418,
              headers: { 'Content-Type': 'application/json', 'X-Custom-Error': 'true' },
            }
          );
        },
      });

      const res = await fetch(new Request('http://localhost/error-sync'));
      expect(res.status).toBe(418);
      expect(res.headers.get('X-Custom-Error')).toBe('true');
      const body = (await res.json()) as { handledSync: boolean; message: string; path: string };
      expect(body).toEqual({
        handledSync: true,
        message: 'Sync failure in route',
        path: '/error-sync',
      });
    });

    it('handles native Promise<Response> returned by onError', async () => {
      const app = createMockApp(() => {
        throw new Error('Async failure in route');
      });

      const fetch = createUniversalFetchHandler(app, {
        onError: async (err, ctx) => {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 10);
          });
          return new Response(
            JSON.stringify({
              handledAsync: true,
              message: err.message,
              path: ctx.path,
            }),
            {
              status: 422,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        },
      });

      const res = await fetch(new Request('http://localhost/error-async'));
      expect(res.status).toBe(422);
      const body = (await res.json()) as { handledAsync: boolean; message: string; path: string };
      expect(body).toEqual({
        handledAsync: true,
        message: 'Async failure in route',
        path: '/error-async',
      });
    });

    it('handles custom Thenable (non-Promise object with .then) returned by onError', async () => {
      const app = createMockApp(() => {
        throw new Error('Failure requiring thenable');
      });

      // Custom thenable that is NOT an instanceof Promise
      const customThenable = {
        then(onFulfilled: (res: Response) => void, _onRejected?: (err: unknown) => void) {
          const customResponse = new Response(
            JSON.stringify({ thenable: true }),
            {
              status: 409,
              headers: { 'Content-Type': 'application/json' },
            }
          );
          setTimeout(() => {
            onFulfilled(customResponse);
          }, 5);
          return this;
        },
        catch(_onRejected: (err: unknown) => void) {
          return this;
        },
      };

      const fetch = createUniversalFetchHandler(app, {
        onError: (_err, _ctx) => {
          return customThenable as unknown as Promise<Response>;
        },
      });

      const res = await fetch(new Request('http://localhost/error-thenable'));
      expect(res.status).toBe(409);
      const body = (await res.json()) as { thenable: boolean };
      expect(body).toEqual({ thenable: true });
    });

    it('gracefully shields against custom onError rejecting asynchronously', async () => {
      const app = createMockApp(() => {
        throw new Error('Route failure');
      });

      const fetch = createUniversalFetchHandler(app, {
        onError: () => {
          return Promise.reject(new Error('Explosion inside onError'));
        },
      });

      const res = await fetch(new Request('http://localhost/error-reject'));
      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: string };
      expect(body).toEqual({ error: 'Internal Server Error' });
    });

    it('gracefully shields against custom onError throwing synchronously', async () => {
      const app = createMockApp(() => {
        throw new Error('Route failure');
      });

      const fetch = createUniversalFetchHandler(app, {
        onError: () => {
          throw new Error('Sync explosion inside onError');
        },
      });

      const res = await fetch(new Request('http://localhost/error-sync-throw'));
      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: string };
      expect(body).toEqual({ error: 'Internal Server Error' });
    });
  });

  // =========================================================================
  // Verification 3: Shared RESOLVED_VOID Stream Runners (Zero Allocation)
  // =========================================================================
  describe('Verification 3: Zero-Allocation Stream Runners Singleton (RESOLVED_VOID)', () => {
    it('verifies stream runners return the shared singleton RESOLVED_VOID promise without allocating new promises', () => {
      const ctx = new UniversalWebContext(new Request('http://localhost/stream-test'));

      // Invoke stream runners multiple times across different methods
      const noop = (): Promise<void> => Promise.resolve();
      const pText1 = ctx.stream(noop);
      const pText2 = ctx.stream(noop);
      const pSSE1 = ctx.sse(noop);
      const pSSE2 = ctx.sse(noop);
      const pNDJSON1 = ctx.ndjson(noop);
      const pNDJSON2 = ctx.ndjson(noop);

      // All returned promises must be the exact same object reference (===)
      expect(pText1).toBe(pText2);
      expect(pSSE1).toBe(pSSE2);
      expect(pNDJSON1).toBe(pNDJSON2);
      expect(pText1).toBe(pSSE1);
      expect(pText1).toBe(pNDJSON1);

      // Verify across a second context instance as well: shared module-level singleton
      const ctx2 = new UniversalWebContext(new Request('http://localhost/stream-test-2'));
      const pOtherCtx = ctx2.stream(noop);
      expect(pOtherCtx).toBe(pText1);
    });

    it('proves that a naive async () => undefined runner would allocate distinct promises', async () => {
      // Counter-example oracle: prove that if someone had used async () => undefined,
      // the test would fail because each call allocates a new Promise instance
      const allocatingRunner = {
        runTextStream: () => Promise.resolve(undefined),
        runSSEStream: () => Promise.resolve(undefined),
        runNDJSONStream: () => Promise.resolve(undefined),
      };

      const ctxWithAllocating = new UniversalWebContext(
        new Request('http://localhost/allocating'),
        undefined,
        undefined,
        { streamRunners: allocatingRunner }
      );

      const noop = (): Promise<void> => Promise.resolve();
      const pAlloc1 = ctxWithAllocating.stream(noop);
      const pAlloc2 = ctxWithAllocating.stream(noop);

      // Distinct promise instances allocated per call!
      expect(pAlloc1).not.toBe(pAlloc2);
      await Promise.all([pAlloc1, pAlloc2]);
    });
  });
});
