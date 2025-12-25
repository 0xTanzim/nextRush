/**
 * @nextrush/controllers - Builder Tests
 */

import { Body, Controller, Ctx, Get, Param, Post, Query, getControllerDefinition } from '@nextrush/decorators';
import { createContainer, type ContainerInterface } from '@nextrush/di';
import type { Context } from '@nextrush/types';
import 'reflect-metadata';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildRoutes } from '../builder.js';

describe('buildRoutes', () => {
  let container: ContainerInterface;

  beforeEach(() => {
    container = createContainer();
  });

  describe('route path building', () => {
    it('should build basic route path', () => {
      @Controller('/users')
      class UserController {
        @Get()
        findAll() {
          return [];
        }
      }

      container.register(UserController, { useClass: UserController });
      const definition = getControllerDefinition(UserController)!;
      const routes = buildRoutes(definition, container, '', []);

      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe('/users');
      expect(routes[0].method).toBe('GET');
    });

    it('should combine controller and route paths', () => {
      @Controller('/users')
      class UserController {
        @Get('/:id')
        findOne() {
          return {};
        }

        @Post('/bulk')
        createBulk() {
          return {};
        }
      }

      container.register(UserController, { useClass: UserController });
      const definition = getControllerDefinition(UserController)!;
      const routes = buildRoutes(definition, container, '', []);

      expect(routes).toHaveLength(2);
      const findOneRoute = routes.find((r) => r.methodName === 'findOne');
      const createBulkRoute = routes.find((r) => r.methodName === 'createBulk');

      expect(findOneRoute?.path).toBe('/users/:id');
      expect(createBulkRoute?.path).toBe('/users/bulk');
    });

    it('should include global prefix', () => {
      @Controller('/users')
      class UserController {
        @Get()
        findAll() {
          return [];
        }
      }

      container.register(UserController, { useClass: UserController });
      const definition = getControllerDefinition(UserController)!;
      const routes = buildRoutes(definition, container, '/api/v1', []);

      expect(routes[0].path).toBe('/api/v1/users');
    });

    it('should include controller version', () => {
      @Controller({ path: '/users', version: 'v2' })
      class UserController {
        @Get()
        findAll() {
          return [];
        }
      }

      container.register(UserController, { useClass: UserController });
      const definition = getControllerDefinition(UserController)!;
      const routes = buildRoutes(definition, container, '', []);

      expect(routes[0].path).toBe('/v2/users');
    });

    it('should handle root controller path', () => {
      @Controller('/')
      class RootController {
        @Get()
        index() {
          return 'Hello';
        }

        @Get('/health')
        health() {
          return { status: 'ok' };
        }
      }

      container.register(RootController, { useClass: RootController });
      const definition = getControllerDefinition(RootController)!;
      const routes = buildRoutes(definition, container, '', []);

      const indexRoute = routes.find((r) => r.methodName === 'index');
      const healthRoute = routes.find((r) => r.methodName === 'health');

      expect(indexRoute?.path).toBe('/');
      expect(healthRoute?.path).toBe('/health');
    });
  });

  describe('middleware combination', () => {
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
      expect(routes[0].middleware.indexOf(globalMw)).toBeLessThan(routes[0].middleware.indexOf(controllerMw));
    });
  });

  describe('handler execution', () => {
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
    json: () => {},
    send: () => {},
    html: () => {},
    redirect: () => {},
    throw: () => {
      throw new Error();
    },
    assert: () => {},
    set: () => {},
    get: () => undefined,
    next: async () => {},
    raw: {
      req: {},
      res: { writableEnded: false },
    },
  } as unknown as Context;
}
