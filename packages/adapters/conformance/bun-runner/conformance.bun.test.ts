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
 * `preload.mjs` (wired via `bunfig.toml`) redirects the conformance package's
 * internal `./test-primitives` import to Bun's own `it`/`expect`
 * (`test-primitives.bun.mjs`), so `defineConformanceSuite` registers its
 * assertions through Bun's real test runner.
 *
 * Run: cd packages/adapters/conformance/bun-runner && bun test
 */

import { afterEach, describe, expect, test } from 'bun:test';
import { createApp } from '@nextrush/core';
import { serve } from '@nextrush/adapter-bun';
import type { ServerInstance } from '@nextrush/adapter-bun';
import { detectRuntime } from '@nextrush/runtime';
import { defineConformanceSuite } from '@nextrush/adapter-conformance';
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

/** Real-Bun ConformanceDriver: every dispatch spins a real `serve()` and hits it over the network. */
const realBunDriver: ConformanceDriver = {
  name: 'bun',
  handlerTimeout504: true,
  teardownOnShutdown: true,
  transportAbortFiresSignal: true,
  honorsCloudflareIp: false,

  async dispatch(configure: Configure, init?: DispatchInit): Promise<DispatchResult> {
    const app = createApp({ proxy: init?.proxy ?? false });
    configure(app);
    const server = await serve(app, { port: 0 });
    try {
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
};

describe('bun adapter — full cross-adapter conformance suite on real Bun', () => {
  defineConformanceSuite(realBunDriver);
});
