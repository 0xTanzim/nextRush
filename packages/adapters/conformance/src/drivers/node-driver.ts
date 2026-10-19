/**
 * Node-adapter conformance driver.
 *
 * @remarks
 * Node is the only adapter whose real server (`serve`) can run under Node/vitest,
 * so this driver spins a real loopback server per request and speaks raw
 * `node:http` to it. Raw HTTP (not `fetch`) is used deliberately: `fetch`
 * auto-follows redirects and returns an opaque response for `redirect:'manual'`,
 * which would hide the redirect status/headers the suite must observe.
 *
 * @packageDocumentation
 */

import { createHandler, serve } from '@nextrush/adapter-node';
import { createServer } from 'node:http';
import { type Application, createApp } from '@nextrush/core';
import { getRuntimeCapabilities } from '@nextrush/runtime';
import { request as httpRequest, type IncomingHttpHeaders } from 'node:http';
import { buildConformanceApp } from './app-shape';
import type { Configure, ConformanceDriver, DispatchInit, DispatchResult } from './types';

interface RawResponse {
  status: number;
  headers: IncomingHttpHeaders;
  body: string;
}

/**
 * Perform a raw HTTP request against the loopback server.
 *
 * @remarks
 * `init.path` is written into the request line exactly as given, so this function
 * also satisfies a `verbatimTarget` dispatch: `node:http` does not parse the path
 * it is handed (measured against a socket that echoes its own request line), which
 * is what makes a dot-segment target observable here at all — `fetch` would have
 * resolved it client-side before the request left.
 */
function rawRequest(port: number, init: DispatchInit | undefined): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: '127.0.0.1',
        port,
        path: init?.path ?? '/',
        method: init?.method ?? 'GET',
        headers: init?.headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      }
    );
    req.on('error', reject);
    if (init?.body !== undefined) req.write(init.body);
    req.end();
  });
}

/**
 * Dispatch through the bare handler `serve()` itself installs, over a listener
 * this driver owns.
 *
 * @remarks
 * `serve()` boots eagerly, so it can never exercise a pre-boot entry point. The
 * handler-level race is disabled here so the assertion observes routing, not the
 * timeout arm.
 */
async function dispatchThroughBareHandler(
  app: Application,
  init?: DispatchInit
): Promise<RawResponse> {
  const server = createServer(createHandler(app, { timeout: 0 }));
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const address = server.address();
    const port = typeof address === 'object' && address !== null ? address.port : 0;
    return await rawRequest(port, init);
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  }
}

/** Normalize a raw Node response into a runtime-agnostic result. */
function toResult(raw: RawResponse): DispatchResult {
  return {
    status: raw.status,
    header: (name) => {
      const value = raw.headers[name.toLowerCase()];
      return Array.isArray(value) ? value.join(', ') : value;
    },
    setCookies: () => {
      const cookies = raw.headers['set-cookie'];
      return Array.isArray(cookies) ? cookies : [];
    },
    text: () => raw.body,
  };
}

export const nodeDriver: ConformanceDriver = {
  name: 'node',
  // Real loopback listener on the adapter's own runtime: this driver is the
  // strongest evidence the suite has, so it is the one that can satisfy a
  // socket-required scenario.
  transport: 'socket',
  runtimeFidelity: 'real-runtime',
  handlerTimeout504: true, // F-04/ADR-0010: Node now races the handler and returns a clean 504
  teardownOnShutdown: true,
  transportAbortFiresSignal: true,
  honorsCloudflareIp: false, // Node ignores cf-connecting-ip (F-11)
  // The response is written and ended inside the handler, so a header set after
  // `await next()` resolves has no open response to land in.
  rawRequestTarget: getRuntimeCapabilities().rawRequestTarget,

  async dispatch(configure: Configure, init?: DispatchInit): Promise<DispatchResult> {
    const app = buildConformanceApp(init);
    configure(app);
    if (init?.beforeBoot === true) {
      return toResult(await dispatchThroughBareHandler(app, init));
    }
    const server = await serve(app, { port: 0 });
    try {
      return toResult(await rawRequest(server.port, init));
    } finally {
      await server.close();
    }
  },

  async abortFiresSignal(): Promise<boolean> {
    let fired = false;
    const app = createApp();
    app.use(async (ctx) => {
      const signal = ctx.signal; // arm the res-close / req-aborted listeners
      await new Promise<void>((resolve) => {
        if (signal.aborted) {
          fired = true;
          resolve();
          return;
        }
        signal.addEventListener(
          'abort',
          () => {
            fired = true;
            resolve();
          },
          { once: true }
        );
      });
    });
    const server = await serve(app, { port: 0 });
    try {
      const req = httpRequest({ host: '127.0.0.1', port: server.port, path: '/', method: 'GET' });
      req.on('error', () => undefined);
      req.end();
      await new Promise((r) => setTimeout(r, 20));
      req.destroy(); // client disconnect → server observes socket close
      await new Promise((r) => setTimeout(r, 100));
    } finally {
      await server.close();
    }
    return fired;
  },

  timeoutResult(): Promise<{ status: number; signalFired: boolean }> {
    // F-04/ADR-0010: Node now races the handler against `timeout` and returns a
    // clean 504, cancelling via ctx.signal — mirroring Bun/Deno/Edge/Serverless.
    let signalFired = false;
    const app = createApp();
    app.use(async (ctx) => {
      const signal = ctx.signal;
      await new Promise<void>((resolve) => {
        signal.addEventListener(
          'abort',
          () => {
            signalFired = true;
            resolve();
          },
          { once: true }
        );
      });
    });
    return (async () => {
      // No socket-guard override: `serve()` keeps `server.timeout` strictly
      // later than the handler deadline, so the clean 504 always gets to write
      // before the guard can close an idle socket. This case used to raise
      // `httpServer.timeout` locally to dodge that race; the ordering fix is
      // what makes the override unnecessary.
      const server = await serve(app, { port: 0, timeout: 10 });
      try {
        const raw = await rawRequest(server.port, { path: '/' });
        return { status: raw.status, signalFired };
      } finally {
        await server.close();
      }
    })();
  },

  async committedResponseOutlivesTimeout(): Promise<{ status: number; body: unknown }> {
    const app = createApp();
    app.use(async (ctx) => {
      // Commit after a microtask so the adapter arms its timer: the harder
      // case is a response committed while that timer is already running.
      await Promise.resolve();
      ctx.json({ ok: true });
      // Outlives the timeout below, so the timer fires with the response
      // already committed.
      await new Promise<void>((resolve) => setTimeout(resolve, 40));
    });
    // No socket-guard override — see `timeoutResult`: `serve()` keeps the guard
    // strictly behind the handler deadline, so the committed response is flushed
    // before the guard can fire.
    const server = await serve(app, { port: 0, timeout: 10 });
    try {
      const raw = await rawRequest(server.port, { path: '/' });
      return { status: raw.status, body: JSON.parse(raw.body) as unknown };
    } finally {
      await server.close();
    }
  },
};
