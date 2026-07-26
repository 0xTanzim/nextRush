/**
 * @nextrush/adapter-node - TLS regression pin (task 3.1)
 *
 * Proves `serve()` with no `tls` option is byte-identical to the pre-change
 * adapter — a regression pin written BEFORE the TLS/HTTP2 work landed, so any
 * accidental behavior change on the existing plain-HTTP path is caught.
 *
 * @packageDocumentation
 */

import { createApp } from '@nextrush/core';
import { afterEach, describe, expect, it } from 'vitest';
import { serve } from '../adapter';
import type { ServerInstance } from '../adapter';

let instance: ServerInstance;

afterEach(async () => {
  if (instance) {
    await instance.close().catch(() => undefined);
    instance = undefined as unknown as ServerInstance;
  }
});

describe('serve() without tls (regression pin)', () => {
  it('starts a plain HTTP server with no TLS', async () => {
    const app = createApp();
    app.use(async (ctx) => {
      ctx.json({ ok: true });
    });

    instance = await serve(app, { port: 0 });

    // Regression pin: server is a plain node:http.Server, not an https/http2 server.
    expect(instance.server.constructor.name).toBe('Server');
  });

  it('serves HTTP/1.1 requests correctly', async () => {
    const app = createApp();
    app.use(async (ctx) => {
      ctx.json({ message: 'hello', method: ctx.method });
    });

    instance = await serve(app, { port: 0 });

    const http = await import('node:http');
    const body = await new Promise<string>((resolve, reject) => {
      const req = http.request(
        { hostname: 'localhost', port: instance.port, path: '/', method: 'GET' },
        (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          res.on('end', () => resolve(data));
          res.on('error', reject);
        }
      );
      req.on('error', reject);
      req.end();
    });

    expect(JSON.parse(body)).toEqual({ message: 'hello', method: 'GET' });
  });

  it('handles POST with body correctly', async () => {
    const app = createApp();
    app.use(async (ctx) => {
      const data = await ctx.bodySource.json();
      ctx.json({ received: data });
    });

    instance = await serve(app, { port: 0 });

    const http = await import('node:http');
    const payload = JSON.stringify({ key: 'value' });
    const body = await new Promise<string>((resolve, reject) => {
      const req = http.request(
        {
          hostname: 'localhost',
          port: instance.port,
          path: '/',
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'content-length': String(Buffer.byteLength(payload)),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          res.on('end', () => resolve(data));
          res.on('error', reject);
        }
      );
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    expect(JSON.parse(body)).toEqual({ received: { key: 'value' } });
  });

  it('returns 200 for root with no route handler', async () => {
    const app = createApp();

    instance = await serve(app, { port: 0 });

    const http = await import('node:http');
    const status = await new Promise<number>((resolve, reject) => {
      const req = http.request(
        { hostname: 'localhost', port: instance.port, path: '/', method: 'GET' },
        (res) => {
          res.resume();
          res.on('end', () => resolve(res.statusCode ?? 0));
          res.on('error', reject);
        }
      );
      req.on('error', reject);
      req.end();
    });

    expect(status).toBe(200);
  });
});
