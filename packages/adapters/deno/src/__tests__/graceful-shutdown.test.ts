/**
 * @nextrush/adapter-deno — F-06 (ADR-0010): opt-in signal-wired graceful shutdown.
 *
 * Mirrors `bun/src/__tests__/graceful-shutdown.test.ts`: proves `gracefulShutdown`
 * wires `SIGTERM`/`SIGINT` to the SAME drain `close()` already performs (abort the
 * server's `AbortController`, race `server.shutdown()` against `shutdownTimeout`,
 * then `app.close()`) — installing no handler by default, and never leaking the
 * handler past one `serve()`/`close()` cycle.
 *
 * `Deno.serve` does not exist under vitest/Node (this package's other adapter
 * tests exercise `createHandler` directly for that reason). `serve()` itself —
 * the signal-wiring/drain logic under test here — needs a running "server", so
 * this file installs a minimal `globalThis.Deno.serve` stub that behaves like a
 * real HTTP server closely enough to exercise `serve()`'s actual drain/signal
 * code (not a mock of the behavior under test: the stub only replaces the
 * network transport, and `serve()`'s own `drainAndClose`/signal-wiring runs for
 * real). Real-Deno proof of the adapter lives in `deno-runner/`.
 */

import { createApp } from '@nextrush/core';
import { createServer, type Server as NodeHttpServer } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { serve, type ServerInstance } from '../adapter';

interface StubDenoServer {
  addr: { port: number; hostname: string };
  finished: Promise<void>;
  shutdown(): Promise<void>;
}

interface StubDenoServeInit {
  port?: number;
  hostname?: string;
  signal?: AbortSignal;
  handler: (request: Request, info: { remoteAddr: { hostname: string; port: number } }) => Promise<Response>;
  onListen?: (params: { port: number; hostname: string }) => void;
  onError?: (error: unknown) => Response | Promise<Response>;
}

/** Monotonic counter for deterministic test ports (avoids the async node:http `listen()` vs. Deno's synchronous-bind timing gap under `port: 0`). Seeded from the current time so repeated test runs in the same process don't collide on a port a prior run's OS-level TIME_WAIT socket still holds. */
let stubPortCounter = 37000 + (Date.now() % 4000);
function nextStubPort(): number {
  return stubPortCounter++;
}

/**
 * Retry a `fetch` a few times to absorb the small window between `Deno.serve()`
 * returning (synchronous in real Deno) and the stub's underlying `node:http`
 * `listen()` actually completing (asynchronous in Node) — a real connection is
 * still made; this only tolerates the stub's timing, not the adapter's.
 */
async function fetchWithRetry(url: string, attempts = 20): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url);
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 5));
    }
  }
  throw lastError;
}

/**
 * Minimal `Deno.serve` stand-in backed by a real `node:http` server, so a real
 * TCP connection carries requests to the adapter's real handler — only the
 * underlying transport is Node's HTTP server instead of Deno's, which is the
 * one piece `serve()` itself cannot provide under vitest.
 */
function installDenoServeStub(): { restore: () => void } {
  const g = globalThis as { Deno?: { serve: (init: StubDenoServeInit) => StubDenoServer } };
  const previous = g.Deno;

  g.Deno = {
    serve(init: StubDenoServeInit): StubDenoServer {
      let finishedResolve: (() => void) | undefined;
      const finished = new Promise<void>((resolve) => {
        finishedResolve = resolve;
      });
      const boundPort = init.port && init.port > 0 ? init.port : nextStubPort();

      const httpServer: NodeHttpServer = createServer((req, res) => {
        const url = `http://127.0.0.1${req.url ?? '/'}`;
        const request = new Request(url, { method: req.method });
        void init
          .handler(request, { remoteAddr: { hostname: '127.0.0.1', port: 0 } })
          .then(async (response) => {
            res.statusCode = response.status;
            response.headers.forEach((v, k) => res.setHeader(k, v));
            // Force `Connection: close` so `server.close()` (called by both the
            // abort listener and `shutdown()`) resolves once this response
            // flushes, instead of waiting out an HTTP/1.1 keep-alive socket that
            // only the stub's test client would otherwise linger on.
            res.setHeader('Connection', 'close');
            const text = await response.text();
            res.end(text);
          });
      });

      httpServer.listen(boundPort, '127.0.0.1', () => {
        init.onListen?.({ port: boundPort, hostname: '127.0.0.1' });
      });

      init.signal?.addEventListener('abort', () => {
        httpServer.close(() => finishedResolve?.());
      });

      return {
        addr: { port: boundPort, hostname: '127.0.0.1' },
        finished,
        shutdown: () =>
          new Promise<void>((resolve) => {
            httpServer.close(() => resolve());
          }),
      };
    },
  };

  return {
    restore: () => {
      g.Deno = previous;
    },
  };
}

