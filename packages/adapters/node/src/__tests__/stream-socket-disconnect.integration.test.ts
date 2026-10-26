/**
 * @nextrush/adapter-node - Socket-Level Stream Disconnect Integration Test (F-04 Closure)
 *
 * Verifies that when a client forcibly disconnects a TCP socket mid-stream:
 * 1. The response stream and ctx.signal observe the disconnect.
 * 2. Stream cancellation and unwinding follow the supported contract without hanging.
 * 3. No request remains indefinitely pending on the server.
 * 4. No unhandled rejections or unhandled stream controller errors escape.
 * 5. All server and socket resources close cleanly.
 * 6. A subsequent independent request on the same server succeeds immediately.
 */

import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { createServer, request as httpRequest, type Server } from 'node:http';
import { connect, type AddressInfo, type Socket } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createHandler } from '../adapter';

let activeServer: Server | undefined;

afterEach(async () => {
  if (activeServer) {
    await new Promise<void>((resolve) => activeServer?.close(() => resolve()));
    activeServer = undefined;
  }
});

function fetchHealth(port: number): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: '127.0.0.1',
        port,
        path: '/health',
        method: 'GET',
      },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          text += chunk;
        });
        res.on('end', () => {
          resolve({ status: res.statusCode ?? 0, body: text });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

describe('Node Adapter — Socket-Level Stream Disconnect Integration (F-04)', () => {
  it('detects mid-stream TCP client disconnect, unblocks handler, and cleanly serves subsequent requests', async () => {
    const app = createApp({ env: 'test', router: createRouter() });

    let serverObservedAbort = false;
    let onAbortCallbackFired = false;
    let handlerSettled = false;

    let resolveHandlerSettled: (() => void) | undefined;
    const handlerSettledPromise = new Promise<void>((resolve) => {
      resolveHandlerSettled = resolve;
    });

    // 1. Streaming route that outputs chunks and waits for completion or client disconnect
    app.get('/active-stream', async (ctx) => {
      ctx.signal.addEventListener(
        'abort',
        () => {
          serverObservedAbort = true;
        },
        { once: true }
      );

      try {
        await ctx.stream(async (writer) => {
          writer.onAbort(() => {
            onAbortCallbackFired = true;
          });

          // Write initial chunks to confirm active transfer
          await writer.write('chunk-alpha\n');
          await writer.write('chunk-beta\n');

          // Explicit coordination: wait until the client disconnects or safety deadline
          if (!writer.aborted && !ctx.signal.aborted) {
            await new Promise<void>((resolve) => {
              ctx.signal.addEventListener('abort', () => resolve(), { once: true });
            });
          }
        });
      } finally {
        handlerSettled = true;
        resolveHandlerSettled?.();
      }
    });

    // 2. Control route to verify server health post-disconnect
    app.get('/health', (ctx) => {
      ctx.status = 200;
      ctx.json({ status: 'ok', serverAlive: true });
    });

    // Spin up real Node HTTP server using the public createHandler entry point
    const server = createServer(createHandler(app, { timeout: 10_000 }));
    activeServer = server;

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const { port } = server.address() as AddressInfo;

    // Connect via raw TCP socket to simulate an abrupt client drop
    const clientSocket: Socket = await new Promise((resolve, reject) => {
      const sock = connect({ port, host: '127.0.0.1' }, () => resolve(sock));
      sock.on('error', reject);
    });

    const firstChunkReceived = new Promise<string>((resolve) => {
      clientSocket.once('data', (data) => {
        resolve(data.toString('utf8'));
      });
    });

    // Send HTTP/1.1 request
    clientSocket.write('GET /active-stream HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n');

    // Wait until the client actually receives the first HTTP stream chunk on the wire
    const initialData = await firstChunkReceived;
    expect(initialData).toContain('chunk-alpha');

    // Forcibly destroy the client TCP socket while stream is active
    clientSocket.destroy();

    // Await handler settlement with a bounded timeout (fails fast if handler hangs indefinitely)
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => reject(new Error('Handler failed to settle within 2000ms')), 2000);
      timer.unref?.();
    });

    await Promise.race([handlerSettledPromise, timeoutPromise]);

    // Verify all invariant assertions
    expect(serverObservedAbort).toBe(true);
    expect(onAbortCallbackFired).toBe(true);
    expect(handlerSettled).toBe(true);

    // Verify subsequent request to /health immediately succeeds on the same server instance
    const healthResult = await fetchHealth(port);
    expect(healthResult.status).toBe(200);
    expect(JSON.parse(healthResult.body)).toEqual({ status: 'ok', serverAlive: true });
  });

  it('Web ReadableStream branch cleanly cancels source and settles when client socket is destroyed', async () => {
    const app = createApp({ env: 'test', router: createRouter() });

    let sourceCancelled = false;
    let cancelReason: unknown;
    let handlerSettled = false;

    let resolveHandlerSettled: (() => void) | undefined;
    const handlerSettledPromise = new Promise<void>((resolve) => {
      resolveHandlerSettled = resolve;
    });

    app.get('/web-stream', async (ctx) => {
      const encoder = new TextEncoder();
      const readable = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('head-data\n'));
        },
        pull(controller) {
          controller.enqueue(encoder.encode('stream-data\n'));
        },
        cancel(reason) {
          sourceCancelled = true;
          cancelReason = reason;
        },
      });

      try {
        await ctx.sendStream(readable);
      } catch {
        // Expected on abrupt socket closure
      } finally {
        handlerSettled = true;
        resolveHandlerSettled?.();
      }
    });

    app.get('/health', (ctx) => {
      ctx.status = 200;
      ctx.json({ ok: true });
    });

    const server = createServer(createHandler(app, { timeout: 10_000 }));
    activeServer = server;

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const { port } = server.address() as AddressInfo;

    const clientSocket: Socket = await new Promise((resolve, reject) => {
      const sock = connect({ port, host: '127.0.0.1' }, () => resolve(sock));
      sock.on('error', reject);
    });

    const firstChunkReceived = new Promise<string>((resolve) => {
      clientSocket.once('data', (data) => resolve(data.toString('utf8')));
    });

    clientSocket.write('GET /web-stream HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n');
    const chunk = await firstChunkReceived;
    expect(chunk).toContain('head-data');

    // Forcibly tear down socket
    clientSocket.destroy();

    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => reject(new Error('ReadableStream handler failed to settle')), 2000);
      timer.unref?.();
    });

    await Promise.race([handlerSettledPromise, timeoutPromise]);

    expect(handlerSettled).toBe(true);
    expect(sourceCancelled).toBe(true);

    // Verify subsequent request immediately succeeds
    const healthResult = await fetchHealth(port);
    expect(healthResult.status).toBe(200);
    expect(JSON.parse(healthResult.body)).toEqual({ ok: true });
  });
});
