/**
 * @nextrush/adapter-node — BP-K: graceful mid-stream body-limit rejection.
 *
 * When a *chunked* (no Content-Length) body exceeds the caller limit, the breach is
 * detected mid-read. The adapter must still deliver a well-formed 413 to the client
 * rather than tearing the socket down first (which surfaced as ECONNRESET / "socket
 * hang up"). Driven end-to-end through a real loopback server so the socket behavior
 * is observed exactly as a client sees it.
 */

import { createApp } from '@nextrush/core';
import { request as httpRequest } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { serve, type ServerInstance } from '../adapter';

let server: ServerInstance | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

/**
 * POST a body with NO Content-Length (Node sends it chunked). Resolves with the
 * response status on a 'response' event, or with a transport error code if the
 * connection is reset before any response arrives.
 */
function postChunked(
  port: number,
  body: string
): Promise<{ status: number } | { error: string }> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: { status: number } | { error: string }): void => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };
    const req = httpRequest(
      {
        host: '127.0.0.1',
        port,
        method: 'POST',
        path: '/',
        headers: { 'content-type': 'text/plain' }, // no content-length → chunked
      },
      (res) => {
        res.resume(); // drain the response body
        done({ status: res.statusCode ?? 0 });
      }
    );
    req.on('error', (e: NodeJS.ErrnoException) => done({ error: e.code ?? e.message }));
    req.write(body);
    req.end();
  });
}

describe('BP-K — graceful mid-stream body-limit rejection', () => {
  it('a chunked over-limit body receives a 413, not a connection reset', async () => {
    const app = createApp();
    app.use(async (ctx) => {
      try {
        await ctx.bodySource.buffer(1024); // 1 KB caller limit
        ctx.status = 200;
        ctx.send('accepted');
      } catch (err) {
        ctx.status = (err as { status?: number }).status ?? 413;
        ctx.json({ error: 'Payload Too Large' });
      }
    });
    server = await serve(app, { port: 0 });

    // 8 KB body, no Content-Length: the client sends it all, then awaits the
    // response — the breach is detected mid-read on the server.
    const result = await postChunked(server.port, 'x'.repeat(8192));

    expect(result).toEqual({ status: 413 });
  });

  it('sets Connection: close on the over-limit response (no keep-alive drain)', async () => {
    const app = createApp();
    app.use(async (ctx) => {
      try {
        await ctx.bodySource.buffer(1024);
        ctx.send('accepted');
      } catch {
        ctx.status = 413;
        ctx.json({ error: 'Payload Too Large' });
      }
    });
    server = await serve(app, { port: 0 });

    const header = await new Promise<string | undefined>((resolve) => {
      const req = httpRequest(
        {
          host: '127.0.0.1',
          port: server!.port,
          method: 'POST',
          path: '/',
          headers: { 'content-type': 'text/plain' },
        },
        (res) => {
          res.resume();
          resolve(res.headers.connection);
        }
      );
      req.on('error', () => resolve(undefined));
      req.write('y'.repeat(8192));
      req.end();
    });

    expect(header).toBe('close');
  });
});
