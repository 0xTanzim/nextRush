/**
 * @nextrush/adapter-serverless - Vercel Serverless & Node / Edge tests.
 *
 * Exercises the universal dual-protocol invocation (Web Fetch + Node req/res),
 * callable handler set with HTTP method exports, response streaming with backpressure,
 * multi-value Set-Cookie preservation, and standalone runner detection.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '@nextrush/core';
import type { VercelIncomingMessageLike, VercelServerResponseLike } from '../platform-shapes';
import {
  createVercelHandler,
  isServerlessEnvironment,
  isStandaloneEnvironment,
  listenIfStandalone,
  toVercelWebRequest,
  writeVercelWebResponse,
} from '../vercel';

function createMockReq(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: string | Uint8Array;
  rawBody?: unknown;
  signal?: AbortSignal;
}): VercelIncomingMessageLike {
  const method = options.method ?? 'GET';
  const url = options.url ?? '/';
  const headers = options.headers ?? {};

  let streamSource: Uint8Array | undefined;
  if (options.body !== undefined) {
    streamSource =
      typeof options.body === 'string'
        ? new TextEncoder().encode(options.body)
        : options.body;
  }

  const req: VercelIncomingMessageLike = {
    method,
    url,
    headers,
    signal: options.signal,
    rawBody: options.rawBody,
    async *[Symbol.asyncIterator]() {
      if (streamSource !== undefined) {
        yield streamSource;
      }
    },
  };
  return req;
}

interface MockVercelRes extends VercelServerResponseLike {
  statusCode: number;
  statusMessage?: string;
  headersSent: boolean;
  headers: Record<string, string | string[]>;
  chunks: Uint8Array[];
  ended: boolean;
  eventListeners: Record<string, ((...args: unknown[]) => void)[]>;
  emit(event: string, ...args: unknown[]): void;
  bodyText(): string;
  bodyJson<T = unknown>(): T;
}

function createMockRes(options?: {
  drainOnWriteIndex?: number;
}): MockVercelRes {
  const eventListeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  let writeCallCount = 0;

  const res: MockVercelRes = {
    statusCode: 200,
    statusMessage: undefined,
    headersSent: false,
    headers: {},
    chunks: [],
    ended: false,
    eventListeners,
    setHeader(name: string, value: string | readonly string[]) {
      res.headers[name.toLowerCase()] = Array.isArray(value) ? [...value] : (value as string);
      return this;
    },
    write(chunk: unknown) {
      res.headersSent = true;
      const bytes =
        typeof chunk === 'string'
          ? new TextEncoder().encode(chunk)
          : chunk instanceof Uint8Array
            ? chunk
            : new TextEncoder().encode(String(chunk));
      res.chunks.push(bytes);
      writeCallCount++;

      if (options?.drainOnWriteIndex !== undefined && writeCallCount === options.drainOnWriteIndex) {
        // Simulate socket buffer full (backpressure)
        queueMicrotask(() => {
          res.emit('drain');
        });
        return false;
      }
      return true;
    },
    end(chunk?: unknown) {
      if (chunk !== undefined) {
        res.write(chunk);
      }
      res.headersSent = true;
      res.ended = true;
      return this;
    },
    once(event: string, listener: (...args: unknown[]) => void) {
      eventListeners[event] ??= [];
      eventListeners[event].push(listener);
      return this;
    },
    emit(event: string, ...args: unknown[]) {
      const listeners = eventListeners[event];
      if (listeners) {
        delete eventListeners[event];
        for (const listener of listeners) {
          listener(...args);
        }
      }
    },
    bodyText() {
      const totalLen = res.chunks.reduce((acc, c) => acc + c.length, 0);
      const merged = new Uint8Array(totalLen);
      let offset = 0;
      for (const c of res.chunks) {
        merged.set(c, offset);
        offset += c.length;
      }
      return new TextDecoder().decode(merged);
    },
    bodyJson<T = unknown>(): T {
      return JSON.parse(res.bodyText()) as T;
    },
  };

  return res;
}

describe('toVercelWebRequest', () => {
  it('constructs absolute URL using x-forwarded-proto and x-forwarded-host', () => {
    const req = createMockReq({
      method: 'GET',
      url: '/api/items?limit=10',
      headers: {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'my-vercel-app.vercel.app',
      },
    });

    const webReq = toVercelWebRequest(req);
    expect(webReq.url).toBe('https://my-vercel-app.vercel.app/api/items?limit=10');
    expect(webReq.method).toBe('GET');
  });

  it('preserves multi-value array headers in Web Headers', () => {
    const req = createMockReq({
      headers: {
        accept: ['application/json', 'text/plain'],
        'x-custom': 'val1',
      },
    });

    const webReq = toVercelWebRequest(req);
    expect(webReq.headers.get('accept')).toContain('application/json');
    expect(webReq.headers.get('accept')).toContain('text/plain');
    expect(webReq.headers.get('x-custom')).toBe('val1');
  });

  it('leaves body undefined for GET and HEAD requests', () => {
    const reqGet = createMockReq({ method: 'GET' });
    const webGet = toVercelWebRequest(reqGet);
    expect(webGet.body).toBeNull();

    const reqHead = createMockReq({ method: 'HEAD' });
    const webHead = toVercelWebRequest(reqHead);
    expect(webHead.body).toBeNull();
  });

  it('streams request body for POST requests', async () => {
    const req = createMockReq({
      method: 'POST',
      body: JSON.stringify({ message: 'hello from vercel' }),
      headers: { 'content-type': 'application/json' },
    });

    const webReq = toVercelWebRequest(req);
    const text = await webReq.text();
    expect(JSON.parse(text)).toEqual({ message: 'hello from vercel' });
  });
});

describe('writeVercelWebResponse', () => {
  it('writes status, headers, and streamed body to res', async () => {
    const res = createMockRes();
    const response = new Response(JSON.stringify({ status: 'ok' }), {
      status: 201,
      statusText: 'Created',
      headers: {
        'content-type': 'application/json',
        'x-powered-by': 'NextRush',
      },
    });

    await writeVercelWebResponse(res, response);

    expect(res.statusCode).toBe(201);
    expect(res.statusMessage).toBe('Created');
    expect(res.headers['content-type']).toBe('application/json');
    expect(res.headers['x-powered-by']).toBe('NextRush');
    expect(res.bodyJson()).toEqual({ status: 'ok' });
    expect(res.ended).toBe(true);
  });

  it('handles backpressure (drain) during streaming', async () => {
    const res = createMockRes({ drainOnWriteIndex: 1 });

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('chunk1-'));
        controller.enqueue(new TextEncoder().encode('chunk2-'));
        controller.close();
      },
    });

    const response = new Response(stream, {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    });

    await writeVercelWebResponse(res, response);
    expect(res.bodyText()).toBe('chunk1-chunk2-');
    expect(res.ended).toBe(true);
  });

  it('cancels the reader when the client disconnects prematurely', async () => {
    const res = createMockRes();
    let cancelled = false;

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('initial chunk'));
      },
      cancel() {
        cancelled = true;
      },
    });

    const response = new Response(stream);

    // Trigger close before reading finishes
    const writePromise = writeVercelWebResponse(res, response);
    res.emit('close');
    await writePromise;

    expect(cancelled).toBe(true);
  });
});

describe('createVercelHandler (Universal Invocation & Callable Set)', () => {
  it('serves Web standard Request invocations and reports ctx.platform === "vercel"', async () => {
    const app = createApp();
    let observedPlatform: string | undefined;

    app.use((ctx) => {
      observedPlatform = ctx.platform;
      ctx.json({ platform: ctx.platform });
    });

    const handler = createVercelHandler(app);
    const request = new Request('https://vercel.app/api/platform');
    const response = await handler(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ platform: 'vercel' });
    expect(observedPlatform).toBe('vercel');
  });

  it('serves Node.js HTTP (req, res) invocations with JSON payload', async () => {
    const app = createApp();

    app.use(async (ctx) => {
      if (ctx.method === 'POST' && ctx.path === '/api/echo') {
        const text = await ctx.bodySource.text();
        const body = JSON.parse(text) as { text: string };
        ctx.status = 201;
        ctx.set('x-custom-res', 'custom-value');
        ctx.json({ echo: body.text });
      }
    });

    const handler = createVercelHandler(app);
    const req = createMockReq({
      method: 'POST',
      url: '/api/echo',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'luna-mission.vercel.app',
      },
      body: JSON.stringify({ text: 'apollo 11' }),
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.headers['x-custom-res']).toBe('custom-value');
    expect(res.bodyJson()).toEqual({ echo: 'apollo 11' });
    expect(res.ended).toBe(true);
  });

  it('preserves multi-value Set-Cookie headers in Node res', async () => {
    const app = createApp();

    app.use((ctx) => {
      ctx.set('Set-Cookie', ['session=xyz123; HttpOnly', 'theme=dark; Path=/']);
      ctx.json({ loggedIn: true });
    });

    const handler = createVercelHandler(app);
    const req = createMockReq({ method: 'GET', url: '/api/login' });
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const setCookie = res.headers['set-cookie'];
    expect(Array.isArray(setCookie)).toBe(true);
    expect(setCookie).toHaveLength(2);
    expect(setCookie[0]).toContain('session=xyz123');
    expect(setCookie[1]).toContain('theme=dark');
  });

  it('exposes HTTP method route handlers and .fetch for named destructuring', async () => {
    const app = createApp();

    app.use((ctx) => {
      ctx.json({ method: ctx.method });
    });

    const handler = createVercelHandler(app);

    const getRes = await handler.GET(new Request('https://vercel.app/api/resource', { method: 'GET' }));
    expect(await getRes.json()).toEqual({ method: 'GET' });

    const postRes = await handler.POST(new Request('https://vercel.app/api/resource', { method: 'POST' }));
    expect(await postRes.json()).toEqual({ method: 'POST' });

    const putRes = await handler.PUT(new Request('https://vercel.app/api/resource', { method: 'PUT' }));
    expect(await putRes.json()).toEqual({ method: 'PUT' });

    const delRes = await handler.DELETE(new Request('https://vercel.app/api/resource', { method: 'DELETE' }));
    expect(await delRes.json()).toEqual({ method: 'DELETE' });

    const fetchRes = await handler.fetch(new Request('https://vercel.app/api/resource', { method: 'GET' }));
    expect(await fetchRes.json()).toEqual({ method: 'GET' });
  });

  it('serves LunaMission-style entrypoint with dual-dispatch and named verb exports', async () => {
    // Simulates LunaMission apps/api/src/index.mts
    const app = createApp();
    app.use(async (ctx) => {
      ctx.json({ ok: true, platform: ctx.platform });
    });

    const handler = createVercelHandler(app);

    // LunaMission exports:
    // export default handler;
    // export const { GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS, fetch } = handler;
    const { GET, POST, fetch: webFetch } = handler;

    // 1. Web Fetch invocation
    const fetchRes = await webFetch(new Request('https://api.luna.space/health'));
    expect(await fetchRes.json()).toEqual({ ok: true, platform: 'vercel' });

    // 2. Named verb invocation
    const getRes = await GET(new Request('https://api.luna.space/health'));
    expect(await getRes.json()).toEqual({ ok: true, platform: 'vercel' });

    // 3. Node.js req/res invocation
    const nodeReq = createMockReq({ method: 'POST', url: '/health' });
    const nodeRes = createMockRes();
    await handler(nodeReq, nodeRes);

    expect(nodeRes.statusCode).toBe(200);
    expect(nodeRes.bodyJson()).toEqual({ ok: true, platform: 'vercel' });
  });

  it('returns 504 Gateway Timeout when handler exceeds configured timeout', async () => {
    const app = createApp();

    app.use(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const handler = createVercelHandler(app, { timeout: 10 });
    const request = new Request('https://vercel.app/api/slow');
    const response = await handler(request);

    expect(response.status).toBe(504);
  });
});

describe('Standalone vs Serverless Environment Detection', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('detects Vercel serverless markers correctly', () => {
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;
    delete process.env.NOW_REGION;
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;

    expect(isServerlessEnvironment()).toBe(false);
    expect(isStandaloneEnvironment()).toBe(true);

    process.env.VERCEL = '1';
    expect(isServerlessEnvironment()).toBe(true);
    expect(isStandaloneEnvironment()).toBe(false);
  });

  it('listenIfStandalone is a no-op when in serverless environment', async () => {
    process.env.VERCEL = '1';

    const app = createApp();
    const handler = createVercelHandler(app);

    const server = await handler.listenIfStandalone({ port: 3000 });
    expect(server).toBeUndefined();
  });
});
