/**
 * Integration: response streaming over a real Node HTTP server.
 *
 * Proves the @nextrush/stream wiring works end-to-end through NodeContext's
 * signal + sendStream primitives — real sockets, real chunked transfer, real
 * client-side consumption. The Node adapter is the eager-pump model; the web
 * adapters (Bun/Deno/Edge) share the identical StreamController/writer code path
 * and differ only in the sendStream primitive (covered by @nextrush/stream unit
 * tests + adapter typecheck).
 */

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NodeContext } from '../context';

let server: Server;
let baseUrl: string;

/** Spin up a server that routes each request to the provided handler. */
function serve(handler: (ctx: NodeContext) => Promise<void>): Promise<void> {
  server = createServer((req, res) => {
    const ctx = new NodeContext(req, res);
    void handler(ctx).catch(() => {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end();
      }
    });
  });
  return new Promise((resolve) => {
    server.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
}

afterEach(() => {
  return new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('Node streaming integration', () => {
  it('streams incremental text with chunked transfer encoding', async () => {
    await serve(async (ctx) => {
      await ctx.stream(async (writer) => {
        await writer.write('chunk-1;');
        await writer.write('chunk-2;');
        await writer.write('chunk-3;');
      });
    });

    const res = await fetch(baseUrl);
    expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(await res.text()).toBe('chunk-1;chunk-2;chunk-3;');
  });

  it('streams Server-Sent Events with correct framing and headers', async () => {
    await serve(async (ctx) => {
      await ctx.sse(async (writer) => {
        await writer.write({ data: 'hello' });
        await writer.write({ data: 'world', event: 'token', id: '1' });
      });
    });

    const res = await fetch(baseUrl);
    expect(res.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
    expect(res.headers.get('cache-control')).toBe('no-cache');
    expect(await res.text()).toBe('data: hello\n\nevent: token\nid: 1\ndata: world\n\n');
  });

  it('streams NDJSON one object per line', async () => {
    await serve(async (ctx) => {
      await ctx.ndjson(async (writer) => {
        await writer.write({ n: 1 });
        await writer.write({ n: 2 });
      });
    });

    const res = await fetch(baseUrl);
    expect(res.headers.get('content-type')).toBe('application/x-ndjson; charset=utf-8');
    expect(await res.text()).toBe('{"n":1}\n{"n":2}\n');
  });

  it('consumes an async generator (LLM-SDK-shaped source)', async () => {
    async function* tokens() {
      yield 'The ';
      yield 'quick ';
      yield 'fox';
    }
    await serve(async (ctx) => {
      await ctx.sse(async (writer) => {
        await writer.consume(tokens());
      });
    });

    const res = await fetch(baseUrl);
    expect(await res.text()).toBe('data: The \n\ndata: quick \n\ndata: fox\n\n');
  });

  it('exposes ctx.signal that aborts when the client disconnects mid-stream', async () => {
    let observedAbort = false;

    await serve(async (ctx) => {
      await ctx.stream(async (writer) => {
        writer.onAbort(() => {
          observedAbort = true;
        });
        await writer.write('start;');
        // Keep the stream open long enough for the client to hang up.
        for (let i = 0; i < 50 && !writer.aborted; i++) {
          await writer.write(`tick-${i};`);
          await new Promise((r) => setTimeout(r, 20));
        }
      });
    });

    // Start reading, then abort the request early.
    const controller = new AbortController();
    const res = await fetch(baseUrl, { signal: controller.signal });
    const reader = res.body!.getReader();
    await reader.read(); // receive the first chunk(s)
    controller.abort();
    await reader.cancel().catch(() => undefined);

    // Give the server loop a moment to observe the socket close.
    await new Promise((r) => setTimeout(r, 100));
    expect(observedAbort).toBe(true);
  });
});
