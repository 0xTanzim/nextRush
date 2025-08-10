/**
 * BasePlugin Middleware Contract Tests
 */

import { createApp } from '@/core/app/application';
import { BasePlugin } from '@/plugins/core/base-plugin';
import type { Application, Context, Middleware } from '@/types/context';
import { describe, expect, it } from 'vitest';

class TestPlugin extends BasePlugin {
  public name = 'TestPlugin';
  public version = '1.0.0';

  override onInstall(app: Application): void {
    this.app = app;
  }

  public buildMiddleware(): Middleware {
    // Should return (ctx, next) style middleware
    return this.createMiddleware(async (ctx, next) => {
      ctx.state['pluginHit'] = true;
      await next();
    });
  }
}

function createMockContext(overrides: Partial<Context> = {}): Context {
  return {
    req: {
      method: 'GET',
      url: '/test',
      headers: {},
      ...overrides.req,
    } as any,
    res: {
      statusCode: 200,
      setHeader: () => {},
      getHeader: () => undefined,
      end: () => {},
      ...overrides.res,
    } as any,
    body: undefined,
    method: 'GET',
    url: '/test',
    path: '/test',
    headers: {},
    query: {},
    params: {},
    id: 'test-id',
    state: {},
    startTime: Date.now(),
    ip: '127.0.0.1',
    secure: false,
    protocol: 'http',
    hostname: 'localhost',
    host: 'localhost:3000',
    origin: 'http://localhost:3000',
    href: 'http://localhost:3000/test',
    search: '',
    searchParams: new URLSearchParams(),
    status: 200,
    responseHeaders: {},
    throw(status: number, message?: string): never {
      const err = new Error(message || 'Error');
      (err as any).status = status;
      throw err;
    },
    assert(
      condition: unknown,
      status: number,
      message?: string
    ): asserts condition {
      if (!condition) {
        this.throw(status, message);
      }
    },
    fresh: () => false,
    stale: () => true,
    idempotent: () => false,
    cacheable: () => false,
    set(name: string, value: string | number | string[]): void {
      this.responseHeaders[name] = value as any;
    },
    ...overrides,
  } as Context;
}

describe('BasePlugin.createMiddleware', () => {
  it('returns a (ctx, next) function compatible with Application.use', async () => {
    const app = createApp();
    const plugin = new TestPlugin();
    plugin.install(app);

    const mw = plugin.buildMiddleware();

    // Shape check: function expects two params (ctx, next)
    expect(typeof mw).toBe('function');
    expect(mw.length).toBe(2);

    // Should be accepted by app.use without throwing
    expect(() => app.use(mw)).not.toThrow();

    // Runtime invocation with (ctx, next)
    const ctx = createMockContext();
    let nextCalled = false;
    await mw(ctx, async () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(ctx.state['pluginHit']).toBe(true);
  });
});
