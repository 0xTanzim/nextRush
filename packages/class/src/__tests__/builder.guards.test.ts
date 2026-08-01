/**
 * @nextrush/class - Builder Guards Tests
 */

import type { CanActivate, GuardContext, GuardFn } from '../index.js';
import { Controller, Get, getControllerDefinition, UseGuard } from '../index.js';
import { createContainer, type Container } from '@nextrush/di';
import { UnauthorizedError } from '@nextrush/errors';
import type { Context } from '@nextrush/types';
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRoutes } from '../registrar/builder.js';
import { GuardRejectionError } from '../errors.js';

describe('buildRoutes - guard execution', () => {
  let container: Container;

  beforeEach(() => {
    container = createContainer();
  });

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

  it('should map a false-returning guard rejection to 403', async () => {
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

    await expect(routes[0].handler(mockCtx)).rejects.toMatchObject({ status: 403 });
  });

  it('should propagate a thrown HttpError from a function guard unchanged (401, not 403)', async () => {
    const authGuard: GuardFn = () => {
      throw new UnauthorizedError('Missing token');
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

    // The original UnauthorizedError (401) must reach the caller — not be
    // swallowed into a generic GuardRejectionError (403).
    await expect(routes[0].handler(mockCtx)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(routes[0].handler(mockCtx)).rejects.not.toBeInstanceOf(GuardRejectionError);
    await expect(routes[0].handler(mockCtx)).rejects.toMatchObject({
      status: 401,
      message: 'Missing token',
    });
  });

  it('should propagate a thrown HttpError from a class guard unchanged (401, not 403)', async () => {
    class AuthGuard implements CanActivate {
      canActivate(_ctx: GuardContext): boolean {
        throw new UnauthorizedError('Denied by class guard');
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

    await expect(routes[0].handler(mockCtx)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(routes[0].handler(mockCtx)).rejects.toMatchObject({ status: 401 });
  });

  it('should preserve an arbitrary thrown error from a guard (no conversion to 403)', async () => {
    const brokenGuard: GuardFn = () => {
      throw new TypeError('boom');
    };

    @UseGuard(brokenGuard)
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

    // A programming error in a guard must surface as-is, not be masked as 403.
    await expect(routes[0].handler(mockCtx)).rejects.toBeInstanceOf(TypeError);
    await expect(routes[0].handler(mockCtx)).rejects.not.toBeInstanceOf(GuardRejectionError);
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
