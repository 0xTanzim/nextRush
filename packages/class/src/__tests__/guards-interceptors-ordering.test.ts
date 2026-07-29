/**
 * @nextrush/class - Guard/Interceptor Dispatch-Order Security Tests
 *
 * Authorization-bypass audit (audit-unreviewed-security-surface, area 5):
 * proves that a guard's rejection — sync throw, async-rejected Promise, or a
 * plain `false` return — always stops the handler and is never bypassed by
 * interceptor ordering. Companion to guards.test.ts (decorator/metadata
 * behavior) and interceptors.test.ts (onion/DI/filter behavior); this file
 * covers the cross-cutting dispatch order between the two runners.
 */

import {
  Controller,
  Get,
  getControllerDefinition,
  UseGuard,
  UseInterceptor,
} from '../index.js';
import type { CanActivate, GuardContext, GuardFn, Interceptor } from '../index.js';
import { createContainer, type Container } from '@nextrush/di';
import type { Context } from '@nextrush/types';
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRoutes } from '../registrar/builder.js';

describe('guard/interceptor dispatch order', () => {
  let container: Container;

  beforeEach(() => {
    container = createContainer();
  });

  it('a synchronously-throwing guard denies the request and never reaches the handler', async () => {
    let handlerRan = false;

    const throwingGuard: GuardFn = () => {
      throw new Error('sync-guard-boom');
    };

    @UseGuard(throwingGuard)
    @Controller('/things')
    class ThingController {
      @Get()
      list() {
        handlerRan = true;
        return { ok: true };
      }
    }

    container.register(ThingController, { useClass: ThingController });
    const routes = buildRoutes(getControllerDefinition(ThingController)!, container, '', []);

    const ctx = createMockContext('GET', '/things');
    await expect(routes[0]!.handler(ctx)).rejects.toThrow('sync-guard-boom');

    expect(handlerRan).toBe(false);
    expect(ctx.json).not.toHaveBeenCalled();
    expect(ctx.send).not.toHaveBeenCalled();
  });

  it('an asynchronously-rejecting guard fails CLOSED — denies the request, never falls through to the handler', async () => {
    let handlerRan = false;

    // Returns a rejected Promise (not a synchronous throw) — this is the
    // fail-open/fail-closed fork: an unhandled async rejection inside
    // `executeGuards`'s `await guard(...)` must propagate as a rejection out
    // of executeGuards, not be swallowed and treated as an implicit `false`
    // or, worse, an implicit `true`.
    const asyncRejectingGuard: GuardFn = () => Promise.reject(new Error('async-guard-boom'));

    @UseGuard(asyncRejectingGuard)
    @Controller('/things')
    class ThingController {
      @Get()
      list() {
        handlerRan = true;
        return { ok: true };
      }
    }

    container.register(ThingController, { useClass: ThingController });
    const routes = buildRoutes(getControllerDefinition(ThingController)!, container, '', []);

    const ctx = createMockContext('GET', '/things');
    await expect(routes[0]!.handler(ctx)).rejects.toThrow('async-guard-boom');

    expect(handlerRan).toBe(false);
    expect(ctx.json).not.toHaveBeenCalled();
    expect(ctx.send).not.toHaveBeenCalled();
  });

  it('an async class-based guard (CanActivate) that rejects also fails CLOSED', async () => {
    let handlerRan = false;

    class AsyncRejectingClassGuard implements CanActivate {
      canActivate(_ctx: GuardContext): Promise<boolean> {
        return Promise.reject(new Error('async-class-guard-boom'));
      }
    }

    @UseGuard(AsyncRejectingClassGuard)
    @Controller('/things')
    class ThingController {
      @Get()
      list() {
        handlerRan = true;
        return { ok: true };
      }
    }

    container.register(AsyncRejectingClassGuard, { useClass: AsyncRejectingClassGuard });
    container.register(ThingController, { useClass: ThingController });
    const routes = buildRoutes(getControllerDefinition(ThingController)!, container, '', []);

    const ctx = createMockContext('GET', '/things');
    await expect(routes[0]!.handler(ctx)).rejects.toThrow('async-class-guard-boom');

    expect(handlerRan).toBe(false);
    expect(ctx.json).not.toHaveBeenCalled();
  });

  it('a guard returning false denies the request with GuardRejectionError and never reaches the handler', async () => {
    let handlerRan = false;

    const denyingGuard: GuardFn = () => false;

    @UseGuard(denyingGuard)
    @Controller('/things')
    class ThingController {
      @Get()
      list() {
        handlerRan = true;
        return { ok: true };
      }
    }

    container.register(ThingController, { useClass: ThingController });
    const routes = buildRoutes(getControllerDefinition(ThingController)!, container, '', []);

    const ctx = createMockContext('GET', '/things');
    await expect(routes[0]!.handler(ctx)).rejects.toMatchObject({
      name: 'GuardRejectionError',
      status: 403,
    });

    expect(handlerRan).toBe(false);
    expect(ctx.json).not.toHaveBeenCalled();
  });

  it('a guard returning a Promise that resolves to false also denies the request', async () => {
    let handlerRan = false;

    const asyncDenyingGuard: GuardFn = () =>
      new Promise((resolve) => setTimeout(() => resolve(false), 1));

    @UseGuard(asyncDenyingGuard)
    @Controller('/things')
    class ThingController {
      @Get()
      list() {
        handlerRan = true;
        return { ok: true };
      }
    }

    container.register(ThingController, { useClass: ThingController });
    const routes = buildRoutes(getControllerDefinition(ThingController)!, container, '', []);

    const ctx = createMockContext('GET', '/things');
    await expect(routes[0]!.handler(ctx)).rejects.toMatchObject({
      name: 'GuardRejectionError',
    });

    expect(handlerRan).toBe(false);
  });

  it('an interceptor never runs its before-logic before a rejecting guard has resolved', async () => {
    const order: string[] = [];

    const rejectingGuard: GuardFn = () => {
      order.push('guard');
      return false;
    };

    class SpyInterceptor implements Interceptor {
      async intercept(_ctx: Context, next: () => Promise<unknown>): Promise<unknown> {
        // If dispatch order were wrong, this line would run even though the
        // guard above rejected — the assertion below on `order` catches that.
        order.push('interceptor:before');
        const result = await next();
        order.push('interceptor:after');
        return result;
      }
    }

    @UseGuard(rejectingGuard)
    @UseInterceptor(SpyInterceptor)
    @Controller('/things')
    class ThingController {
      @Get()
      list() {
        order.push('handler');
        return { ok: true };
      }
    }

    container.register(SpyInterceptor, { useClass: SpyInterceptor });
    container.register(ThingController, { useClass: ThingController });
    const routes = buildRoutes(getControllerDefinition(ThingController)!, container, '', []);

    const ctx = createMockContext('GET', '/things');
    await expect(routes[0]!.handler(ctx)).rejects.toMatchObject({
      name: 'GuardRejectionError',
    });

    // Only the guard ran. The interceptor's before-logic, the handler, and
    // the interceptor's after-logic must all be absent from the trace.
    expect(order).toEqual(['guard']);
  });

  it('an interceptor never runs its before-logic before an async-rejecting guard has settled', async () => {
    const order: string[] = [];

    const asyncRejectingGuard: GuardFn = async () => {
      order.push('guard:start');
      await new Promise((resolve) => setTimeout(resolve, 5));
      order.push('guard:reject');
      throw new Error('async-guard-boom');
    };

    class SpyInterceptor implements Interceptor {
      async intercept(_ctx: Context, next: () => Promise<unknown>): Promise<unknown> {
        order.push('interceptor:before');
        const result = await next();
        order.push('interceptor:after');
        return result;
      }
    }

    @UseGuard(asyncRejectingGuard)
    @UseInterceptor(SpyInterceptor)
    @Controller('/things')
    class ThingController {
      @Get()
      list() {
        order.push('handler');
        return { ok: true };
      }
    }

    container.register(SpyInterceptor, { useClass: SpyInterceptor });
    container.register(ThingController, { useClass: ThingController });
    const routes = buildRoutes(getControllerDefinition(ThingController)!, container, '', []);

    const ctx = createMockContext('GET', '/things');
    await expect(routes[0]!.handler(ctx)).rejects.toThrow('async-guard-boom');

    // The interceptor never got a chance to run — even though the guard was
    // itself async and took 5ms to settle, dispatch order guarantees the
    // interceptor onion is only entered from inside invokeMethod's call
    // chain, which sits after the guard `await` in runtime/handler.ts.
    expect(order).toEqual(['guard:start', 'guard:reject']);
  });

  it('a passing guard lets the interceptor and handler run in the normal order', async () => {
    const order: string[] = [];

    const passingGuard: GuardFn = () => {
      order.push('guard');
      return true;
    };

    class SpyInterceptor implements Interceptor {
      async intercept(_ctx: Context, next: () => Promise<unknown>): Promise<unknown> {
        order.push('interceptor:before');
        const result = await next();
        order.push('interceptor:after');
        return result;
      }
    }

    @UseGuard(passingGuard)
    @UseInterceptor(SpyInterceptor)
    @Controller('/things')
    class ThingController {
      @Get()
      list() {
        order.push('handler');
        return { ok: true };
      }
    }

    container.register(SpyInterceptor, { useClass: SpyInterceptor });
    container.register(ThingController, { useClass: ThingController });
    const routes = buildRoutes(getControllerDefinition(ThingController)!, container, '', []);

    const ctx = createMockContext('GET', '/things');
    await routes[0]!.handler(ctx);

    expect(order).toEqual(['guard', 'interceptor:before', 'handler', 'interceptor:after']);
    expect(ctx.json).toHaveBeenCalledWith({ ok: true });
  });

  it('a first guard rejecting stops a second guard in the same chain from ever running', async () => {
    let secondGuardRan = false;

    const firstGuardRejects: GuardFn = () => false;
    const secondGuard: GuardFn = () => {
      secondGuardRan = true;
      return true;
    };

    @UseGuard(firstGuardRejects, secondGuard)
    @Controller('/things')
    class ThingController {
      @Get()
      list() {
        return { ok: true };
      }
    }

    container.register(ThingController, { useClass: ThingController });
    const routes = buildRoutes(getControllerDefinition(ThingController)!, container, '', []);

    const ctx = createMockContext('GET', '/things');
    await expect(routes[0]!.handler(ctx)).rejects.toMatchObject({
      name: 'GuardRejectionError',
    });

    expect(secondGuardRan).toBe(false);
  });
});

function createMockContext(method: string, url: string, body?: unknown): Context {
  return {
    method: method as Context['method'],
    url,
    path: url.split('?')[0],
    query: {},
    headers: {},
    ip: '127.0.0.1',
    body,
    params: {},
    status: 200,
    state: {},
    json: vi.fn(),
    send: vi.fn(),
    html: vi.fn(),
    redirect: vi.fn(),
    throw: () => {
      throw new Error();
    },
    assert: () => {},
    set: vi.fn(),
    get: vi.fn(),
    next: async () => {},
    raw: {
      req: {},
      res: { writableEnded: false },
    },
  } as unknown as Context;
}
