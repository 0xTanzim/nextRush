/**
 * @nextrush/controllers - Builder Params & Handler Tests
 */

import type { Container } from '@nextrush/di';
import { createContainer } from '@nextrush/di';
import type { Context, Middleware } from '@nextrush/types';
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Body, Controller, createCustomParamDecorator, Ctx, Get, getControllerDefinition, Param, Post, Query } from '../index.js';
import { buildRoutes } from '../registrar/builder.js';

describe('buildRoutes - handler execution', () => {
  let container: Container;

  beforeEach(() => {
    container = createContainer();
  });

  it('should resolve controller from DI and call method', async () => {
    let called = false;

    @Controller('/users')
    class UserController {
      @Get()
      findAll() {
        called = true;
        return [{ id: 1 }];
      }
    }

    container.register(UserController, { useClass: UserController });
    const definition = getControllerDefinition(UserController)!;
    const routes = buildRoutes(definition, container, '', []);

    const mockCtx = createMockContext('GET', '/users');
    await routes[0].handler(mockCtx);

    expect(called).toBe(true);
  });

  it('should inject body parameter', async () => {
    let receivedBody: unknown;

    @Controller('/users')
    class UserController {
      @Post()
      create(@Body() data: { name: string }) {
        receivedBody = data;
        return data;
      }
    }

    container.register(UserController, { useClass: UserController });
    const definition = getControllerDefinition(UserController)!;
    const routes = buildRoutes(definition, container, '', []);

    const mockCtx = createMockContext('POST', '/users', { name: 'John' });
    await routes[0].handler(mockCtx);

    expect(receivedBody).toEqual({ name: 'John' });
  });

  it('should inject param parameter', async () => {
    let receivedId: string | undefined;

    @Controller('/users')
    class UserController {
      @Get('/:id')
      findOne(@Param('id') id: string) {
        receivedId = id;
        return { id };
      }
    }

    container.register(UserController, { useClass: UserController });
    const definition = getControllerDefinition(UserController)!;
    const routes = buildRoutes(definition, container, '', []);

    const mockCtx = createMockContext('GET', '/users/123');
    mockCtx.params = { id: '123' };
    await routes[0].handler(mockCtx);

    expect(receivedId).toBe('123');
  });

  it('should inject query parameter', async () => {
    let receivedPage: string | undefined;

    @Controller('/users')
    class UserController {
      @Get()
      findAll(@Query('page') page: string) {
        receivedPage = page;
        return [];
      }
    }

    container.register(UserController, { useClass: UserController });
    const definition = getControllerDefinition(UserController)!;
    const routes = buildRoutes(definition, container, '', []);

    const mockCtx = createMockContext('GET', '/users?page=2');
    (mockCtx.query as Record<string, string>)['page'] = '2';
    await routes[0].handler(mockCtx);

    expect(receivedPage).toBe('2');
  });

  it('should inject context with @Ctx', async () => {
    let receivedCtx: Context | undefined;

    @Controller('/users')
    class UserController {
      @Get()
      findAll(@Ctx() ctx: Context) {
        receivedCtx = ctx;
        return [];
      }
    }

    container.register(UserController, { useClass: UserController });
    const definition = getControllerDefinition(UserController)!;
    const routes = buildRoutes(definition, container, '', []);

    const mockCtx = createMockContext('GET', '/users');
    await routes[0].handler(mockCtx);

    expect(receivedCtx).toBe(mockCtx);
  });

  it('should use transform function on parameter', async () => {
    let receivedId: number | undefined;

    @Controller('/users')
    class UserController {
      @Get('/:id')
      findOne(@Param('id', { transform: Number }) id: number) {
        receivedId = id;
        return { id };
      }
    }

    container.register(UserController, { useClass: UserController });
    const definition = getControllerDefinition(UserController)!;
    const routes = buildRoutes(definition, container, '', []);

    const mockCtx = createMockContext('GET', '/users/42');
    mockCtx.params = { id: '42' };
    await routes[0].handler(mockCtx);

    expect(receivedId).toBe(42);
    expect(typeof receivedId).toBe('number');
  });

  it('should use default value for optional parameter', async () => {
    let receivedLimit: number | undefined;

    @Controller('/users')
    class UserController {
      @Get()
      findAll(@Query('limit', { defaultValue: 10, transform: Number }) limit: number) {
        receivedLimit = limit;
        return [];
      }
    }

    container.register(UserController, { useClass: UserController });
    const definition = getControllerDefinition(UserController)!;
    const routes = buildRoutes(definition, container, '', []);

    const mockCtx = createMockContext('GET', '/users');
    await routes[0].handler(mockCtx);

    expect(receivedLimit).toBe(10);
  });

  it('should auto-send JSON response for object return', async () => {
    let jsonSent: unknown;

    @Controller('/users')
    class UserController {
      @Get()
      findAll() {
        return [{ id: 1, name: 'John' }];
      }
    }

    container.register(UserController, { useClass: UserController });
    const definition = getControllerDefinition(UserController)!;
    const routes = buildRoutes(definition, container, '', []);

    const mockCtx = createMockContext('GET', '/users');
    mockCtx.json = (data: unknown) => {
      jsonSent = data;
    };

    await routes[0].handler(mockCtx);

    expect(jsonSent).toEqual([{ id: 1, name: 'John' }]);
  });
});

