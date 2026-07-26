/**
 * @nextrush/class - Interceptor Integration Tests
 *
 * Verifies the per-request handler wraps the controller-method call in the
 * interceptor onion (class interceptors outermost, method innermost), that an
 * interceptor may transform the returned value, that interceptors are resolved
 * from DI, that a handler error is observable to an interceptor's try/catch
 * around next(), and that an unhandled interceptor error is catchable by a
 * @UseFilter exception filter (Wave 10 integration — filters wrap interceptors).
 */

import {
  Catch,
  Controller,
  Get,
  getControllerDefinition,
  UseFilter,
  UseInterceptor,
} from '../index.js';
import type { ExceptionFilter, Interceptor } from '../index.js';
import { createContainer, inject, Injectable, type Container } from '@nextrush/di';
import type { Context } from '@nextrush/types';
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRoutes } from '../registrar/builder.js';

describe('interceptors', () => {
  let container: Container;

  beforeEach(() => {
    container = createContainer();
  });

  it('(a) runs before AND after the handler', async () => {
    const order: string[] = [];

    class TimingInterceptor implements Interceptor {
      async intercept(_ctx: Context, next: () => Promise<unknown>): Promise<unknown> {
        order.push('before');
        const result = await next();
        order.push('after');
        return result;
      }
    }

    @UseInterceptor(TimingInterceptor)
    @Controller('/things')
    class ThingController {
      @Get()
      list() {
        order.push('handler');
        return { ok: true };
      }
    }

    container.register(TimingInterceptor, { useClass: TimingInterceptor });
    container.register(ThingController, { useClass: ThingController });
    const routes = buildRoutes(getControllerDefinition(ThingController)!, container, '', []);

    const ctx = createMockContext('GET', '/things');
    await routes[0].handler(ctx);

    expect(order).toEqual(['before', 'handler', 'after']);
    expect(ctx.json).toHaveBeenCalledWith({ ok: true });
  });

  it('(b) transforms the return value that flows into the response', async () => {
    class DoubleInterceptor implements Interceptor {
      async intercept(_ctx: Context, next: () => Promise<unknown>): Promise<unknown> {
        const value = (await next()) as { count: number };
        return { count: value.count * 2 };
      }
    }

    @UseInterceptor(DoubleInterceptor)
    @Controller('/things')
    class ThingController {
      @Get()
      list() {
        return { count: 21 };
      }
    }

    container.register(DoubleInterceptor, { useClass: DoubleInterceptor });
    container.register(ThingController, { useClass: ThingController });
    const routes = buildRoutes(getControllerDefinition(ThingController)!, container, '', []);

    const ctx = createMockContext('GET', '/things');
    await routes[0].handler(ctx);

    expect(ctx.json).toHaveBeenCalledWith({ count: 42 });
  });

  it('(c) nests multiple interceptors onion-style, class outermost then method', async () => {
    const order: string[] = [];

    class ClassInterceptor implements Interceptor {
      async intercept(_ctx: Context, next: () => Promise<unknown>): Promise<unknown> {
        order.push('class:before');
        const result = await next();
        order.push('class:after');
        return result;
      }
    }

    class MethodInterceptor implements Interceptor {
      async intercept(_ctx: Context, next: () => Promise<unknown>): Promise<unknown> {
        order.push('method:before');
        const result = await next();
        order.push('method:after');
        return result;
      }
    }

    @UseInterceptor(ClassInterceptor)
    @Controller('/things')
    class ThingController {
      @UseInterceptor(MethodInterceptor)
      @Get()
      list() {
        order.push('handler');
        return { ok: true };
      }
    }

    container.register(ClassInterceptor, { useClass: ClassInterceptor });
    container.register(MethodInterceptor, { useClass: MethodInterceptor });
    container.register(ThingController, { useClass: ThingController });
    const routes = buildRoutes(getControllerDefinition(ThingController)!, container, '', []);

    const ctx = createMockContext('GET', '/things');
    await routes[0].handler(ctx);

    expect(order).toEqual([
      'class:before',
      'method:before',
      'handler',
      'method:after',
      'class:after',
    ]);
  });

  it('(d) resolves the interceptor from DI with an injected service', async () => {
    const CLOCK = 'ClockService';
    const stamps: string[] = [];

    class ClockService {
      stamp(label: string): void {
        stamps.push(label);
      }
    }

    // Explicit @inject token — vitest/esbuild does not emit design:paramtypes,
    // so implicit constructor injection is unavailable in test files.
    @Injectable()
    class StampInterceptor implements Interceptor {
      constructor(@inject(CLOCK) private readonly clock: ClockService) {}

      async intercept(_ctx: Context, next: () => Promise<unknown>): Promise<unknown> {
        this.clock.stamp('enter');
        const result = await next();
        this.clock.stamp('exit');
        return result;
      }
    }

    @UseInterceptor(StampInterceptor)
    @Controller('/things')
    class ThingController {
      @Get()
      list() {
        return { ok: true };
      }
    }

    container.register(CLOCK, { useValue: new ClockService() });
    container.register(StampInterceptor, { useClass: StampInterceptor });
    container.register(ThingController, { useClass: ThingController });
    const routes = buildRoutes(getControllerDefinition(ThingController)!, container, '', []);

    const ctx = createMockContext('GET', '/things');
    await routes[0].handler(ctx);

    expect(stamps).toEqual(['enter', 'exit']);
    expect(ctx.json).toHaveBeenCalledWith({ ok: true });
  });

  it('(e1) makes a handler error observable to an interceptor try/catch around next()', async () => {
    let observed: unknown;

    class RecoverInterceptor implements Interceptor {
      async intercept(_ctx: Context, next: () => Promise<unknown>): Promise<unknown> {
        try {
          return await next();
        } catch (error) {
          observed = error;
          return { recovered: true };
        }
      }
    }

    @UseInterceptor(RecoverInterceptor)
    @Controller('/things')
    class ThingController {
      @Get()
      list(): unknown {
        throw new Error('handler-boom');
      }
    }

    container.register(RecoverInterceptor, { useClass: RecoverInterceptor });
    container.register(ThingController, { useClass: ThingController });
    const routes = buildRoutes(getControllerDefinition(ThingController)!, container, '', []);

    const ctx = createMockContext('GET', '/things');
    await routes[0].handler(ctx);

    expect((observed as Error).message).toBe('handler-boom');
    expect(ctx.json).toHaveBeenCalledWith({ recovered: true });
  });

  it('(e2) lets a @UseFilter exception filter catch an unhandled interceptor error', async () => {
    class InterceptorError extends Error {}
    let filterRan = false;

    class ThrowingInterceptor implements Interceptor {
      async intercept(_ctx: Context, _next: () => Promise<unknown>): Promise<unknown> {
        throw new InterceptorError('interceptor-boom');
      }
    }

    @Catch(InterceptorError)
    class InterceptorErrorFilter implements ExceptionFilter {
      catch(error: unknown, ctx: Context): void {
        filterRan = true;
        ctx.status = 500;
        ctx.json({ handled: (error as Error).message });
      }
    }

    @UseFilter(InterceptorErrorFilter)
    @UseInterceptor(ThrowingInterceptor)
    @Controller('/things')
    class ThingController {
      @Get()
      list() {
        return { ok: true };
      }
    }

    container.register(ThrowingInterceptor, { useClass: ThrowingInterceptor });
    container.register(InterceptorErrorFilter, { useClass: InterceptorErrorFilter });
    container.register(ThingController, { useClass: ThingController });
    const routes = buildRoutes(getControllerDefinition(ThingController)!, container, '', []);

    const ctx = createMockContext('GET', '/things');
    await routes[0].handler(ctx);

    expect(filterRan).toBe(true);
    expect(ctx.status).toBe(500);
    expect(ctx.json).toHaveBeenCalledWith({ handled: 'interceptor-boom' });
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
