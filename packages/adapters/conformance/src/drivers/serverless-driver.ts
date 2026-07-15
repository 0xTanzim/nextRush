/**
 * Serverless-adapter conformance driver (task group 8).
 *
 * Drives the SAME cross-adapter assertions through `createLambdaHandler` — the
 * real Tier-1 public handler — by converting the suite's `DispatchInit` into an
 * API Gateway v2 / Lambda Function URL event, running it, and normalizing the
 * platform result back into a `DispatchResult`. This proves the serverless
 * adapter behaves identically to node/bun/deno/edge for request/response
 * semantics (it reuses the edge execution engine underneath).
 *
 * Two behaviors are legitimately different and encoded as capability flags
 * (never skipped), matching how Node's socket-level timeout is handled:
 *  - `teardownOnShutdown: false` — like edge, a serverless invocation has no
 *    server lifetime, so extension `destroy()` never runs (F-14).
 *  - `transportAbortFiresSignal: false` — the platform delivers a fully-buffered
 *    event, so there is no mid-request transport abort; cancellation is
 *    timeout-driven (#13), where `ctx.signal` still fires (proven below).
 *
 * @packageDocumentation
 */

import { createLambdaHandler, type LambdaEvent, type LambdaResult } from '@nextrush/adapter-serverless';
import { createApp } from '@nextrush/core';
import type { Configure, ConformanceDriver, DispatchInit, DispatchResult } from './types';

/** Build an API Gateway v2 event from the dispatch spec. */
function toEvent(init?: DispatchInit): LambdaEvent {
  const [rawPath = '/', rawQueryString = ''] = (init?.path ?? '/').split('?');
  const event: LambdaEvent = {
    version: '2.0',
    rawPath,
    rawQueryString,
    requestContext: { http: { method: init?.method ?? 'GET', sourceIp: init?.directIp } },
    headers: init?.headers ?? {},
    isBase64Encoded: false,
  };
  if (init?.body !== undefined) event.body = init.body;
  return event;
}

/** Normalize a Lambda v2 result into a runtime-agnostic result. */
function toResult(result: LambdaResult): DispatchResult {
  // v2FromResponse lower-cases header names; the v2 result carries Set-Cookie
  // via `cookies`. (apigwV1 would use multiValueHeaders, but Tier-1 dispatch
  // always produces a v2 event → the lambda-function-url mapper.)
  const headers = result.headers;
  const cookies = 'cookies' in result && Array.isArray(result.cookies) ? result.cookies : [];
  return {
    status: result.statusCode,
    header: (name) => headers[name.toLowerCase()] ?? headers[name],
    setCookies: () => cookies,
    text: () => result.body,
  };
}

export const serverlessDriver: ConformanceDriver = {
  name: 'serverless',
  handlerTimeout504: true, // reuses the edge engine's timeout→504 race (F-08)
  teardownOnShutdown: false, // no server lifetime, like edge (F-14)
  transportAbortFiresSignal: false, // buffered event model — no mid-request transport abort

  async dispatch(configure: Configure, init?: DispatchInit): Promise<DispatchResult> {
    const app = createApp({ proxy: init?.proxy ?? false });
    configure(app);
    await app.ready(); // idempotent; the handler boots lazily too
    const handler = createLambdaHandler(app);
    const result = await handler(toEvent(init));
    return toResult(result);
  },

  abortFiresSignal(): Promise<boolean> {
    // No mid-request transport to abort in the buffered event model. Cancellation
    // is timeout-driven and proven by timeoutResult() (#13). Encoded, not skipped.
    return Promise.resolve(false);
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
    await app.ready();
    const handler = createLambdaHandler(app, { timeout: 10 });
    const result = await handler(toEvent({ path: '/' }));
    return { status: result.statusCode, signalFired };
  },
};
