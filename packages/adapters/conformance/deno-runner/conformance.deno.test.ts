/**
 * Real-runtime conformance — Deno (F-01, ADR-0010).
 *
 * Runs the FULL shared `defineConformanceSuite` — not a hand-written subset —
 * against the Deno adapter's real request handler under the REAL Deno runtime
 * (`deno test`). Every behavior the in-process suite asserts (Set-Cookie
 * arrays, HEAD/204/304 suppression, redirect, error-no-leak, timeout/504, IP
 * precedence, streaming, SSE, body limits, etc.) is proven on real Deno,
 * closing the "claim outruns proof" gap the runtime-platform review (F-01)
 * identified — the previous version of this file asserted only 5 basic cases.
 *
 * `deno.json`'s import map redirects the conformance package's
 * `@nextrush/adapter-conformance/test-primitives` specifier to a Deno-native
 * `it`/`expect` (`test-primitives.deno.ts`, backed by `Deno.test` + `@std/
 * expect`), so `defineConformanceSuite` registers its assertions through
 * Deno's real test runner.
 *
 * The Deno adapter's `createHandler` is driven directly (not through a live
 * `Deno.serve()` socket) — matching this file's pre-existing pattern and
 * `web-driver.ts`'s rationale: the handler is the runtime-neutral seam; the
 * Deno-specific piece under test is the REAL Deno runtime executing that
 * handler (URL parsing, Headers, ReadableStream, AbortSignal, crypto — all
 * real Deno implementations), not the loopback transport.
 *
 * Run: cd packages/adapters/conformance/deno-runner && deno task conformance
 */

import { createApp, type Application } from '@nextrush/core';
import { createHandler } from '@nextrush/adapter-deno';
import { detectRuntime } from '@nextrush/runtime';
import { defineConformanceSuite } from '@nextrush/adapter-conformance';
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

/** Build a Web Request from the dispatch spec. */
function buildRequest(init?: DispatchInit): Request {
  const requestInit: RequestInit = {
    method: init?.method ?? 'GET',
    headers: init?.headers,
  };
  if (init?.body !== undefined) requestInit.body = init.body;
  return new Request(`http://localhost${init?.path ?? '/'}`, requestInit);
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

/** Real-Deno ConformanceDriver: drives the real Deno adapter handler under the real Deno runtime. */
const realDenoDriver: ConformanceDriver = {
  name: 'deno',
  handlerTimeout504: true,
  teardownOnShutdown: true,
  transportAbortFiresSignal: true,
  honorsCloudflareIp: false,

  async dispatch(configure: Configure, init?: DispatchInit): Promise<DispatchResult> {
    const app: Application = createApp({ proxy: init?.proxy ?? false });
    configure(app);
    await app.ready();
    const handler = createHandler(app, {});
    const response = await handler(buildRequest(init), {
      remoteAddr: { hostname: init?.directIp ?? '127.0.0.1', port: 0 },
    });
    return toResult(response);
  },

  async abortFiresSignal(): Promise<boolean> {
    let fired = false;
    const controller = new AbortController();
    const app = createApp();
    app.use(async (ctx) => {
      const signal = ctx.signal;
      if (signal.aborted) {
        fired = true;
        return;
      }
      await new Promise<void>((resolve) => {
        signal.addEventListener('abort', () => {
          fired = true;
          resolve();
        }, { once: true });
      });
    });
    await app.ready();
    const handler = createHandler(app, {});
    const request = buildRequest({ path: '/' });
    Object.defineProperty(request, 'signal', { value: controller.signal });
    const pending = handler(request, { remoteAddr: { hostname: '127.0.0.1', port: 0 } });
    setTimeout(() => controller.abort(), 5);
    await pending.catch(() => undefined);
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
    await app.ready();
    const handler = createHandler(app, { timeout: 10 });
    const response = await handler(buildRequest({ path: '/' }), {
      remoteAddr: { hostname: '127.0.0.1', port: 0 },
    });
    return { status: response.status, signalFired };
  },
};

defineConformanceSuite(realDenoDriver);
