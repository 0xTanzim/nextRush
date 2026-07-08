/**
 * @nextrush/controllers - Builder Route Tests
 */

import type { Container } from '@nextrush/di';
import { createContainer } from '@nextrush/di';
import type { Context } from '@nextrush/types';
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Controller, Get, getControllerDefinition, Post } from '../index.js';
import { buildRoutes } from '../registrar/builder.js';

describe('buildRoutes - route path building', () => {
  let container: Container;

  beforeEach(() => {
    container = createContainer();
  });

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
