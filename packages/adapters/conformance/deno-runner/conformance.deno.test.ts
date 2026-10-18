/**
 * Real-runtime conformance — Deno (F-01, ADR-0010).
 *
 * Runs the FULL shared `defineConformanceSuite` — not a hand-written subset —
 * against the Deno adapter under the REAL Deno runtime (`deno test`), through a
 * real `Deno.serve()` listener hit over loopback. Running over a socket rather
 * than calling the handler directly is what makes transport-level behaviour
 * observable here (response framing, connection teardown, the request target as
 * Deno itself delivered it), which is exactly what a socket-required scenario
 * needs and what an in-process invocation cannot show.
 *
 * `deno.json`'s import map redirects the conformance package's
 * `@nextrush/adapter-conformance/test-primitives` specifier to a Deno-native
 * `it`/`expect` (`test-primitives.deno.ts`, backed by `Deno.test` + `@std/expect`),
 * so `defineConformanceSuite` registers its assertions through Deno's real test
 * runner.
 *
 * Resolves `@nextrush/*` through `dist/` per `deno.json`, so run
 * `pnpm build` first. Run: cd packages/adapters/conformance/deno-runner && deno task conformance
 */

import { createApp, type Application } from '@nextrush/core';
import { createHandler, serve, type ServerInstance } from '@nextrush/adapter-deno';
import { detectRuntime } from '@nextrush/runtime';
import {
  buildConformanceApp,
  defineConformanceSuite,
  scenarioRecords,
  scenarioReport,
} from '@nextrush/adapter-conformance';
import type {
  ConformanceDriver,
  Configure,
  DispatchInit,
  DispatchResult,
} from '@nextrush/adapter-conformance';
import { expect } from '@nextrush/adapter-conformance/test-primitives';

Deno.test('sanity: runs under the real Deno runtime', () => {
  expect(detectRuntime()).toBe('deno');
});

/**
 * Request against the real loopback listener with manual redirect handling:
 * `fetch` follows redirects by default, which would hide the redirect status and
 * `Location` header the suite must observe.
 */
async function rawFetch(port: number, init?: DispatchInit): Promise<Response> {
  return await fetch(`http://127.0.0.1:${String(port)}${init?.path ?? '/'}`, {
    method: init?.method ?? 'GET',
    headers: init?.headers,
    redirect: 'manual',
    ...(init?.body === undefined ? {} : { body: init.body }),
  });
}

async function toResult(response: Response): Promise<DispatchResult> {
  const bodyText = await response.text();
  return {
    status: response.status,
    header: (name) => response.headers.get(name) ?? undefined,
    setCookies: () => response.headers.getSetCookie(),
    text: () => bodyText,
  };
}

/** Run `body` against a freshly served listener, always closing it afterwards. */
async function withServer<T>(
  app: Application,
  options: { timeout?: number },
  body: (server: ServerInstance) => Promise<T>
): Promise<T> {
  const server = await serve(app, { port: 0, host: '127.0.0.1', ...options });
  try {
    return await body(server);
  } finally {
    await server.close();
  }
}

/** Real-Deno ConformanceDriver: every dispatch hits a real `Deno.serve()` listener. */
const realDenoDriver: ConformanceDriver = {
  name: 'deno',
  transport: 'socket',
  runtimeFidelity: 'real-runtime',
  handlerTimeout504: true,
  teardownOnShutdown: true,
  transportAbortFiresSignal: true,
  honorsCloudflareIp: false,

  async dispatch(configure: Configure, init?: DispatchInit): Promise<DispatchResult> {
    const app = buildConformanceApp(init);
    configure(app);
    if (init?.beforeBoot === true) {
      // The documented Web form with no explicit boot: `Deno.serve` takes the
      // handler directly and `ready()` is deliberately NOT awaited, so the entry
      // point has to boot the application itself.
      const server = Deno.serve({
        port: 0,
        hostname: '127.0.0.1',
        handler: createHandler(app),
      });
      try {
        return await toResult(await rawFetch(server.addr.port, init));
      } finally {
        await server.shutdown();
      }
    }
    return await withServer(app, {}, async (server) => {
      const response = await rawFetch(server.port, init);
      return await toResult(response);
    });
  },

  async abortFiresSignal(): Promise<boolean> {
    let fired = false;
    const app = createApp();
    app.use(async (ctx) => {
      const signal = ctx.signal; // arm the request-abort listener
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

    return await withServer(app, {}, async (server) => {
      const controller = new AbortController();
      const pending = fetch(`http://127.0.0.1:${String(server.port)}/`, {
        signal: controller.signal,
      }).catch(() => undefined);
      setTimeout(() => {
        controller.abort(); // client disconnect → Deno aborts the request signal
      }, 10);
      await pending;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return fired;
    });
  },

  async timeoutResult(): Promise<{ status: number; signalFired: boolean }> {
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

    return await withServer(app, { timeout: 10 }, async (server) => {
      const response = await rawFetch(server.port);
      return { status: response.status, signalFired };
    });
  },
};

defineConformanceSuite(realDenoDriver);

Deno.test('proof levels', () => {
  console.log(scenarioReport());
  expect(scenarioRecords().length).toBeGreaterThan(0);
});
