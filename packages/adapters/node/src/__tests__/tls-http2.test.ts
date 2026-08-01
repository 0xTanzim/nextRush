/**
 * @nextrush/adapter-node - TLS + HTTP/2 Integration Tests
 *
 * Tests for the new `tls` option and ALPN-negotiated HTTP/2 support.
 *
 * @packageDocumentation
 */

import { execSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '@nextrush/core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { serve } from '../adapter';
import type { ServerInstance } from '../adapter';

let instance: ServerInstance;
let certPath: string;
let keyPath: string;
let tmpDir: string;

const CERT_VALIDITY_DAYS = 365;

beforeAll(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'nextrush-tls-test-'));
  certPath = join(tmpDir, 'cert.pem');
  keyPath = join(tmpDir, 'key.pem');

  // Generate self-signed cert for tests.
  execSync(
    `openssl req -x509 -newkey rsa:2048 -keyout ${keyPath} -out ${certPath} ` +
      `-days ${CERT_VALIDITY_DAYS} -nodes -subj "/CN=localhost"`,
    { stdio: 'pipe' }
  );
}, 30000);

afterEach(async () => {
  if (instance) {
    try {
      await instance.close();
    } catch {
      // Server may already be closed or in a broken state.
    }
    instance = undefined as unknown as ServerInstance;
  }
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('serve() with tls option', () => {
  it('accepts tls: { cert, key } in ServeOptions', async () => {
    const app = createApp();
    app.use(async (ctx) => {
      ctx.json({ secure: true });
    });

    const cert = await readFile(certPath, 'utf-8');
    const key = await readFile(keyPath, 'utf-8');

    instance = await serve(app, { port: 0, tls: { cert, key } });

    expect(instance.port).toBeGreaterThan(0);
  });

  it('starts an HTTP/2 server when tls is present', async () => {
    const app = createApp();
    app.use(async (ctx) => {
      ctx.json({ protocol: 'h2' });
    });

    const cert = await readFile(certPath, 'utf-8');
    const key = await readFile(keyPath, 'utf-8');

    instance = await serve(app, { port: 0, tls: { cert, key } });

    // Server should be an http2 secure server, not plain http.
    const server = instance.server;
    expect(server.constructor.name).toBe('Http2SecureServer');
  });

  it('serves HTTPS requests correctly', async () => {
    const app = createApp();
    app.use(async (ctx) => {
      ctx.json({ message: 'hello over https', method: ctx.method });
    });

    const cert = await readFile(certPath, 'utf-8');
    const key = await readFile(keyPath, 'utf-8');

    instance = await serve(app, { port: 0, tls: { cert, key } });

    const https = await import('node:https');
    const body = await new Promise<string>((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'localhost',
          port: instance.port,
          path: '/',
          method: 'GET',
          rejectUnauthorized: false,
        },
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

    const parsed = JSON.parse(body);
    expect(parsed).toEqual({ message: 'hello over https', method: 'GET' });
  });
});

describe('serve() with tls falls back to HTTP/1.1', () => {
  it('falls back to HTTP/1.1 for clients not negotiating h2', async () => {
    const app = createApp();
    app.use(async (ctx) => {
      ctx.json({ status: 'ok' });
    });

    const cert = await readFile(certPath, 'utf-8');
    const key = await readFile(keyPath, 'utf-8');

    instance = await serve(app, { port: 0, tls: { cert, key } });

    const https = await import('node:https');
    const body = await new Promise<string>((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'localhost',
          port: instance.port,
          path: '/',
          method: 'GET',
          rejectUnauthorized: false,
        },
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

    const parsed = JSON.parse(body);
    expect(parsed).toEqual({ status: 'ok' });
  });
});

describe('HTTP/2 negotiated requests', () => {
  it('receives the same Context shape as HTTP/1.1 requests', async () => {
    const app = createApp();
    app.use(async (ctx) => {
      ctx.json({
        method: ctx.method,
        path: ctx.path,
        hasBody: ctx.bodySource !== undefined,
        hasQuery: ctx.query !== undefined,
        hasHeaders: ctx.headers !== undefined,
      });
    });

    const cert = await readFile(certPath, 'utf-8');
    const key = await readFile(keyPath, 'utf-8');

    instance = await serve(app, { port: 0, tls: { cert, key } });

    const http2 = await import('node:http2');
    const client = http2.connect(`https://localhost:${instance.port}`, {
      ca: cert,
      rejectUnauthorized: false,
    });

    const body = await new Promise<string>((resolve, reject) => {
      const req = client.request({ ':path': '/', ':method': 'GET' });
      let data = '';
      req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      req.on('end', () => {
        client.close();
        resolve(data);
      });
      req.on('error', reject);
      req.end();
    });

    const parsed = JSON.parse(body);
    expect(parsed.method).toBe('GET');
    expect(parsed.path).toBe('/');
    expect(parsed.hasBody).toBe(true);
    expect(parsed.hasQuery).toBe(true);
    expect(parsed.hasHeaders).toBe(true);
  });

  it('handles POST body over HTTP/2', async () => {
    const app = createApp();
    app.use(async (ctx) => {
      const data = await ctx.bodySource.json();
      ctx.json({ received: data });
    });

    const cert = await readFile(certPath, 'utf-8');
    const key = await readFile(keyPath, 'utf-8');

    instance = await serve(app, { port: 0, tls: { cert, key } });

    const http2 = await import('node:http2');
    const client = http2.connect(`https://localhost:${instance.port}`, {
      ca: cert,
      rejectUnauthorized: false,
    });

    const payload = JSON.stringify({ key: 'value' });
    const body = await new Promise<string>((resolve, reject) => {
      const req = client.request({
        ':path': '/',
        ':method': 'POST',
        'content-type': 'application/json',
        'content-length': String(Buffer.byteLength(payload)),
      });
      let data = '';
      req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      req.on('end', () => {
        client.close();
        resolve(data);
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    const parsed = JSON.parse(body);
    expect(parsed).toEqual({ received: { key: 'value' } });
  });

  it('resolves ctx.ip via req.socket.remoteAddress over HTTP/2 (compat-layer risk check)', async () => {
    const app = createApp();
    app.use(async (ctx) => {
      ctx.json({ ip: ctx.ip });
    });

    const cert = await readFile(certPath, 'utf-8');
    const key = await readFile(keyPath, 'utf-8');

    instance = await serve(app, { port: 0, tls: { cert, key } });

    const http2 = await import('node:http2');
    const client = http2.connect(`https://localhost:${instance.port}`, {
      ca: cert,
      rejectUnauthorized: false,
    });

    const body = await new Promise<string>((resolve, reject) => {
      const req = client.request({ ':path': '/', ':method': 'GET' });
      let data = '';
      req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      req.on('end', () => {
        client.close();
        resolve(data);
      });
      req.on('error', reject);
      req.end();
    });

    const parsed = JSON.parse(body);
    // On a loopback connection this must be a real, non-empty local address
    // (127.0.0.1 or ::1) — an empty string means req.socket.remoteAddress
    // did not resolve through the HTTP/2 compat layer the way it does on
    // plain http.IncomingMessage, which is the exact D4/RFC-028 risk.
    expect(typeof parsed.ip).toBe('string');
    expect(parsed.ip.length).toBeGreaterThan(0);
    expect(['127.0.0.1', '::1', '::ffff:127.0.0.1']).toContain(parsed.ip);
  });
});

describe('serve() with tls — graceful close()', () => {
  it('close() drains an in-flight HTTP/2 request and resolves cleanly', async () => {
    const app = createApp();
    let releaseHandler: (() => void) | undefined;
    const handlerGate = new Promise<void>((resolve) => {
      releaseHandler = resolve;
    });
    let handlerEntered: (() => void) | undefined;
    const handlerEnteredPromise = new Promise<void>((resolve) => {
      handlerEntered = resolve;
    });

    app.use(async (ctx) => {
      handlerEntered?.();
      await handlerGate;
      ctx.json({ status: 'done' });
    });

    const cert = await readFile(certPath, 'utf-8');
    const key = await readFile(keyPath, 'utf-8');

    instance = await serve(app, { port: 0, tls: { cert, key } });

    const http2 = await import('node:http2');
    const client = http2.connect(`https://localhost:${instance.port}`, {
      ca: cert,
      rejectUnauthorized: false,
    });
    await new Promise<void>((resolve, reject) => {
      client.once('connect', () => resolve());
      client.once('error', reject);
    });

    const requestPromise = new Promise<string>((resolve, reject) => {
      const req = client.request({ ':path': '/', ':method': 'GET' });
      let data = '';
      req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      req.on('end', () => {
        resolve(data);
      });
      req.on('error', reject);
      req.end();
    });

    // Wait for the handler to actually be running before draining, so this
    // genuinely exercises "close() while a request is in flight" rather than
    // racing request dispatch against server.close().
    await handlerEnteredPromise;

    // Start closing while the request is in flight. No new connections are
    // attempted after this point — the existing client session stays open
    // for its one in-flight request, matching a real drain.
    const closePromise = instance.close();
    releaseHandler?.();

    const [body] = await Promise.all([requestPromise, closePromise]);
    client.close();
    const parsed = JSON.parse(body);
    expect(parsed).toEqual({ status: 'done' });

    // instance.close() must not have thrown/hung — awaiting it above already
    // proves this, but assert explicitly for a clear failure message.
    await expect(closePromise).resolves.toBeUndefined();

    // Mark drained so the outer afterEach doesn't try to close it again.
    instance = undefined as unknown as ServerInstance;
  });

  it('force-closes remaining TLS connections when the drain timeout elapses', async () => {
    const app = createApp();
    // A handler that never resolves — forces the drain to hit its timeout
    // and exercise safeCloseAllConnections() on the Http2SecureServer path.
    app.use(async () => {
      await new Promise<void>(() => {
        // Deliberately never resolves.
      });
    });

    const cert = await readFile(certPath, 'utf-8');
    const key = await readFile(keyPath, 'utf-8');

    instance = await serve(app, { port: 0, tls: { cert, key }, shutdownTimeout: 50 });

    const http2 = await import('node:http2');
    const client = http2.connect(`https://localhost:${instance.port}`, {
      ca: cert,
      rejectUnauthorized: false,
    });
    await new Promise<void>((resolve, reject) => {
      client.once('connect', () => resolve());
      client.once('error', reject);
    });

    // Fire a request that will hang forever in the handler.
    const req = client.request({ ':path': '/', ':method': 'GET' });
    req.on('error', () => undefined); // expected once the connection is force-closed
    req.end();

    // close() must still resolve within/around the configured shutdownTimeout,
    // proving the force-close branch (safeCloseAllConnections) runs on the
    // Http2SecureServer path rather than hanging forever.
    await expect(instance.close()).resolves.toBeUndefined();

    client.close();
    instance = undefined as unknown as ServerInstance;
  }, 5000);
});
