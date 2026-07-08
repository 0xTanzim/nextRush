/**
 * @nextrush/controllers - Exception Filter Integration Tests
 *
 * Verifies the per-request handler wraps guard/resolve/param/method/response in
 * a filter pipeline: matched filters set the response, unmatched errors
 * propagate to the global error middleware unchanged.
 */

import { Catch, Controller, Get, getControllerDefinition, UseFilter } from '@nextrush/decorators';
import type { ExceptionFilter } from '@nextrush/decorators';
import { createContainer, inject, Injectable, type Container } from '@nextrush/di';
import type { Context } from '@nextrush/types';
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRoutes } from '../builder.js';

class DomainError extends Error {}
class UnrelatedError extends Error {}

describe('exception filters', () => {
  let container: Container;

  beforeEach(() => {
    container = createContainer();
  });

  it('should let a matching filter handle the error and set the response', async () => {
    let filterRan = false;

    @Catch(DomainError)
    class DomainFilter implements ExceptionFilter {
      catch(error: unknown, ctx: Context): void {
        filterRan = true;
        ctx.status = 418;
        ctx.json({ handled: true, message: (error as Error).message });
      }
    }

    @UseFilter(DomainFilter)
    @Controller('/things')
    class ThingController {
      @Get()
      list() {
        throw new DomainError('boom');
      }
    }

    container.register(DomainFilter, { useClass: DomainFilter });
    container.register(ThingController, { useClass: ThingController });
    const routes = buildRoutes(getControllerDefinition(ThingController)!, container, '', []);

    const ctx = createMockContext('GET', '/things');
    await routes[0].handler(ctx);

    expect(filterRan).toBe(true);
    expect(ctx.status).toBe(418);
    expect(ctx.json).toHaveBeenCalledWith({ handled: true, message: 'boom' });
  });

  it('should propagate an error not matched by any filter (filter not invoked)', async () => {
    let filterRan = false;

    @Catch(DomainError)
    class DomainFilter implements ExceptionFilter {
      catch(_error: unknown, _ctx: Context): void {
        filterRan = true;
      }
    }

    @UseFilter(DomainFilter)
    @Controller('/things')
    class ThingController {
      @Get()
      list() {
        throw new UnrelatedError('nope');
      }
    }

    container.register(DomainFilter, { useClass: DomainFilter });
    container.register(ThingController, { useClass: ThingController });
    const routes = buildRoutes(getControllerDefinition(ThingController)!, container, '', []);

    const ctx = createMockContext('GET', '/things');

    await expect(routes[0].handler(ctx)).rejects.toBeInstanceOf(UnrelatedError);
    expect(filterRan).toBe(false);
  });

  it('should give method-level filters precedence over class-level filters', async () => {
    const order: string[] = [];

    @Catch(DomainError)
    class ClassFilter implements ExceptionFilter {
      catch(_error: unknown, ctx: Context): void {
        order.push('class');
        ctx.status = 500;
      }
    }

    @Catch(DomainError)
    class MethodFilter implements ExceptionFilter {
      catch(_error: unknown, ctx: Context): void {
        order.push('method');
        ctx.status = 422;
      }
    }

    @UseFilter(ClassFilter)
    @Controller('/things')
    class ThingController {
      @UseFilter(MethodFilter)
      @Get()
      list() {
        throw new DomainError('boom');
      }
    }

    container.register(ClassFilter, { useClass: ClassFilter });
    container.register(MethodFilter, { useClass: MethodFilter });
    container.register(ThingController, { useClass: ThingController });
    const routes = buildRoutes(getControllerDefinition(ThingController)!, container, '', []);

    const ctx = createMockContext('GET', '/things');
    await routes[0].handler(ctx);

    // Only the method filter runs (first matching filter wins).
    expect(order).toEqual(['method']);
    expect(ctx.status).toBe(422);
  });

  it('should let a no-arg @Catch() catch-all handle any error', async () => {
    @Catch()
    class CatchAllFilter implements ExceptionFilter {
      catch(_error: unknown, ctx: Context): void {
        ctx.status = 500;
        ctx.json({ handled: 'all' });
      }
    }

    @UseFilter(CatchAllFilter)
    @Controller('/things')
    class ThingController {
      @Get()
      list() {
        throw new UnrelatedError('anything');
      }
    }

    container.register(CatchAllFilter, { useClass: CatchAllFilter });
    container.register(ThingController, { useClass: ThingController });
    const routes = buildRoutes(getControllerDefinition(ThingController)!, container, '', []);

    const ctx = createMockContext('GET', '/things');
    await routes[0].handler(ctx);

    expect(ctx.status).toBe(500);
    expect(ctx.json).toHaveBeenCalledWith({ handled: 'all' });
  });

  it('should resolve the filter from DI with an injected service', async () => {
    const AUDIT = 'AuditService';
    const recorded: string[] = [];

    class AuditService {
      record(message: string): void {
        recorded.push(message);
      }
    }

    // Explicit @inject token — vitest/esbuild does not emit design:paramtypes,
    // so implicit constructor injection is not available in test files. The
    // class must be marked @Injectable so tsyringe can construct it.
    @Injectable()
    @Catch(DomainError)
    class AuditingFilter implements ExceptionFilter {
      constructor(@inject(AUDIT) private readonly audit: AuditService) {}

      catch(error: unknown, ctx: Context): void {
        this.audit.record((error as Error).message);
        ctx.status = 400;
        ctx.json({ ok: false });
      }
    }

    @UseFilter(AuditingFilter)
    @Controller('/things')
    class ThingController {
      @Get()
      list() {
        throw new DomainError('audit-me');
      }
    }

    container.register(AUDIT, { useValue: new AuditService() });
    container.register(AuditingFilter, { useClass: AuditingFilter });
    container.register(ThingController, { useClass: ThingController });
    const routes = buildRoutes(getControllerDefinition(ThingController)!, container, '', []);

    const ctx = createMockContext('GET', '/things');
    await routes[0].handler(ctx);

    expect(recorded).toEqual(['audit-me']);
    expect(ctx.status).toBe(400);
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
