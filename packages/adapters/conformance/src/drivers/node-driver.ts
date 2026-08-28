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

import { serve } from '@nextrush/adapter-node';
import { createApp } from '@nextrush/core';
import { request as httpRequest, type IncomingHttpHeaders } from 'node:http';
import type { Configure, ConformanceDriver, DispatchInit, DispatchResult } from './types';

interface RawResponse {
  status: number;
  headers: IncomingHttpHeaders;
  body: string;
}

/** Perform a raw HTTP request against the loopback server. */
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
  handlerTimeout504: true, // F-04/ADR-0010: Node now races the handler and returns a clean 504
  teardownOnShutdown: true,
  transportAbortFiresSignal: true,
  honorsCloudflareIp: false, // Node ignores cf-connecting-ip (F-11)

  async dispatch(configure: Configure, init?: DispatchInit): Promise<DispatchResult> {
    const app = createApp({ proxy: init?.proxy ?? false });
    configure(app);
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
      const server = await serve(app, { port: 0, timeout: 10 });
      // F-04 isolation: `serve()` feeds the single `timeout` to BOTH the
      // handler-race timer (the clean-504 producer) and Node's independent
      // socket-level slow-client guard (`server.timeout`). At `timeout: 10ms`
      // the socket guard is armed at the same 10ms and, on a contended CI
      // runner, can destroy the idle socket — surfacing as ECONNRESET on the
      // client — before the handler writes its 504. This case isolates the
      // HANDLER race (the cross-adapter F-04/F-08 parity contract), so give the
      // socket guard generous, independent time to stay out of the way. This
      // driver only boots a plain node:http server (no TLS), so narrow to it.
      const httpServer = server.server as import('node:http').Server;
      httpServer.timeout = 5_000;
      httpServer.keepAliveTimeout = 5_000;
      try {
        const raw = await rawRequest(server.port, { path: '/' });
        return { status: raw.status, signalFired };
      } finally {
        await server.close();
      }
    })();
  },
};
