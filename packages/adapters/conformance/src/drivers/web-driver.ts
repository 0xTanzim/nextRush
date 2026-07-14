/* eslint-disable nextrush/no-runtime-identity-capability -- conformance test driver selects the adapter under test by runtime; not a capability decision */
/**
 * Web-adapter conformance drivers (Bun, Deno, Edge).
 *
 * @remarks
 * Bun/Deno/Edge all produce a Web `Response` from a real handler built over an
 * `Application`. They share one factory; only the handler-construction and the
 * per-runtime "extra" invocation argument differ. Driving the real handler (not
 * just the `Context`) is deliberate — the F-02 header-drop bug lived in the
 * adapter's not-responded finalize path, not in the context.
 *
 * The Web `serve()` entry points need `Bun.serve`/`Deno.serve` globals, so they
 * are NOT exercised here (covered by each adapter's own `adapter.test.ts`); the
 * handler path is the runtime-neutral seam that runs under Node/vitest.
 *
 * @packageDocumentation
 */

import { createHandler as createBunHandler } from '@nextrush/adapter-bun';
import { createHandler as createDenoHandler } from '@nextrush/adapter-deno';
import { createFetchHandler } from '@nextrush/adapter-edge';
import { createApp, type Application } from '@nextrush/core';
import type { Configure, ConformanceDriver, DispatchInit, DispatchResult } from './types';

/** Builds a Web `Response` from an app + request for one specific adapter. */
type WebInvoke = (
  app: Application,
  request: Request,
  options: { timeout?: number },
  directIp: string
) => Promise<Response>;

/** Normalize a Web `Response` (already produced by the adapter) into a result. */
async function toResult(response: Response): Promise<DispatchResult> {
  const bodyText = await response.text();
  return {
    status: response.status,
    header: (name) => response.headers.get(name) ?? undefined,
    setCookies: () => response.headers.getSetCookie(),
    text: () => bodyText,
  };
}

/** Assemble a request URL + init from the dispatch spec. */
function buildRequest(init: DispatchInit | undefined, signal?: AbortSignal): Request {
  const path = init?.path ?? '/';
  const requestInit: RequestInit = {
    method: init?.method ?? 'GET',
    headers: init?.headers,
  };
  if (init?.body !== undefined) requestInit.body = init.body;
  if (signal) requestInit.signal = signal;
  return new Request(`http://localhost${path}`, requestInit);
}

/** Create a conformance driver for a Web adapter. */
function createWebDriver(name: string, invoke: WebInvoke): ConformanceDriver {
  return {
    name,
    handlerTimeout504: true,
    teardownOnShutdown: name !== 'edge', // edge has no teardown seam (F-14)

    async dispatch(configure: Configure, init?: DispatchInit): Promise<DispatchResult> {
      const app = createApp({ proxy: init?.proxy ?? false });
      configure(app);
      // Boot extensions before building the handler so setup() runs first and
      // extension-registered middleware is included (edge boots lazily itself,
      // but ready() is idempotent).
      await app.ready();
      const response = await invoke(app, buildRequest(init), {}, init?.directIp ?? '');
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
      await app.ready();
      const request = buildRequest({ path: '/' }, controller.signal);
      const pending = invoke(app, request, {}, '');
      setTimeout(() => {
        controller.abort();
      }, 5);
      await pending.catch(() => undefined);
      return fired;
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
      await app.ready();
      const response = await invoke(app, buildRequest({ path: '/' }), { timeout: 10 }, '127.0.0.1');
      return { status: response.status, signalFired };
    },
  };
}

export const bunDriver: ConformanceDriver = createWebDriver('bun', (app, request, options, ip) => {
  const handler = createBunHandler(app, options);
  // Bun's fetch handler receives the full `Bun.Server` as its 2nd argument, but
  // the runner only calls `server.requestIP(request)`. A minimal stub is enough
  // for the conformance path; erase the Bun-specific server type at this seam.
  const serverStub = { requestIP: () => ({ address: ip, family: 'IPv4', port: 0 }) };
  return (handler as unknown as (r: Request, s: unknown) => Promise<Response>)(request, serverStub);
});

export const denoDriver: ConformanceDriver = createWebDriver('deno', (app, request, options, ip) => {
  const handler = createDenoHandler(app, options);
  return handler(request, { remoteAddr: { hostname: ip, port: 0 } });
});

export const edgeDriver: ConformanceDriver = createWebDriver('edge', async (app, request, options) => {
  const handler = createFetchHandler(app, options);
  return handler(request);
});
