/**
 * @nextrush/controllers - Builder Tests
 */

import type { CanActivate, GuardContext, GuardFn } from '@nextrush/decorators';
import {
  Body,
  Controller,
  createCustomParamDecorator,
  Ctx,
  Get,
  getControllerDefinition,
  Param,
  Post,
  Query,
  Redirect,
  SetHeader,
  UseGuard,
} from '@nextrush/decorators';
import { createContainer, type ContainerInterface } from '@nextrush/di';
import type { Context, Middleware } from '@nextrush/types';
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRoutes } from '../builder.js';
import { GuardRejectionError } from '../errors.js';

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
      expect(routes[0].middleware.indexOf(globalMw)).toBeLessThan(
        routes[0].middleware.indexOf(controllerMw)
      );
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

  describe('guard execution', () => {
    it('should execute function-based guards', async () => {
      let guardCalled = false;
      const authGuard: GuardFn = () => {
        guardCalled = true;
        return true;
      };

      @UseGuard(authGuard)
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

      const mockCtx = createMockContext('GET', '/users');
      await routes[0].handler(mockCtx);

      expect(guardCalled).toBe(true);
    });

    it('should reject request when function guard returns false', async () => {
      const rejectGuard: GuardFn = () => false;

      @UseGuard(rejectGuard)
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

      const mockCtx = createMockContext('GET', '/users');

      await expect(routes[0].handler(mockCtx)).rejects.toThrow(GuardRejectionError);
    });

    it('should execute class-based guards from DI container', async () => {
      let guardCalled = false;

      class AuthGuard implements CanActivate {
        canActivate(_ctx: GuardContext): boolean {
          guardCalled = true;
          return true;
        }
      }

      @UseGuard(AuthGuard)
      @Controller('/users')
      class UserController {
        @Get()
        findAll() {
          return [];
        }
      }

      container.register(AuthGuard, { useClass: AuthGuard });
      container.register(UserController, { useClass: UserController });
      const definition = getControllerDefinition(UserController)!;
      const routes = buildRoutes(definition, container, '', []);

      const mockCtx = createMockContext('GET', '/users');
      await routes[0].handler(mockCtx);

      expect(guardCalled).toBe(true);
    });

    it('should reject request when class guard returns false', async () => {
      class RejectGuard implements CanActivate {
        canActivate(_ctx: GuardContext): boolean {
          return false;
        }
      }

      @UseGuard(RejectGuard)
      @Controller('/users')
      class UserController {
        @Get()
        findAll() {
          return [];
        }
      }

      container.register(RejectGuard, { useClass: RejectGuard });
      container.register(UserController, { useClass: UserController });
      const definition = getControllerDefinition(UserController)!;
      const routes = buildRoutes(definition, container, '', []);

      const mockCtx = createMockContext('GET', '/users');

      await expect(routes[0].handler(mockCtx)).rejects.toThrow(GuardRejectionError);
    });

    it('should inject dependencies into class guards', async () => {
      let serviceValue: string | undefined;

      class ConfigService {
        getValue() {
          return 'injected-value';
        }
      }

      class AuthGuard implements CanActivate {
        constructor(private config: ConfigService) {}

        canActivate(_ctx: GuardContext): boolean {
          serviceValue = this.config.getValue();
          return true;
        }
      }

      @UseGuard(AuthGuard)
      @Controller('/users')
      class UserController {
        @Get()
        findAll() {
          return [];
        }
      }

      // Register with factory to properly inject dependencies
      container.register(ConfigService, { useClass: ConfigService });
      container.register(AuthGuard, {
        useFactory: (c) => new AuthGuard(c.resolve(ConfigService)),
      });
      container.register(UserController, { useClass: UserController });
      const definition = getControllerDefinition(UserController)!;
      const routes = buildRoutes(definition, container, '', []);

      const mockCtx = createMockContext('GET', '/users');
      await routes[0].handler(mockCtx);

      expect(serviceValue).toBe('injected-value');
    });

    it('should support async class guards', async () => {
      class AsyncGuard implements CanActivate {
        async canActivate(_ctx: GuardContext): Promise<boolean> {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return true;
        }
      }

      @UseGuard(AsyncGuard)
      @Controller('/users')
      class UserController {
        @Get()
        findAll() {
          return [];
        }
      }

      container.register(AsyncGuard, { useClass: AsyncGuard });
      container.register(UserController, { useClass: UserController });
      const definition = getControllerDefinition(UserController)!;
      const routes = buildRoutes(definition, container, '', []);

      const mockCtx = createMockContext('GET', '/users');
      await routes[0].handler(mockCtx);

      // If we get here without error, the async guard worked
      expect(true).toBe(true);
    });

    it('should allow mixing function and class guards', async () => {
      const callOrder: string[] = [];

      const funcGuard: GuardFn = () => {
        callOrder.push('func');
        return true;
      };

      class ClassGuard implements CanActivate {
        canActivate(_ctx: GuardContext): boolean {
          callOrder.push('class');
          return true;
        }
      }

      @UseGuard(funcGuard, ClassGuard)
      @Controller('/users')
      class UserController {
        @Get()
        findAll() {
          return [];
        }
      }

      container.register(ClassGuard, { useClass: ClassGuard });
      container.register(UserController, { useClass: UserController });
      const definition = getControllerDefinition(UserController)!;
      const routes = buildRoutes(definition, container, '', []);

      const mockCtx = createMockContext('GET', '/users');
      await routes[0].handler(mockCtx);

      expect(callOrder).toEqual(['func', 'class']);
    });

    it('should pass context state between guards', async () => {
      const funcGuard: GuardFn = (ctx: GuardContext) => {
        ctx.state.user = { id: 1, role: 'admin' };
        return true;
      };

      let receivedUser: unknown;

      class RoleGuard implements CanActivate {
        canActivate(ctx: GuardContext): boolean {
          receivedUser = ctx.state.user;
          return (ctx.state.user as { role: string })?.role === 'admin';
        }
      }

      @UseGuard(funcGuard, RoleGuard)
      @Controller('/admin')
      class AdminController {
        @Get()
        dashboard() {
          return { admin: true };
        }
      }

      container.register(RoleGuard, { useClass: RoleGuard });
      container.register(AdminController, { useClass: AdminController });
      const definition = getControllerDefinition(AdminController)!;
      const routes = buildRoutes(definition, container, '', []);

      const mockCtx = createMockContext('GET', '/admin');
      await routes[0].handler(mockCtx);

      expect(receivedUser).toEqual({ id: 1, role: 'admin' });
    });
  });

  describe('middleware ref resolution (P1-2)', () => {
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

  describe('@SetHeader integration (P3-2)', () => {
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

  describe('@Redirect integration (P3-3)', () => {
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

  describe('createCustomParamDecorator integration (P3-4)', () => {
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
