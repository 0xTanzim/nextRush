/**
 * Real-runtime conformance — Bun (F-01, ADR-0010).
 *
 * Runs the FULL shared `defineConformanceSuite` — not a hand-written subset —
 * against the Bun adapter's real request handler under the REAL Bun runtime
 * (`bun test`), through a real `Bun.serve()` server hit over the network.
 * Every behavior the in-process suite asserts (Set-Cookie arrays,
 * HEAD/204/304 suppression, redirect, error-no-leak, timeout/504, IP
 * precedence, streaming, SSE, body limits, etc.) is proven on real Bun,
 * closing the "claim outruns proof" gap the runtime-platform review (F-01)
 * identified — the previous version of this file asserted only 5 basic cases.
 *
 * `@nextrush/adapter-conformance`'s `./test-primitives` export carries a `bun`
 * condition (`package.json`), so under `bun test` the shared suite registers its
 * cases through Bun's own `it`/`expect` instead of vitest's — the same swap the
 * Deno runner gets from its import map, with no per-runner file rewriting.
 *
 * Resolves `@nextrush/*` through `dist/`, so `pnpm build` must have run (CI builds
 * before it runs this). Run: cd packages/adapters/conformance/bun-runner && bun test
 */

import { afterEach, describe, expect, test } from 'bun:test';
import { request as httpRequest, type IncomingMessage } from 'node:http';
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { createHandler, serve } from '@nextrush/adapter-bun';
import { bodyParser } from '@nextrush/body-parser';
import type { ServerInstance } from '@nextrush/adapter-bun';
import { detectRuntime, getRuntimeCapabilities } from '@nextrush/runtime';
import {
  buildConformanceApp,
  defineConformanceSuite,
  scenarioRecords,
  scenarioReport,
} from '@nextrush/adapter-conformance';
import type { ConformanceDriver, Configure, DispatchInit, DispatchResult } from '@nextrush/adapter-conformance';

let instance: ServerInstance | undefined;

afterEach(async () => {
  await instance?.close();
  instance = undefined;
});

describe('sanity: runs under the real Bun runtime', () => {
  test('detectRuntime() reports bun', () => {
    expect(detectRuntime()).toBe('bun');
  });
});

/**
 * Perform a raw request against the real loopback server, with manual
 * redirect handling (matching the in-process node-driver's rationale: `fetch`
 * auto-follows redirects by default, which would hide the redirect status the
 * suite must observe).
 */
async function rawFetch(port: number, init?: DispatchInit): Promise<Response> {
  return fetch(`http://127.0.0.1:${String(port)}${init?.path ?? '/'}`, {
    method: init?.method ?? 'GET',
    headers: init?.headers,
    redirect: 'manual',
    ...(init?.body !== undefined ? { body: init.body } : {}),
  });
}

function toResult(response: Response, bodyText: string): DispatchResult {
  return {
    status: response.status,
    header: (name) => response.headers.get(name) ?? undefined,
    setCookies: () => response.headers.getSetCookie(),
    text: () => bodyText,
  };
}

/**
 * Send the target in the request line unparsed, for a `verbatimTarget` dispatch.
 *
 * `fetch` — this driver's transport everywhere else — resolves a dot segment on
 * the client, so the server would never see the target the scenario is asking
 * about. `node:http` writes `path` into the request line as given (measured under
 * Bun against a socket that echoes its own request line) and returns a response
 * with its headers parsed, so nothing else about this driver changes.
 */
async function verbatimFetch(port: number, init: DispatchInit): Promise<DispatchResult> {
  const response = await new Promise<IncomingMessage>((resolve, reject) => {
    const req = httpRequest(
      {
        host: '127.0.0.1',
        port,
        path: init.path ?? '/',
        method: init.method ?? 'GET',
        headers: init.headers,
      },
      resolve
    );
    req.on('error', reject);
    if (init.body !== undefined) req.write(init.body);
    req.end();
  });

  const chunks: Buffer[] = [];
  for await (const chunk of response) chunks.push(chunk as Buffer);

  return {
    status: response.statusCode ?? 0,
    header: (name) => {
      const value = response.headers[name.toLowerCase()];
      return Array.isArray(value) ? value.join(', ') : value;
    },
    setCookies: () => response.headers['set-cookie'] ?? [],
    text: () => Buffer.concat(chunks).toString('utf8'),
  };
}

