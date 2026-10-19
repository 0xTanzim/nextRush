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
import { detectRuntime, getRuntimeCapabilities } from '@nextrush/runtime';
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

const ENCODER = new TextEncoder();

/** Read a raw socket to EOF (only used by requests that send `Connection: close`). */
async function readToEof(conn: Deno.TcpConn): Promise<string> {
  const decoder = new TextDecoder();
  const buffer = new Uint8Array(4096);
  let raw = '';
  for (;;) {
    const read = await conn.read(buffer);
    if (read === null) return raw;
    raw += decoder.decode(buffer.subarray(0, read), { stream: true });
  }
}

/**
 * Decode a chunked body.
 *
 * @remarks
 * Byte-oriented, so it assumes an ASCII body — which is all the scenarios routed
 * through here produce (a status body, never user content).
 */
function decodeChunked(raw: string): string {
  let decoded = '';
  let index = 0;
  while (index < raw.length) {
    const sizeEnd = raw.indexOf('\r\n', index);
    if (sizeEnd === -1) break;
    const size = Number.parseInt(raw.slice(index, sizeEnd), 16);
    if (!Number.isFinite(size) || size === 0) break;
    decoded += raw.slice(sizeEnd + 2, sizeEnd + 2 + size);
    index = sizeEnd + 2 + size + 2; // the chunk, then its trailing CRLF
  }
  return decoded;
}

/** Split a raw HTTP/1.1 response into a `DispatchResult`. */
function parseHttpResponse(raw: string): DispatchResult {
  const separator = raw.indexOf('\r\n\r\n');
  const head = separator === -1 ? raw : raw.slice(0, separator);
  const rawBody = separator === -1 ? '' : raw.slice(separator + 4);

  const lines = head.split('\r\n');
  const status = Number.parseInt((lines[0] ?? '').split(' ')[1] ?? '0', 10);

  const headers = new Map<string, string[]>();
  for (const line of lines.slice(1)) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const name = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    const existing = headers.get(name);
    if (existing === undefined) {
      headers.set(name, [value]);
    } else {
      existing.push(value);
    }
  }

  const isChunked =
    headers.get('transfer-encoding')?.some((value) => value.toLowerCase().includes('chunked')) ??
    false;

  return {
    status,
    header: (name) => headers.get(name.toLowerCase())?.join(', '),
    setCookies: () => headers.get('set-cookie') ?? [],
    text: () => (isChunked ? decodeChunked(rawBody) : rawBody),
  };
}

/**
 * Send the target in the request line unparsed, for a `verbatimTarget` dispatch.
 *
 * @remarks
 * `fetch` — this driver's transport everywhere else — resolves a dot segment on
 * the client, so the server would never be asked about the target the scenario
 * cares about. Writing the request line over a raw `Deno.connect` socket is also
 * the honest way to observe the platform limit: what arrives here is what the
 * server received, with no client-side shaping in between.
 */
async function verbatimFetch(port: number, init: DispatchInit): Promise<DispatchResult> {
  const conn = await Deno.connect({ hostname: '127.0.0.1', port });
  try {
    const target = init.path ?? '/';
    const body = init.body ?? '';
    const headerLines = Object.entries(init.headers ?? {})
      .map(([name, value]) => `${name}: ${value}\r\n`)
      .join('');

    await conn.write(
      ENCODER.encode(
        `${init.method ?? 'GET'} ${target} HTTP/1.1\r\n` +
          `Host: 127.0.0.1:${String(port)}\r\n` +
          headerLines +
          `content-length: ${String(ENCODER.encode(body).byteLength)}\r\n` +
          'Connection: close\r\n\r\n' +
          body
      )
    );

    return parseHttpResponse(await readToEof(conn));
  } finally {
    try {
      conn.close();
    } catch {
      // The peer already closed after `Connection: close`.
    }
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
  honorsPostHandlerHeaderWrite: true, // the Web request handler records the response
  // The running runtime's own answer: this file runs under `deno test`, so it
  // reports Deno's platform behaviour rather than a value copied from a table.
  rawRequestTarget: getRuntimeCapabilities().rawRequestTarget,

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
      if (init?.verbatimTarget === true) return await verbatimFetch(server.port, init);
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

  async committedResponseOutlivesTimeout(): Promise<{ status: number; body: unknown }> {
    const app = createApp();
    app.use(async (ctx) => {
      ctx.json({ ok: true });
      // Outlives the timeout below: the response is already committed when the
      // timer fires, so the 504 must not replace it.
      await new Promise<void>((resolve) => setTimeout(resolve, 40));
    });

    return await withServer(app, { timeout: 10 }, async (server) => {
      const response = await rawFetch(server.port);
      return { status: response.status, body: await response.json() };
    });
  },
};

defineConformanceSuite(realDenoDriver);

Deno.test('proof levels', () => {
  console.log(scenarioReport());
  expect(scenarioRecords().length).toBeGreaterThan(0);
});
