/**
 * @nextrush/controllers - Builder Response & Lifecycle Tests
 */

import type { Container } from '@nextrush/di';
import { createContainer } from '@nextrush/di';
import type { Context } from '@nextrush/types';
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Controller, Get, getControllerDefinition, HttpCode, Post, Redirect, SetHeader } from '../index.js';
import { buildRoutes } from '../registrar/builder.js';
import { ControllerResolutionError } from '../errors.js';

describe('buildRoutes - @SetHeader integration (P3-2)', () => {
  let container: Container;

  beforeEach(() => {
    container = createContainer();
  });

  it('should apply response headers from @SetHeader', async () => {
    @Controller('/test')
    class TestController {
      @SetHeader('X-Custom', 'hello')
      @Get()
      handler() {
        return { ok: true };
      }
    }

    container.register(TestController, { useClass: TestController });
    const definition = getControllerDefinition(TestController)!;
    const routes = buildRoutes(definition, container, '', []);

    const mockCtx = createMockContext('GET', '/test');
    await routes[0].handler(mockCtx);

    expect(mockCtx.set).toHaveBeenCalledWith('X-Custom', 'hello');
  });

  it('should apply multiple headers', async () => {
    @Controller('/test')
    class TestController {
      @SetHeader('X-A', 'a')
      @SetHeader('X-B', 'b')
      @Get()
      handler() {
        return { ok: true };
      }
    }

    container.register(TestController, { useClass: TestController });
    const definition = getControllerDefinition(TestController)!;
    const routes = buildRoutes(definition, container, '', []);

    const mockCtx = createMockContext('GET', '/test');
    await routes[0].handler(mockCtx);

    expect(mockCtx.set).toHaveBeenCalledWith('X-A', 'a');
    expect(mockCtx.set).toHaveBeenCalledWith('X-B', 'b');
  });
});

describe('buildRoutes - @HttpCode integration (DX-2)', () => {
  let container: Container;

  beforeEach(() => {
    container = createContainer();
  });

  it('should set the response status from @HttpCode when the method returns a body', async () => {
    @Controller('/users')
    class UserController {
      @Post()
      @HttpCode(201)
      create() {
        return { id: 1 };
      }
    }

    container.register(UserController, { useClass: UserController });
    const definition = getControllerDefinition(UserController)!;
    const routes = buildRoutes(definition, container, '', []);

    const mockCtx = createMockContext('POST', '/users', { name: 'John' });
    await routes[0].handler(mockCtx);

    expect(mockCtx.status).toBe(201);
    expect(mockCtx.json).toHaveBeenCalledWith({ id: 1 });
  });

  it('should let @HttpCode override the route statusCode option (precedence)', async () => {
    @Controller('/users')
    class UserController {
      @Post('/', { statusCode: 200 })
      @HttpCode(201)
      create() {
        return { id: 1 };
      }
    }

    container.register(UserController, { useClass: UserController });
    const definition = getControllerDefinition(UserController)!;
    const routes = buildRoutes(definition, container, '', []);

    const mockCtx = createMockContext('POST', '/users');
    await routes[0].handler(mockCtx);

    expect(mockCtx.status).toBe(201);
  });

  it('should fall back to the route statusCode when @HttpCode is absent', async () => {
    @Controller('/users')
    class UserController {
      @Post('/', { statusCode: 202 })
      create() {
        return { id: 1 };
      }
    }

    container.register(UserController, { useClass: UserController });
    const definition = getControllerDefinition(UserController)!;
    const routes = buildRoutes(definition, container, '', []);

    const mockCtx = createMockContext('POST', '/users');
    await routes[0].handler(mockCtx);

    expect(mockCtx.status).toBe(202);
  });
});

describe('buildRoutes - @Redirect integration (P3-3)', () => {
  let container: Container;

  beforeEach(() => {
    container = createContainer();
  });

  it('should redirect when handler returns void', async () => {
    @Controller('/test')
    class TestController {
      @Redirect('/target', 301)
      @Get()
      handler() {
        // no return — uses default redirect URL
      }
    }

    container.register(TestController, { useClass: TestController });
    const definition = getControllerDefinition(TestController)!;
    const routes = buildRoutes(definition, container, '', []);

    const mockCtx = createMockContext('GET', '/test');
    await routes[0].handler(mockCtx);

    expect(mockCtx.status).toBe(301);
    expect(mockCtx.set).toHaveBeenCalledWith('Location', '/target');
  });

  it('should use return value as redirect URL when handler returns a string', async () => {
    @Controller('/test')
    class TestController {
      @Redirect('/default')
      @Get()
      handler() {
        return '/override';
      }
    }

    container.register(TestController, { useClass: TestController });
    const definition = getControllerDefinition(TestController)!;
    const routes = buildRoutes(definition, container, '', []);

    const mockCtx = createMockContext('GET', '/test');
    await routes[0].handler(mockCtx);

    expect(mockCtx.set).toHaveBeenCalledWith('Location', '/override');
  });
});