let instance: ServerInstance | undefined;
let stub: { restore: () => void } | undefined;

afterEach(async () => {
  await instance?.close();
  instance = undefined;
  stub?.restore();
  stub = undefined;
});

function listenerCount(signal: NodeJS.Signals): number {
  return process.listenerCount(signal);
}

describe('F-06: Deno serve() — gracefulShutdown option', () => {
  it('installs no signal handler when the option is omitted', async () => {
    stub = installDenoServeStub();
    const before = listenerCount('SIGTERM');
    const app = createApp();
    app.use((ctx) => ctx.json({ ok: true }));
    instance = await serve(app, { port: 0 });

    expect(listenerCount('SIGTERM')).toBe(before);
  });

  it('installs handlers for the default signal set when gracefulShutdown: true', async () => {
    stub = installDenoServeStub();
    const beforeTerm = listenerCount('SIGTERM');
    const beforeInt = listenerCount('SIGINT');
    const app = createApp();
    app.use((ctx) => ctx.json({ ok: true }));
    instance = await serve(app, { port: 0, gracefulShutdown: true });

    expect(listenerCount('SIGTERM')).toBe(beforeTerm + 1);
    expect(listenerCount('SIGINT')).toBe(beforeInt + 1);
  });

  it('installs a handler only for the configured signal set', async () => {
    stub = installDenoServeStub();
    const beforeTerm = listenerCount('SIGTERM');
    const beforeInt = listenerCount('SIGINT');
    const app = createApp();
    app.use((ctx) => ctx.json({ ok: true }));
    instance = await serve(app, {
      port: 0,
      gracefulShutdown: { signals: ['SIGTERM'] },
    });

    expect(listenerCount('SIGTERM')).toBe(beforeTerm + 1);
    expect(listenerCount('SIGINT')).toBe(beforeInt);
  });

  it('removes the handler once close() completes, so repeated cycles do not accumulate listeners', async () => {
    stub = installDenoServeStub();
    const before = listenerCount('SIGTERM');
    const app = createApp();
    app.use((ctx) => ctx.json({ ok: true }));

    const first = await serve(app, { port: 0, gracefulShutdown: true });
    await first.close();
    expect(listenerCount('SIGTERM')).toBe(before);

    const second = await serve(app, { port: 0, gracefulShutdown: true });
    await second.close();
    expect(listenerCount('SIGTERM')).toBe(before);
  });

  it('a real SIGTERM triggers the same drain close() performs, with zero dropped in-flight requests', async () => {
    stub = installDenoServeStub();
    const beforeTerm = listenerCount('SIGTERM');
    const app = createApp();
    let released: (() => void) | undefined;
    let handlerStarted: (() => void) | undefined;
    const handlerStartedPromise = new Promise<void>((resolve) => {
      handlerStarted = resolve;
    });
    app.use(async (ctx) => {
      handlerStarted?.();
      await new Promise<void>((resolve) => {
        released = resolve;
      });
      ctx.json({ ok: true });
    });
    const server = await serve(app, {
      port: 0,
      gracefulShutdown: true,
      shutdownTimeout: 2000,
    });
    expect(listenerCount('SIGTERM')).toBe(beforeTerm + 1);

    const inFlight = fetchWithRetry(`http://127.0.0.1:${String(server.port)}/`);
    // Deterministically wait for the handler to actually start (not a fixed
    // timeout guess, which is a real flake source under concurrent test load
    // — the request may not have reached the handler yet).
    await handlerStartedPromise;

    process.emit('SIGTERM');
    released?.();

    const res = await inFlight;
    const body = (await res.json()) as { ok: boolean };
    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });

    await server.close();
    expect(listenerCount('SIGTERM')).toBe(beforeTerm);
  });
});
