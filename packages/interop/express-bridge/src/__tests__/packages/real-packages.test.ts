/**
 * @nextrush/express-bridge — real-package integration tests
 *
 * Runs actual `morgan`, `passport`, and `on-headers` against a real
 * `Application` + `adapter-node` request, proving semantic compatibility
 * rather than TypeScript-shape compatibility.
 */

import { createApp } from '@nextrush/core';
import { createHandler } from '@nextrush/adapter-node';
import type { Context } from '@nextrush/types';
import { describe, expect, it } from 'vitest';
import morgan from 'morgan';
import passport from 'passport';
import onHeaders from 'on-headers';
import { compat } from '../../compat';
import { ExpressBridgeCapabilityError } from '../../errors';

function request(handler: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void): Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: string }> {
  return new Promise((resolve, reject) => {
    const http = require('node:http') as typeof import('node:http');
    const server = http.createServer(handler);
    server.listen(0, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      http
        .get(`http://127.0.0.1:${port}/me`, (res) => {
          let body = '';
          res.on('data', (chunk: Buffer) => (body += chunk.toString()));
          res.on('end', () => {
            server.close();
            resolve({
              status: res.statusCode ?? 0,
              headers: res.headers as Record<string, string | string[] | undefined>,
              body,
            });
          });
        })
        .on('error', reject);
    });
    server.on('error', reject);
  });
}

describe('real package: morgan', () => {
  it('runs morgan("tiny") as compat middleware and still reaches the handler', async () => {
    const logs: string[] = [];
    const app = createApp();
    app.use(compat(morgan('tiny', { stream: { write: (m: string) => logs.push(m) } })));
    app.use((ctx: Context) => {
      ctx.json({ ok: true });
    });

    const result = await request(createHandler(app));
    expect(result.status).toBe(200);
    expect(result.body).toContain('"ok":true');
    expect(logs.length).toBe(1);
  });
});

describe('real package: on-headers (surface fixture)', () => {
  it('onHeaders listener fires once on res.end without stack overflow', async () => {
    const app = createApp();
    app.use(
      compat((_req, res, next) => {
        onHeaders(res as never, () => {
          (res as { setHeader: (n: string, v: string) => void }).setHeader('X-Time', '1');
        });
        (next as () => void)();
      })
    );
    app.use((ctx: Context) => ctx.json({ ok: true }));

    const result = await request(createHandler(app));
    expect(result.status).toBe(200);
    expect(result.headers['x-time']).toBe('1');
  });
});

describe('real package: passport (session-less)', () => {
  it('passport.initialize() exposes req.user as ctx.state.user downstream', async () => {
    const app = createApp();
    app.use(compat(passport.initialize()));
    app.use(
      compat((req: { user?: unknown }, _res: unknown, next: () => void) => {
        (req as { user: unknown }).user = { id: 'u1' };
        next();
      })
    );
    app.use((ctx: Context) => {
      ctx.json({ user: ctx.state.user ?? null });
    });

    const result = await request(createHandler(app));
    expect(result.status).toBe(200);
    expect(result.body).toContain('"id":"u1"');
  });
});

describe('edge refusal', () => {
  it('compat() throws ExpressBridgeCapabilityError on Web-shaped ctx.raw', async () => {
    const app = createApp();
    app.use(compat(morgan('tiny')));

    // Build a Web-shaped context directly rather than going through adapter-node.
    const webCtx = {
      method: 'GET',
      url: '/',
      path: '/',
      query: {},
      headers: {},
      ip: '127.0.0.1',
      body: undefined,
      params: {},
      status: 200,
      state: {},
      cookies: {} as never,
      raw: { req: new Request('http://x/'), res: undefined },
      runtime: 'edge',
      platform: undefined,
      json: () => {},
      send: () => {},
      html: () => {},
      redirect: () => {},
      throw: () => {
        throw new Error('noop');
      },
      assert: () => {},
      set: () => {},
      get: () => undefined,
      next: () => Promise.resolve(),
      responded: false,
      bodySource: {} as never,
      signal: new AbortController().signal,
      sendStream: async () => {},
      stream: async () => {},
      sse: async () => {},
      ndjson: async () => {},
    } as unknown as Context;

    const mw = compat(morgan('tiny'));
    await expect(mw(webCtx, async () => {})).rejects.toBeInstanceOf(ExpressBridgeCapabilityError);
  });
});
