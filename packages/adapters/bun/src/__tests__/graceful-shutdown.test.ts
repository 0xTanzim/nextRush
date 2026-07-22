/**
 * @nextrush/adapter-bun — F-06 (ADR-0010): opt-in signal-wired graceful shutdown.
 *
 * `serve()`'s `close()` already drains in-flight requests correctly (stop
 * accepting -> wait for `activeRequests` to reach 0, force-close after
 * `shutdownTimeout` -> `app.close()`). This suite proves the `gracefulShutdown`
 * option wires `SIGTERM`/`SIGINT` to that SAME `close()` — installing no handler
 * when the option is omitted, and never leaking the handler past one
 * `serve()`/`close()` cycle — mirroring the Node adapter's contract exactly.
 *
 * `Bun.serve` does not exist under vitest/Node (no existing test in this package
 * calls `serve()` for that reason — only `createHandler`, which never touches the
 * global). `serve()` itself is what this suite targets, so it installs a minimal
 * `globalThis.Bun.serve` stub backed by a real `node:http` server: the stub only
 * replaces the network transport, and `serve()`'s own `drainAndClose`/signal-
 * wiring code (the logic under test) runs for real, unmocked. Real-Bun proof of
 * the adapter lives in `bun-runner/` (`bun test`).
 */

import { createApp } from '@nextrush/core';
import { createServer, type Server as NodeHttpServer } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { serve, type ServerInstance } from '../adapter';

interface StubBunServer {
  port: number;
  hostname: string;
  requestIP(request: Request): { address: string; family: string; port: number } | null;
  stop(force?: boolean): Promise<void>;
  reload(options: unknown): void;
}

interface StubBunServeInit {
  port?: number;
  hostname?: string;
  fetch: (request: Request, server: StubBunServer) => Promise<Response>;
  error?: (error: Error) => Response;
}

/** Monotonic counter for deterministic test ports (avoids the async node:http `listen()` vs. Bun's synchronous-bind timing gap under `port: 0`). Seeded from the current time so repeated test runs in the same process don't collide on a port a prior run's OS-level TIME_WAIT socket still holds. */
let stubPortCounter = 36000 + (Date.now() % 4000);
function nextStubPort(): number {
  return stubPortCounter++;
}

/**
 * Retry a `fetch` a few times to absorb the small window between `Bun.serve()`
 * returning (synchronous in real Bun) and the stub's underlying `node:http`
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
 * Minimal `Bun.serve` stand-in backed by a real `node:http` server, so a real
 * TCP connection carries requests to the adapter's real handler — only the
 * underlying transport is Node's HTTP server instead of Bun's.
 */
function installBunServeStub(): { restore: () => void } {
  const g = globalThis as { Bun?: { serve: (init: StubBunServeInit) => StubBunServer } };
  const previous = g.Bun;

  g.Bun = {
    serve(init: StubBunServeInit): StubBunServer {
      const httpServer: NodeHttpServer = createServer();
      const boundPort = init.port && init.port > 0 ? init.port : nextStubPort();

      const bunServer: StubBunServer = {
        port: boundPort,
        hostname: init.hostname ?? '127.0.0.1',
        requestIP: () => ({ address: '127.0.0.1', family: 'IPv4', port: 0 }),
        stop: (force?: boolean) =>
          new Promise<void>((resolve) => {
            if (force) httpServer.closeAllConnections();
            httpServer.close(() => resolve());
          }),
        reload: () => undefined,
      };

      httpServer.on('request', (req, res) => {
        const url = `http://127.0.0.1${req.url ?? '/'}`;
        const request = new Request(url, { method: req.method });
        void init.fetch(request, bunServer).then(async (response) => {
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          // Force `Connection: close` so `server.stop()` (called by both the
          // SIGTERM path and a manual `close()`) resolves once this response
          // flushes, instead of waiting out an HTTP/1.1 keep-alive socket.
          res.setHeader('Connection', 'close');
          const text = await response.text();
          res.end(text);
        });
      });

      // Bun.serve() is synchronous and callers (serve() in adapter.ts) read
      // `server.port` immediately after this call returns. `node:http`'s
      // `listen()` is asynchronous, so the stub pre-allocates a fixed test port
      // (avoiding the real ephemeral-port race under `port: 0`) rather than
      // trying to fake Bun's synchronous-bind contract exactly.
      httpServer.listen(boundPort, init.hostname ?? '127.0.0.1');

      return bunServer;
    },
  };

  return {
    restore: () => {
      g.Bun = previous;
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

describe('F-06: Bun serve() — gracefulShutdown option', () => {
  it('installs no signal handler when the option is omitted', async () => {
    stub = installBunServeStub();
    const before = listenerCount('SIGTERM');
    const app = createApp();
    app.use((ctx) => ctx.json({ ok: true }));
    instance = await serve(app, { port: 0 });

    expect(listenerCount('SIGTERM')).toBe(before);
  });

  it('installs handlers for the default signal set when gracefulShutdown: true', async () => {
    stub = installBunServeStub();
    const beforeTerm = listenerCount('SIGTERM');
    const beforeInt = listenerCount('SIGINT');
    const app = createApp();
    app.use((ctx) => ctx.json({ ok: true }));
    instance = await serve(app, { port: 0, gracefulShutdown: true });

    expect(listenerCount('SIGTERM')).toBe(beforeTerm + 1);
    expect(listenerCount('SIGINT')).toBe(beforeInt + 1);
  });

  it('installs a handler only for the configured signal set', async () => {
    stub = installBunServeStub();
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
    stub = installBunServeStub();
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
    stub = installBunServeStub();
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
    // Let the handler finish after the signal, proving the drain waits for it.
    released?.();

    const res = await inFlight;
    const body = (await res.json()) as { ok: boolean };
    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });

    await server.close();
    expect(listenerCount('SIGTERM')).toBe(beforeTerm);
  });
});