describe('buildRoutes - middleware combination', () => {
  let container: Container;

  beforeEach(() => {
    container = createContainer();
  });

  it('should combine global and controller middleware', () => {
    const globalMw = async () => {};
    const controllerMw = async () => {};

    @Controller({ path: '/users', middleware: [controllerMw] })
    class UserController {
      @Get()
      findAll() {
        return [];
      }
    }

    container.register(UserController, { useClass: UserController });
    const definition = getControllerDefinition(UserController)!;
    const routes = buildRoutes(definition, container, '', [globalMw]);

    expect(routes[0].middleware).toContain(globalMw);
    expect(routes[0].middleware).toContain(controllerMw);
    expect(routes[0].middleware.indexOf(globalMw)).toBeLessThan(
      routes[0].middleware.indexOf(controllerMw)
    );
  });
});

describe('buildRoutes - middleware ref resolution (P1-2)', () => {
  let container: Container;

  beforeEach(() => {
    container = createContainer();
  });

  it('should resolve string middleware tokens from DI container', () => {
    const middlewareFn: Middleware = async (_ctx, next) => {
      if (next) await next();
    };

    container.register('AUTH_MIDDLEWARE', { useValue: middlewareFn });

    @Controller({ path: '/secure', middleware: ['AUTH_MIDDLEWARE'] })
    class SecureController {
      @Get()
      secret() {
        return { secret: true };
      }
    }

    container.register(SecureController, { useClass: SecureController });
    const definition = getControllerDefinition(SecureController)!;
    const routes = buildRoutes(definition, container, '', []);

    expect(routes[0].middleware).toHaveLength(1);
    expect(routes[0].middleware[0]).toBe(middlewareFn);
  });

  it('should pass function middleware refs through directly', () => {
    const mw: Middleware = async (_ctx, next) => {
      if (next) await next();
    };

    @Controller({ path: '/test', middleware: [mw] })
    class TestController {
      @Get()
      handler() {
        return {};
      }
    }

    container.register(TestController, { useClass: TestController });
    const definition = getControllerDefinition(TestController)!;
    const routes = buildRoutes(definition, container, '', []);

    expect(routes[0].middleware).toContain(mw);
  });
});

describe('buildRoutes - createCustomParamDecorator integration (P3-4)', () => {
  let container: Container;

  beforeEach(() => {
    container = createContainer();
  });

  it('should extract value via custom extractor', async () => {
    const CurrentUser = createCustomParamDecorator(
      (ctx: unknown) => (ctx as { state: { user: string } }).state.user
    );

    @Controller('/test')
    class TestController {
      @Get()
      handler(@CurrentUser user: unknown) {
        return { user };
      }
    }

    container.register(TestController, { useClass: TestController });
    const definition = getControllerDefinition(TestController)!;
    const routes = buildRoutes(definition, container, '', []);

    const mockCtx = createMockContext('GET', '/test');
    mockCtx.state = { user: 'alice' };
    await routes[0].handler(mockCtx);

    expect(mockCtx.json).toHaveBeenCalledWith({ user: 'alice' });
  });

  it('should handle async custom extractor', async () => {
    const AsyncUser = createCustomParamDecorator(async (ctx: unknown) => {
      // Simulate async operation (e.g., database lookup)
      await new Promise((resolve) => setTimeout(resolve, 1));
      return (ctx as { state: { user: string } }).state.user;
    });

    @Controller('/test')
    class TestController {
      @Get()
      handler(@AsyncUser user: unknown) {
        return { user };
      }
    }

    container.register(TestController, { useClass: TestController });
    const definition = getControllerDefinition(TestController)!;
    const routes = buildRoutes(definition, container, '', []);

    const mockCtx = createMockContext('GET', '/test');
    mockCtx.state = { user: 'bob' };
    await routes[0].handler(mockCtx);

    expect(mockCtx.json).toHaveBeenCalledWith({ user: 'bob' });
  });
});

/**
 * Create a mock context for testing
 */
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
