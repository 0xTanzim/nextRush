/**
 * Real-runtime conformance — Bun (runtime-proof-harness, R2 / task group 3).
 *
 * Runs the Bun adapter's real request handler under the REAL Bun runtime
 * (`bun test`), through a real `Bun.serve()` server hit over the network —
 * not a bare in-process function call. Bun's fetch handler signature is
 * `(request, server) => Response`, where `server` is Bun's own live `Server`
 * instance; calling the handler function directly with no server throws
 * (`server.requestIP()` assumes a real connection) — a bare-call approach
 * would silently mask this and defeat the point of a *real*-runtime runner.
 * Asserts the same core observable behaviors the cross-adapter suite pins,
 * mirroring deno-runner/conformance.deno.test.ts's structure and test cases
 * so Bun and Deno are held to the identical observable contract.
 *
 * Run: cd packages/adapters/conformance/bun-runner && bun test
 */

import { afterEach, describe, expect, test } from 'bun:test';
import { createApp } from '@nextrush/core';
import { serve } from '@nextrush/adapter-bun';
import type { ServerInstance } from '@nextrush/adapter-bun';
import { detectRuntime } from '@nextrush/runtime';

let instance: ServerInstance | undefined;

afterEach(async () => {
  await instance?.close();
  instance = undefined;
});

/**
 * Drive one request through a REAL `Bun.serve()` server built by the real
 * adapter. Bun's fetch handler signature is `(request, server) => Response`
 * — `server` is Bun's own `Server` instance, only present when Bun itself
 * invokes the handler for a live connection. Calling the handler function
 * directly (bare, with no server) is a Node-simulation shortcut that does
 * NOT reproduce Bun's real contract and silently hides a real Bun-specific
 * bug (`server.requestIP()` throws when `server` is undefined) — discovered
 * while authoring this runner. Starting a real server and making a real
 * network request is what actually proves Bun parity.
 */
async function dispatch(
  configure: (app: ReturnType<typeof createApp>) => void,
  init?: { method?: string; path?: string; headers?: Record<string, string>; body?: string }
): Promise<Response> {
  const app = createApp();
  configure(app);
  instance = await serve(app, { port: 0 });
  const res = await fetch(`http://localhost:${instance.port}${init?.path ?? '/'}`, {
    method: init?.method ?? 'GET',
    headers: init?.headers,
    ...(init?.body !== undefined ? { body: init.body } : {}),
  });
  return res;
}

describe('real Bun conformance', () => {
  test('runs under the real Bun runtime', () => {
    expect(detectRuntime()).toBe('bun');
  });

  test('#1 method upper-cased; path split from query', async () => {
    const res = await dispatch(
      (app) => {
        app.use((ctx) => {
          ctx.json({ method: ctx.method, path: ctx.path });
        });
      },
      { method: 'get', path: '/users/5?x=1' }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { method: string; path: string };
    expect(body.method).toBe('GET');
    expect(body.path).toBe('/users/5');
  });

  test('#2 query repeats become arrays; __proto__ rejected', async () => {
    const res = await dispatch(
      (app) => {
        app.use((ctx) => {
          ctx.json({ a: ctx.query.a, b: ctx.query.b });
        });
      },
      { path: '/q?a=1&b=2&b=3&__proto__=evil' }
    );
    const body = (await res.json()) as { a: string; b: string[] };
    expect(body.a).toBe('1');
    expect(body.b).toEqual(['2', '3']);
    expect((Object.prototype as Record<string, unknown>).evil).toBeUndefined();
  });

  test('#3 route params writable + readable across middleware', async () => {
    const res = await dispatch((app) => {
      app.use(async (ctx) => {
        ctx.params = { id: '42' };
        await ctx.next();
      });
      app.use((ctx) => {
        ctx.json({ id: ctx.params.id });
      });
    });
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe('42');
  });

  test('#4 JSON body parsed on POST', async () => {
    const res = await dispatch(
      (app) => {
        app.use(async (ctx) => {
          const raw = await ctx.bodySource.text();
          ctx.json({ echo: JSON.parse(raw) as unknown });
        });
      },
      {
        method: 'POST',
        path: '/echo',
        headers: { 'content-type': 'application/json' },
        body: '{"n":7}',
      }
    );
    const body = (await res.json()) as { echo: { n: number } };
    expect(body.echo.n).toBe(7);
  });

  test('#16 thrown HttpError maps to status; body not leaked as 500', async () => {
    const res = await dispatch((app) => {
      app.use((ctx) => {
        ctx.throw(404, 'nope');
      });
    });
    expect(res.status).toBe(404);
  });
});
