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
import { connect, type Socket } from 'node:net';
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

  describe('backpressured disconnect (F-01)', () => {
    /**
     * Opens a raw TCP socket to the running server, sends a minimal HTTP/1.1
     * request, and never reads the response — so the socket's OS receive
     * buffer plus Node's internal write buffer fill up and `res.write()`
     * starts returning `false` (backpressure) once the handler writes enough
     * bytes. Returns the socket so the test can `destroy()` it mid-stream.
     */
    function openStalledClient(path = '/'): Promise<Socket> {
      const { port } = server.address() as AddressInfo;
      return new Promise((resolve, reject) => {
        const socket = connect({ port, host: '127.0.0.1' }, () => {
          socket.write(`GET ${path} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: keep-alive\r\n\r\n`);
          resolve(socket);
        });
        socket.on('error', reject);
        // Never call socket.resume()/on('data') — leave the buffer un-drained
        // so the socket fills and the server's res.write() backs up.
        socket.pause();
      });
    }

    it('settles the handler promise quickly when the client disconnects while parked on drain', async () => {
      let finallyRan = false;
      let settleMs = -1;
      const start = Date.now();

      await serve(async (ctx) => {
        try {
          await ctx.sse(async (writer) => {
            // Feed chunks continuously with no exit condition of its own —
            // the ONLY way this loop ends is the abort signal firing while
            // parked on backpressure (StreamController re-checks the signal
            // after a pull-wait), or the enclosing sendStream pump rejecting.
            // A bounded-iteration or `writer.aborted`-gated loop would let the
            // test pass by racing the disconnect away instead of proving the
            // drain-wait itself unblocks.
            const chunk = 'x'.repeat(64 * 1024);
            for (;;) {
              await writer.write({ data: chunk });
            }
          });
        } finally {
          finallyRan = true;
          settleMs = Date.now() - start;
        }
      });

      const socket = await openStalledClient();
      // Give the pump a moment to actually hit backpressure (res.write() === false)
      // and park on 'drain' before yanking the connection out from under it.
      await new Promise((r) => setTimeout(r, 80));
      socket.destroy();

      // Poll for the finally to run instead of a single fixed sleep, so the
      // assertion is about settle latency, not test-timing luck.
      const deadline = Date.now() + 2000;
      while (!finallyRan && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 10));
      }

      expect(finallyRan).toBe(true);
      // "Milliseconds, not hang" per the done predicate — generous bound to
      // absorb CI jitter while still failing fast on an actual indefinite hang.
      expect(settleMs).toBeGreaterThanOrEqual(0);
      expect(settleMs).toBeLessThan(1000);
    });

    it('settles sendStream() directly (Web ReadableStream branch) on client disconnect while parked on drain', async () => {
      let settled = false;
      let settleMs = -1;
      const start = Date.now();

      await serve(async (ctx) => {
        const chunk = new TextEncoder().encode('x'.repeat(64 * 1024));
        const readable = new ReadableStream<Uint8Array>({
          pull(controller) {
            // Feed unconditionally, forever — same rationale as above: no
            // self-terminating condition, so settling depends entirely on the
            // adapter's drain-wait observing the disconnect.
            controller.enqueue(chunk);
          },
        });
        try {
          await ctx.sendStream(readable);
        } catch {
          // Expected on disconnect — the assertion is about settle time.
        } finally {
          settled = true;
          settleMs = Date.now() - start;
        }
      });

      const socket = await openStalledClient();
      await new Promise((r) => setTimeout(r, 80));
      socket.destroy();

      const deadline = Date.now() + 2000;
      while (!settled && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 10));
      }

      expect(settled).toBe(true);
      expect(settleMs).toBeLessThan(1000);
    });
  });
});
