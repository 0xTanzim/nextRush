/**
 * @nextrush/adapter-node — Chunked trailers, keep-alive reuse, and pipelining
 * (`audit-unreviewed-security-surface`, area 1: Node request-parsing gap).
 *
 * `raw-socket-malformed-request.test.ts` (WS-F) covers header-block framing
 * ambiguity (conflicting Content-Length/Transfer-Encoding, duplicate Host).
 * This suite covers three areas that file explicitly does not: whether a
 * chunked request's trailer section can smuggle a header the framework never
 * sees on the initial pass, whether a keep-alive connection correctly starts
 * a fresh, isolated request/response cycle for its second request (no state
 * bleed from the first), and whether Node's own response-ordering guarantee
 * for pipelined requests actually holds through this adapter's `wrappedHandler`
 * (which delegates straight to `handler(req, res)` with no reordering logic
 * of its own — the claim under test, not assumed).
 */
import { createApp } from '@nextrush/core';
import { connect, type Socket } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { serve, type ServerInstance } from '../adapter';

let server: ServerInstance | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

function statusOf(data: string): number | undefined {
  const match = /^HTTP\/1\.[01] (\d{3})/.exec(data);
  return match?.[1] ? Number(match[1]) : undefined;
}

function collectFor(socket: Socket, ms: number): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    socket.on('data', (chunk: Buffer) => chunks.push(chunk));
    setTimeout(() => resolve(Buffer.concat(chunks).toString('utf8')), ms);
  });
}

describe('Chunked-encoding trailers', () => {
  it('a trailer header sent after the final chunk is not surfaced as a request header the handler can read', async () => {
    const app = createApp();
    let sawTrailerAsHeader = false;
    app.use(async (ctx) => {
      if (ctx.get('x-trailer-secret') !== undefined) sawTrailerAsHeader = true;
      ctx.json({ ok: true });
    });
    server = await serve(app, { port: 0 });
    const port = server.port;

    const raw =
      'POST / HTTP/1.1\r\n' +
      'Host: 127.0.0.1\r\n' +
      'Transfer-Encoding: chunked\r\n' +
      'TE: trailers\r\n' +
      '\r\n' +
      '5\r\nhello\r\n' +
      '0\r\n' +
      'X-Trailer-Secret: smuggled\r\n' +
      '\r\n';

    const data = await new Promise<string>((resolve) => {
      const socket: Socket = connect({ host: '127.0.0.1', port });
      socket.on('connect', () => socket.write(raw));
      collectFor(socket, 500).then(resolve);
    });

    // Observed: NextRush never reads `req.trailers` anywhere in the adapter
    // (confirmed via source read, area 1.1) — a trailer is Node's own
    // post-body event, delivered after `ctx.get()`'s header snapshot is
    // already built from `req.headers`. This asserts that absence holds.
    expect(sawTrailerAsHeader).toBe(false);
    expect(statusOf(data)).toBe(200);
  });
});

describe('Keep-alive connection reuse', () => {
  it('a second request on a reused keep-alive socket gets its own independent context, not the first request\'s state', async () => {
    const app = createApp();
    app.use(async (ctx) => {
      // Deliberately read something request-specific (the path) so a state
      // leak from request 1 into request 2 would be observable as a wrong
      // path in the second response.
      ctx.json({ path: ctx.path });
    });
    server = await serve(app, { port: 0 });
    const port = server.port;

    const data = await new Promise<string>((resolve) => {
      const socket: Socket = connect({ host: '127.0.0.1', port });
      socket.on('connect', () => {
        socket.write('GET /first HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: keep-alive\r\n\r\n');
      });
      let sentSecond = false;
      socket.on('data', () => {
        if (!sentSecond) {
          sentSecond = true;
          socket.write('GET /second HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n');
        }
      });
      collectFor(socket, 1000).then(resolve);
    });

    // Both responses land on the same socket back-to-back; the second body
    // must reflect the second request's own path, never the first's.
    const responses = data.split('HTTP/1.1').filter((s) => s.length > 0);
    expect(responses.length).toBe(2);
    expect(data).toContain('"path":"/first"');
    expect(data).toContain('"path":"/second"');
  });
});

describe('Pipelined requests (response ordering)', () => {
  it('responses to two pipelined requests on one socket arrive in request order, even when the first handler is slower', async () => {
    const app = createApp();
    app.use(async (ctx) => {
      if (ctx.path === '/slow') {
        // Deliberately delay the FIRST request's response so a
        // reordering bug (second response flushed before the first)
        // would be observable.
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      ctx.json({ path: ctx.path });
    });
    server = await serve(app, { port: 0 });
    const port = server.port;

    const data = await new Promise<string>((resolve) => {
      const socket: Socket = connect({ host: '127.0.0.1', port });
      socket.on('connect', () => {
        // Both requests written back-to-back before either response
        // arrives — genuine HTTP pipelining, not sequential request/response.
        socket.write(
          'GET /slow HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: keep-alive\r\n\r\n' +
            'GET /fast HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n'
        );
      });
      collectFor(socket, 1000).then(resolve);
    });

    const firstSlowIdx = data.indexOf('"path":"/slow"');
    const firstFastIdx = data.indexOf('"path":"/fast"');
    expect(firstSlowIdx).toBeGreaterThanOrEqual(0);
    expect(firstFastIdx).toBeGreaterThanOrEqual(0);
    // The /slow response (request order 1) must appear before /fast (order
    // 2) in the byte stream, even though /fast's handler finishes first —
    // this is Node's own pipeline queue, not something NextRush implements,
    // and this test verifies that guarantee actually holds through this
    // adapter's wrappedHandler rather than assuming it.
    expect(firstSlowIdx).toBeLessThan(firstFastIdx);
  });
});
