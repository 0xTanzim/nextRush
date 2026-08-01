/**
 * @nextrush/adapter-node — Raw-socket malformed-request suite (task 8.5,
 * `security-boundaries` capability: "Malformed HTTP requests are covered by
 * a raw-socket suite").
 *
 * Drives a real `net.Socket` directly against a real loopback `serve()`
 * instance — `http.request()` and `fetch()` both normalize away the very
 * malformed states this suite targets (duplicate/conflicting headers,
 * byte-at-a-time transmission), so raw bytes over a raw socket are the only
 * way to observe what Node's own HTTP parser actually does. Every assertion
 * below is against OBSERVED behavior, verified by running each scenario
 * before writing its expectation — none of it is assumed.
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

async function startServer(): Promise<number> {
  const app = createApp();
  app.use(async (ctx) => {
    ctx.json({ ok: true });
  });
  server = await serve(app, { port: 0 });
  return server.port;
}

/** Open a raw socket, write raw bytes, and collect the response (or a socket error/close). */
function rawRequest(
  port: number,
  raw: string,
  opts: { timeoutMs?: number } = {}
): Promise<{ data: string; closed: boolean; error?: string }> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let settled = false;
    const finish = (result: { data: string; closed: boolean; error?: string }): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    const socket: Socket = connect({ host: '127.0.0.1', port });
    const timer = setTimeout(
      () => finish({ data: Buffer.concat(chunks).toString('utf8'), closed: false }),
      opts.timeoutMs ?? 1000
    );

    socket.on('connect', () => socket.write(raw));
    socket.on('data', (chunk: Buffer) => chunks.push(chunk));
    socket.on('close', () => {
      clearTimeout(timer);
      finish({ data: Buffer.concat(chunks).toString('utf8'), closed: true });
    });
    socket.on('error', (err: Error) => {
      clearTimeout(timer);
      finish({ data: Buffer.concat(chunks).toString('utf8'), closed: true, error: err.message });
    });
  });
}

function statusOf(data: string): number | undefined {
  const match = /^HTTP\/1\.[01] (\d{3})/.exec(data);
  return match?.[1] ? Number(match[1]) : undefined;
}

describe('Raw-socket malformed-request suite (task 8.5)', () => {
  it('Content-Length + Transfer-Encoding: chunked together is rejected, never dispatched to the handler', async () => {
    const port = await startServer();
    const raw =
      'POST / HTTP/1.1\r\n' +
      'Host: 127.0.0.1\r\n' +
      'Content-Length: 5\r\n' +
      'Transfer-Encoding: chunked\r\n' +
      '\r\n' +
      '5\r\nhello\r\n0\r\n\r\n';

    const { data, closed } = await rawRequest(port, raw);

    // Observed: Node's own HTTP/1.1 parser rejects this combination before
    // the framework's handler ever runs — either a 400-class response or an
    // immediate connection close, never a 200 from the echo handler above.
    const status = statusOf(data);
    if (status !== undefined) {
      expect(status).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(500);
    } else {
      expect(closed).toBe(true);
    }
    expect(data).not.toContain('"ok":true');
  });

  it('two differing Content-Length headers are rejected, never dispatched to the handler', async () => {
    const port = await startServer();
    const raw =
      'POST / HTTP/1.1\r\n' +
      'Host: 127.0.0.1\r\n' +
      'Content-Length: 5\r\n' +
      'Content-Length: 10\r\n' +
      '\r\n' +
      'hello12345';

    const { data, closed } = await rawRequest(port, raw);

    const status = statusOf(data);
    if (status !== undefined) {
      expect(status).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(500);
    } else {
      expect(closed).toBe(true);
    }
    expect(data).not.toContain('"ok":true');
  });

  it('a missing Host header on HTTP/1.1 is rejected deterministically', async () => {
    const port = await startServer();
    const raw = 'GET / HTTP/1.1\r\n\r\n';

    const { data, closed } = await rawRequest(port, raw);

    const status = statusOf(data);
    if (status !== undefined) {
      expect(status).toBe(400);
    } else {
      expect(closed).toBe(true);
    }
  });

  it('a duplicated Host header is dispatched using the first value — pinned so a silent behavior change is caught', async () => {
    const port = await startServer();
    const raw = 'GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nHost: evil.example\r\n\r\n';

    const { data } = await rawRequest(port, raw);

    // Observed (verified by running this scenario before writing this
    // assertion, not assumed): Node's HTTP/1.1 parser does NOT reject a
    // duplicated Host header — it dispatches the request normally, using
    // the first occurrence. This is Node's own parser behavior, not a
    // NextRush decision; pinning it here means a future Node version that
    // starts rejecting duplicated Host (as some other servers already do)
    // is caught as a deliberate, reviewed change rather than a silent one.
    expect(statusOf(data)).toBe(200);
    expect(data).toContain('"ok":true');
  });

  it('byte-at-a-time header transmission still completes correctly once fully sent (no premature rejection)', async () => {
    const port = await startServer();
    const raw = 'GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n';

    const result = await new Promise<{ data: string }>((resolve) => {
      const chunks: Buffer[] = [];
      const socket: Socket = connect({ host: '127.0.0.1', port });
      socket.on('connect', () => {
        let i = 0;
        const sendNext = (): void => {
          if (i >= raw.length) return;
          socket.write(raw[i] as string);
          i += 1;
          setImmediate(sendNext);
        };
        sendNext();
      });
      socket.on('data', (chunk: Buffer) => chunks.push(chunk));
      socket.on('close', () => resolve({ data: Buffer.concat(chunks).toString('utf8') }));
      socket.on('error', () => resolve({ data: Buffer.concat(chunks).toString('utf8') }));
    });

    expect(statusOf(result.data)).toBe(200);
    expect(result.data).toContain('"ok":true');
  });

  it('an oversized header block is rejected rather than dispatched (431 or connection close)', async () => {
    const port = await startServer();
    // Node's default maxHeaderSize is 16KB; well past it forces the parser's own limit.
    const oversizedValue = 'x'.repeat(64 * 1024);
    const raw = `GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nX-Oversized: ${oversizedValue}\r\n\r\n`;

    const { data, closed } = await rawRequest(port, raw, { timeoutMs: 2000 });

    const status = statusOf(data);
    if (status !== undefined) {
      // Observed: Node responds 431 Request Header Fields Too Large.
      expect(status).toBe(431);
    } else {
      expect(closed).toBe(true);
    }
    expect(data).not.toContain('"ok":true');
  });

  it('a slow, byte-at-a-time client past the server timeout is closed by the server, not left hanging forever', async () => {
    const app = createApp();
    app.use(async (ctx) => {
      ctx.json({ ok: true });
    });
    server = await serve(app, { port: 0, timeout: 300 });
    const port = server.port;

    const result = await new Promise<{ closed: boolean; elapsedMs: number }>((resolve) => {
      const start = Date.now();
      const socket: Socket = connect({ host: '127.0.0.1', port });
      const partial = 'GET / HTTP/1.1\r\nHost: 127.0.0.1\r\n'; // deliberately no terminating CRLF
      socket.on('connect', () => socket.write(partial));
      socket.on('close', () => resolve({ closed: true, elapsedMs: Date.now() - start }));
      socket.on('error', () => resolve({ closed: true, elapsedMs: Date.now() - start }));
      // Safety net so the test itself cannot hang past a generous ceiling.
      setTimeout(() => {
        socket.destroy();
        resolve({ closed: false, elapsedMs: Date.now() - start });
      }, 5000);
    });

    expect(result.closed).toBe(true);
    expect(result.elapsedMs).toBeLessThan(5000);
  });
});
