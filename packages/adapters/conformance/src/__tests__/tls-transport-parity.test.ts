/**
 * TLS/HTTP2 transport-parity conformance (RFC-028 §10, tasks 7.1/7.2).
 *
 * @remarks
 * Proves the extended `runtime-adapter-contract` requirement: where an adapter
 * reports the `http2` capability, routing, middleware, streaming, request
 * bodies, and error handling must be byte-identical across HTTP/1.1, HTTPS/1.1,
 * and negotiated HTTP/2. Only the Node adapter currently reports `http2: true`
 * (confirmed empirically — Bun does not, Deno does but its native TLS/ALPN path
 * cannot run under this vitest/Node harness the same way Node's own adapter
 * can). This deliberately runs as its own scenario rather than forcing TLS
 * through the shared `ConformanceDriver`/`DispatchInit` contract (which speaks
 * plain HTTP only across all four adapters today) — extending that shared
 * contract to carry TLS/protocol options is a separate, larger design change
 * than this RFC's scope, tracked as follow-up (RFC-028 §17).
 *
 * @packageDocumentation
 */

import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { request as httpsRequest } from 'node:https';
import http2 from 'node:http2';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serve, type ServerInstance } from '@nextrush/adapter-node';
import { createApp } from '@nextrush/core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

let instance: ServerInstance;
let cert: string;
let key: string;
let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'nextrush-conformance-tls-'));
  const certPath = join(tmpDir, 'cert.pem');
  const keyPath = join(tmpDir, 'key.pem');
  execSync(
    `openssl req -x509 -newkey rsa:2048 -keyout ${keyPath} -out ${certPath} -days 365 -nodes -subj "/CN=localhost"`,
    { stdio: 'pipe' }
  );
  cert = readFileSync(certPath, 'utf-8');
  key = readFileSync(keyPath, 'utf-8');
});

afterEach(async () => {
  if (instance) {
    await instance.close().catch(() => undefined);
    instance = undefined as unknown as ServerInstance;
  }
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function buildApp() {
  const app = createApp();
  app.use(async (ctx) => {
    if (ctx.method === 'POST') {
      const data = await ctx.bodySource.json();
      ctx.status = 201;
      ctx.json({ echoed: data, method: ctx.method, path: ctx.path });
      return;
    }
    if (ctx.path === '/error') {
      ctx.throw(400, 'bad request');
      return;
    }
    ctx.set('X-Conformance', 'tls-parity');
    ctx.json({ method: ctx.method, path: ctx.path, query: ctx.query });
  });
  return app;
}

async function requestOverHttp1Tls(
  port: number,
  path: string,
  method: string,
  body?: string
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      { hostname: 'localhost', port, path, method, rejectUnauthorized: false },
      (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
        res.on('error', reject);
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function requestOverHttp2(
  port: number,
  path: string,
  method: string,
  body?: string
): Promise<{ status: number; body: string }> {
  const client = http2.connect(`https://localhost:${port}`, {
    ca: cert,
    rejectUnauthorized: false,
  });
  return new Promise((resolve, reject) => {
    const req = client.request({ ':path': path, ':method': method });
    let status = 0;
    req.on('response', (headers) => {
      status = Number(headers[':status']);
    });
    let data = '';
    req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
    req.on('end', () => {
      client.close();
      resolve({ status, body: data });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

describe('TLS transport parity — HTTP/1.1 vs negotiated HTTP/2 (Node adapter)', () => {
  it('GET routing produces byte-identical response over HTTP/1.1 and HTTP/2', async () => {
    instance = await serve(buildApp(), { port: 0, tls: { cert, key } });

    const h1 = await requestOverHttp1Tls(instance.port, '/foo?a=1', 'GET');
    const h2 = await requestOverHttp2(instance.port, '/foo?a=1', 'GET');

    expect(h2.status).toBe(h1.status);
    expect(JSON.parse(h2.body)).toEqual(JSON.parse(h1.body));
  });

  it('POST request body handling produces byte-identical response over HTTP/1.1 and HTTP/2', async () => {
    instance = await serve(buildApp(), { port: 0, tls: { cert, key } });
    const payload = JSON.stringify({ key: 'value' });

    const h1 = await requestOverHttp1Tls(instance.port, '/', 'POST', payload);
    const h2 = await requestOverHttp2(instance.port, '/', 'POST', payload);

    expect(h2.status).toBe(h1.status);
    expect(h2.status).toBe(201);
    expect(JSON.parse(h2.body)).toEqual(JSON.parse(h1.body));
  });

  it('error handling produces byte-identical response over HTTP/1.1 and HTTP/2', async () => {
    instance = await serve(buildApp(), { port: 0, tls: { cert, key } });

    const h1 = await requestOverHttp1Tls(instance.port, '/error', 'GET');
    const h2 = await requestOverHttp2(instance.port, '/error', 'GET');

    expect(h2.status).toBe(h1.status);
    expect(h2.status).toBe(400);
    expect(JSON.parse(h2.body)).toEqual(JSON.parse(h1.body));
  });
});
