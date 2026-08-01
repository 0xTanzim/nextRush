/**
 * Next.js App Router adapter conformance driver (RFC-024).
 *
 * Drives the SAME cross-adapter assertions through `handle()` — the real
 * public bridge — by building a synthetic `Request` from the suite's
 * `DispatchInit` and dispatching it exactly as a Next.js route handler would.
 * This proves the Next.js bridge behaves identically to node/bun/deno/edge for
 * request/response semantics — expected, since it adds no execution model of
 * its own and reuses the edge engine unmodified (RFC-024 §7.4).
 *
 * Mirrors `serverless-driver.ts`'s in-process pattern rather than spinning a
 * real runtime process: there is no separate "Next.js runtime" to prove
 * against — Next.js itself runs on Node or, via OpenNext, on workerd, both of
 * which already have real-runtime runners in this suite (`bun-runner`,
 * `deno-runner`, `workerd-runner`). What is specific to this package, and
 * therefore what this driver actually needs to prove, is that `handle()`
 * forwards the request unmodified and wires the seven methods identically —
 * exactly what the shared suite's request/response assertions already check.
 *
 * @packageDocumentation
 */

import { handle } from '@nextrush/adapter-nextjs';
import { createApp } from '@nextrush/core';
import type { Configure, ConformanceDriver, DispatchInit, DispatchResult } from './types';

const BASE_URL = 'http://127.0.0.1';

/** Build a synthetic `Request` from the dispatch spec, as Next.js would pass one. */
function toRequest(init?: DispatchInit): Request {
  const method = (init?.method ?? 'GET').toUpperCase();
  const hasBody = init?.body !== undefined && method !== 'GET' && method !== 'HEAD';
  return new Request(new URL(init?.path ?? '/', BASE_URL), {
    method,
    headers: init?.headers,
    ...(hasBody ? { body: init.body } : {}),
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

export const nextjsDriver: ConformanceDriver = {
  name: 'nextjs',
  handlerTimeout504: true, // reuses the edge engine's timeout→504 race (F-08)
  teardownOnShutdown: false, // no server lifetime, like edge (F-14) — handle() never calls close()
  transportAbortFiresSignal: true, // the forwarded Request's own .signal aborts, same as edge
  honorsCloudflareIp: true, // reuses the edge context → cf-connecting-ip precedence (F-11)

  async dispatch(configure: Configure, init?: DispatchInit): Promise<DispatchResult> {
    const app = createApp({ proxy: init?.proxy ?? false });
    configure(app);
    const { GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS } = handle(app);
    const methods = { GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS } as const;
    const method = (init?.method ?? 'GET').toUpperCase() as keyof typeof methods;
    const handler = methods[method];
    const response = await handler(toRequest(init), { params: Promise.resolve({}) });
    const bodyText = await response.text();
    return toResult(response, bodyText);
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
        signal.addEventListener(
          'abort',
          () => {
            fired = true;
            resolve();
          },
          { once: true },
        );
      });
    });
    const { GET } = handle(app);
    const controller = new AbortController();
    const request = new Request(new URL('/', BASE_URL), { signal: controller.signal });
    const pending = GET(request, { params: Promise.resolve({}) }).catch(() => undefined);
    setTimeout(() => {
      controller.abort();
    }, 10);
    await pending;
    await new Promise((resolve) => setTimeout(resolve, 20));
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
          { once: true },
        );
      });
    });
    const { GET } = handle(app, { timeout: 10 });
    const response = await GET(new Request(new URL('/', BASE_URL)), { params: Promise.resolve({}) });
    return { status: response.status, signalFired };
  },
};