describe('buildRoutes - controller resolution hoisting (P2-10)', () => {
  let container: Container;

  beforeEach(() => {
    container = createContainer();
  });

  it('resolves the controller once across requests while running method and guards per-request', async () => {
    let methodCalls = 0;

    @Controller('/users')
    class UserController {
      @Get()
      findAll() {
        methodCalls++;
        return [];
      }
    }

    container.register(UserController, { useClass: UserController });
    const resolveSpy = vi.spyOn(container, 'resolve');
    const definition = getControllerDefinition(UserController)!;
    const routes = buildRoutes(definition, container, '', []);
    const handler = routes[0].handler;

    await handler(createMockContext('GET', '/users'));
    await handler(createMockContext('GET', '/users'));
    await handler(createMockContext('GET', '/users'));

    // Singletons never change — resolve the instance once, reuse it after.
    const controllerResolves = resolveSpy.mock.calls.filter((call) => call[0] === UserController);
    expect(controllerResolves).toHaveLength(1);

    // Method body must still run on every request.
    expect(methodCalls).toBe(3);

    resolveSpy.mockRestore();
  });

  it('does not cache a failed resolution — retries until resolve succeeds, then memoizes', async () => {
    @Controller('/retry')
    class RetryController {
      @Get()
      ping() {
        return { ok: true };
      }
    }

    container.register(RetryController, { useClass: RetryController });

    const realResolve = container.resolve.bind(container);
    let failuresRemaining = 2;
    const resolveSpy = vi
      .spyOn(container, 'resolve')
      .mockImplementation((token: Parameters<Container['resolve']>[0]) => {
        if (token === RetryController && failuresRemaining > 0) {
          failuresRemaining--;
          throw new Error('DI temporarily unavailable');
        }
        return realResolve(token);
      });

    const definition = getControllerDefinition(RetryController)!;
    const routes = buildRoutes(definition, container, '', []);
    const handler = routes[0].handler;

    // First two requests fail — failure must NOT be cached.
    await expect(handler(createMockContext('GET', '/retry'))).rejects.toBeInstanceOf(
      ControllerResolutionError
    );
    await expect(handler(createMockContext('GET', '/retry'))).rejects.toBeInstanceOf(
      ControllerResolutionError
    );

    // Third request resolves successfully.
    const okCtx = createMockContext('GET', '/retry');
    await handler(okCtx);
    expect(okCtx.json).toHaveBeenCalledWith({ ok: true });

    const resolvesBeforeCacheHit = resolveSpy.mock.calls.filter(
      (call) => call[0] === RetryController
    ).length;
    expect(resolvesBeforeCacheHit).toBe(3);

    // Fourth request reuses the memoized instance — no further resolve.
    await handler(createMockContext('GET', '/retry'));
    const resolvesAfterCacheHit = resolveSpy.mock.calls.filter(
      (call) => call[0] === RetryController
    ).length;
    expect(resolvesAfterCacheHit).toBe(3);

    resolveSpy.mockRestore();
  });
});

describe('buildRoutes - singleton controller contract (HIGH-3)', () => {
  let container: Container;

  beforeEach(() => {
    container = createContainer();
  });

  it('observes the SAME controller instance across requests — instance state accumulates', async () => {
    @Controller('/counter')
    class CounterController {
      // Per-request state stored on `this` LEAKS across requests because
      // controllers are DI singletons. This characterization test pins that
      // contract: it passes today and would fail if controllers ever became
      // transient or request-scoped (each request would then see hits === 1).
      private hits = 0;

      @Get()
      increment() {
        this.hits += 1;
        return { hits: this.hits };
      }
    }

    container.register(CounterController, { useClass: CounterController });
    const definition = getControllerDefinition(CounterController)!;
    const routes = buildRoutes(definition, container, '', []);
    const handler = routes[0].handler;

    const firstCtx = createMockContext('GET', '/counter');
    await handler(firstCtx);
    const secondCtx = createMockContext('GET', '/counter');
    await handler(secondCtx);

    // Same singleton instance → the counter accumulates across requests.
    expect(firstCtx.json).toHaveBeenCalledWith({ hits: 1 });
    expect(secondCtx.json).toHaveBeenCalledWith({ hits: 2 });
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
