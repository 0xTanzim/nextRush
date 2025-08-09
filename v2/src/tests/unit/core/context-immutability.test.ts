/**
 * Context Immutability Tests
 */

import { createApp } from '@/core/app/application';
import { createContext } from '@/core/app/context';
import type { ApplicationOptions } from '@/types/http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Context Immutability-by-Design', () => {
  let mockReq: IncomingMessage;
  let mockRes: ServerResponse;
  let options: Required<ApplicationOptions>;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      url: '/test?param=value',
      headers: {
        host: 'localhost:3000',
      },
      socket: {
        remoteAddress: '127.0.0.1',
      },
    } as unknown as IncomingMessage;

    mockRes = {
      statusCode: 200,
      setHeader: () => {},
      getHeader: () => undefined,
      removeHeader: () => {},
      end: () => {},
    } as unknown as ServerResponse;

    options = {
      port: 3000,
      host: 'localhost',
      debug: false,
      trustProxy: false,
      maxBodySize: 1024 * 1024,
      timeout: 30000,
      cors: true,
      static: 'public',
      template: { engine: 'simple', directory: 'views' },
      keepAlive: 10000,
    } as Required<ApplicationOptions>;
  });

  it('freezes query after first parse', () => {
    const ctx = createContext(mockReq, mockRes, options);
    // Trigger lazy parse
    const q1 = ctx.query;
    expect(q1).toEqual({ param: 'value' });
    expect(Object.isFrozen(q1)).toBe(true);

    // Attempt mutation should throw because object is frozen
    let threw = false;
    try {
      (q1 as Record<string, unknown>)['x'] = 'y';
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
    expect((ctx.query as Record<string, unknown>)['x']).toBeUndefined();
  });

  describe('params freezing after route match', () => {
    let app: ReturnType<typeof createApp>;

    beforeEach(() => {
      app = createApp({ port: 3025, debug: false });
    });

    afterEach(async () => {
      await app.shutdown();
    });

    it('freezes params set by router', async () => {
      app.get('/users/:id', async ctx => {
        expect(ctx.params).toEqual({ id: '123' });
        expect(Object.isFrozen(ctx.params)).toBe(true);
        // Attempt mutation should throw because object is frozen
        let threw = false;
        try {
          (ctx.params as Record<string, unknown>)['id'] = '999';
        } catch {
          threw = true;
        }
        expect(threw).toBe(true);
        expect(ctx.params['id']).toBe('123');
        ctx.res.json({ id: ctx.params['id'] });
      });

      app.listen(3025);
      await new Promise(resolve => setTimeout(resolve, 100));

      const res = await fetch('http://localhost:3025/users/123');
      const data = (await res.json()) as { id: string };
      expect(res.status).toBe(200);
      expect(data.id).toBe('123');
    });
  });

  it('keeps state mutable for middleware cooperation', async () => {
    const app = createApp({ port: 3026, debug: false });
    app.use(async (ctx, next) => {
      ctx.state['count'] = 0;
      await next();
    });
    app.use(async (ctx, next) => {
      ctx.state['count'] = (ctx.state['count'] as number) + 1;
      await next();
    });
    app.get('/state', async ctx => {
      expect(Object.isFrozen(ctx.state)).toBe(false);
      ctx.res.json({ count: ctx.state['count'] });
    });

    app.listen(3026);
    await new Promise(resolve => setTimeout(resolve, 100));

    const res = await fetch('http://localhost:3026/state');
    const data = (await res.json()) as { count: number };
    expect(res.status).toBe(200);
    expect(data.count).toBe(1);
    await app.shutdown();
  });
});