/** Real-Bun ConformanceDriver: every dispatch spins a real `serve()` and hits it over the network. */
const realBunDriver: ConformanceDriver = {
  name: 'bun',
  transport: 'socket', // every dispatch spins a real serve() and hits it over loopback
  runtimeFidelity: 'real-runtime', // this file runs under `bun test`
  handlerTimeout504: true,
  teardownOnShutdown: true,
  transportAbortFiresSignal: true,
  honorsCloudflareIp: false,
  honorsPostHandlerHeaderWrite: true, // the Web request handler records the response
  // The running runtime's own answer: this file runs under `bun test`, so it
  // reports Bun's platform behaviour rather than a value copied from a table.
  rawRequestTarget: getRuntimeCapabilities().rawRequestTarget,

  async dispatch(configure: Configure, init?: DispatchInit): Promise<DispatchResult> {
    const app = buildConformanceApp(init);
    configure(app);
    if (init?.beforeBoot === true) {
      // The documented Web form with no explicit boot: `Bun.serve({ fetch:
      // createHandler(app) })`, and `ready()` is deliberately NOT awaited, so the
      // entry point has to boot the application itself.
      const bare = Bun.serve({ port: 0, fetch: createHandler(app) });
      try {
        const res = await rawFetch(bare.port, init);
        return toResult(res, await res.text());
      } finally {
        await bare.stop(true);
      }
    }
    const server = await serve(app, { port: 0 });
    try {
      if (init?.verbatimTarget === true) return await verbatimFetch(server.port, init);
      const res = await rawFetch(server.port, init);
      const bodyText = await res.text();
      return toResult(res, bodyText);
    } finally {
      await server.close();
    }
  },

  async abortFiresSignal(): Promise<boolean> {
    let fired = false;
    const app = createApp();
    app.use(async (ctx) => {
      const signal = ctx.signal;
      await new Promise<void>((resolve) => {
        if (signal.aborted) {
          fired = true;
          resolve();
          return;
        }
        signal.addEventListener('abort', () => {
          fired = true;
          resolve();
        }, { once: true });
      });
    });
    const server = await serve(app, { port: 0 });
    try {
      const controller = new AbortController();
      const pending = fetch(`http://127.0.0.1:${String(server.port)}/`, { signal: controller.signal });
      setTimeout(() => controller.abort(), 10);
      await pending.catch(() => undefined);
      await new Promise((r) => setTimeout(r, 50));
    } finally {
      await server.close();
    }
    return fired;
  },

  async timeoutResult(): Promise<{ status: number; signalFired: boolean }> {
    let signalFired = false;
    const app = createApp();
    app.use(async (ctx) => {
      const signal = ctx.signal;
      await new Promise<void>((resolve) => {
        signal.addEventListener('abort', () => {
          signalFired = true;
          resolve();
        }, { once: true });
      });
    });
    const server = await serve(app, { port: 0, timeout: 10 });
    try {
      const res = await rawFetch(server.port);
      return { status: res.status, signalFired };
    } finally {
      await server.close();
    }
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
    const server = await serve(app, { port: 0, timeout: 10 });
    try {
      const res = await rawFetch(server.port);
      return { status: res.status, body: await res.json() };
    } finally {
      await server.close();
    }
  },
};

describe('bun adapter — full cross-adapter conformance suite on real Bun', () => {
  defineConformanceSuite(realBunDriver);

  // Proof level is reported, not implied: which scenarios this run actually
  // proved over a real socket on the real runtime, and which were refused.
  test('proof levels', () => {
    // eslint-disable-next-line no-console -- this runner's report IS the output
    console.log(scenarioReport());
    expect(scenarioRecords().length).toBeGreaterThan(0);
  });
});

/**
 * RFC-047 on real Bun: the lazy body path must behave the same here as it does
 * under the simulated drivers — an unread body is never parsed (so a malformed
 * one cannot fail the request) and an explicit `readBody()` produces the eager
 * envelope.
 */
describe('bun adapter — lazy body parsing on real Bun (RFC-047)', () => {
  test('an unread body is never parsed, so malformed JSON answers 200', async () => {
    const app = createApp({ router: createRouter() });
    app.use(bodyParser({ lazy: true }));
    app.post('/unread', (ctx) => {
      ctx.json({ read: false });
    });

    const server = await serve(app, { port: 0, timeout: 10 });
    try {
      const res = await rawFetch(server.port, {
        method: 'POST',
        path: '/unread',
        headers: { 'content-type': 'application/json' },
        body: '{"broken": ',
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ read: false });
    } finally {
      await server.close();
    }
  });

  test('readBody() parses a valid body and keeps the eager error envelope', async () => {
    const app = createApp({ router: createRouter() });
    app.use(bodyParser({ lazy: true }));
    app.post('/read', async (ctx) => {
      ctx.json({ body: await ctx.readBody() });
    });

    const server = await serve(app, { port: 0, timeout: 10 });
    try {
      const ok = await rawFetch(server.port, {
        method: 'POST',
        path: '/read',
        headers: { 'content-type': 'application/json' },
        body: '{"a":1}',
      });
      expect(ok.status).toBe(200);
      expect(await ok.json()).toEqual({ body: { a: 1 } });

      const bad = await rawFetch(server.port, {
        method: 'POST',
        path: '/read',
        headers: { 'content-type': 'application/json' },
        body: '{"broken": ',
      });
      expect(bad.status).toBe(400);
      expect(await bad.json()).toMatchObject({ code: 'INVALID_JSON', status: 400 });
    } finally {
      await server.close();
    }
  });
});
