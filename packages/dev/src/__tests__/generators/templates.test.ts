import { describe, expect, it } from 'vitest';
import {
  controllerTemplate,
  GENERATOR_ALIASES,
  GENERATOR_TYPES,
  GENERATORS,
  guardTemplate,
  middlewareTemplate,
  moduleTemplate,
  routeTemplate,
  serviceTemplate,
  toCamelCase,
  toPascalCase,
} from '../../generators/templates.js';

// ─── Name Casing ─────────────────────────────────────────────────────────

describe('toPascalCase', () => {
  it('capitalises a single word', () => {
    expect(toPascalCase('user')).toBe('User');
  });

  it('converts kebab-case to PascalCase', () => {
    expect(toPascalCase('user-profile')).toBe('UserProfile');
  });

  it('handles multi-segment names', () => {
    expect(toPascalCase('admin-user-settings')).toBe('AdminUserSettings');
  });

  it('handles single character', () => {
    expect(toPascalCase('a')).toBe('A');
  });
});

describe('toCamelCase', () => {
  it('returns lowercase single word', () => {
    expect(toCamelCase('user')).toBe('user');
  });

  it('converts kebab-case to camelCase', () => {
    expect(toCamelCase('user-profile')).toBe('userProfile');
  });
});

// ─── Controller Template ─────────────────────────────────────────────────

describe('controllerTemplate', () => {
  it('generates a class with correct name', () => {
    const output = controllerTemplate('user');
    expect(output).toContain('export class UserController');
  });

  it('uses kebab-case as route path', () => {
    const output = controllerTemplate('user-profile');
    expect(output).toContain("@Controller('/user-profile')");
  });

  it('imports class-based decorators from nextrush/class', () => {
    const output = controllerTemplate('user');
    expect(output).toContain(
      "import { Body, Controller, Get, Param, Post } from 'nextrush/class'"
    );
  });

  it('does not import class-based decorators from the bare nextrush root', () => {
    const output = controllerTemplate('user');
    // Controller/Get/Post/Body/Param live in the 'nextrush/class' subpath,
    // not the functional root entry — importing from 'nextrush' fails to compile.
    expect(output).not.toContain("from 'nextrush'");
  });

  it('includes CRUD method stubs', () => {
    const output = controllerTemplate('user');
    expect(output).toContain('@Get()');
    expect(output).toContain("@Get('/:id')");
    expect(output).toContain('@Post()');
    expect(output).toContain('findAll');
    expect(output).toContain('findOne');
    expect(output).toContain('create');
  });

  it('injects the matching service via constructor DI', () => {
    const output = controllerTemplate('user');
    expect(output).toContain("constructor(private readonly userService: UserService)");
    expect(output).toContain("import { UserService } from './user.service.js'");
    expect(output).toContain('this.userService.findAll()');
    expect(output).toContain('this.userService.findOne(id)');
    expect(output).toContain('this.userService.create(data)');
  });

  it('uses PascalCase for multi-word names', () => {
    const output = controllerTemplate('order-item');
    expect(output).toContain('export class OrderItemController');
    expect(output).toContain("constructor(private readonly orderItemService: OrderItemService)");
  });
});

// ─── Service Template ────────────────────────────────────────────────────

describe('serviceTemplate', () => {
  it('generates a class with correct name', () => {
    const output = serviceTemplate('user');
    expect(output).toContain('export class UserService');
  });

  it('uses @Service() decorator', () => {
    const output = serviceTemplate('user');
    expect(output).toContain('@Service()');
  });

  it('imports Service from nextrush/class', () => {
    const output = serviceTemplate('user');
    expect(output).toContain("import { Service } from 'nextrush/class'");
  });

  it('does not import Service from the bare nextrush root', () => {
    const output = serviceTemplate('user');
    // @Service is a DI decorator re-exported from 'nextrush/class', not the root.
    expect(output).not.toContain("Service } from 'nextrush'");
    expect(output).toContain("import { Service } from 'nextrush/class'");
  });

  it('includes CRUD method stubs', () => {
    const output = serviceTemplate('user');
    expect(output).toContain('findAll');
    expect(output).toContain('findOne');
    expect(output).toContain('create');
  });

  it('uses HttpError for 404 and 400 paths (from the nextrush root)', () => {
    const output = serviceTemplate('user');
    expect(output).toContain("import { HttpError } from 'nextrush';");
    expect(output).toContain("throw new HttpError(404, 'Not found')");
    expect(output).toContain("throw new HttpError(400, 'Invalid input')");
  });
});

// ─── Module Template ─────────────────────────────────────────────────────

describe('moduleTemplate', () => {
  it('generates a class with correct name', () => {
    const output = moduleTemplate('todos');
    expect(output).toContain('export class TodosModule');
  });

  it('uses @Module() decorator with controllers and providers', () => {
    const output = moduleTemplate('todos');
    expect(output).toContain('@Module({');
    expect(output).toContain('controllers: [TodosController]');
    expect(output).toContain('providers: [TodosService]');
  });

  it('imports the co-located controller and service', () => {
    const output = moduleTemplate('todos');
    expect(output).toContain("import { TodosController } from './todos.controller.js';");
    expect(output).toContain("import { TodosService } from './todos.service.js';");
  });

  it('imports Module from nextrush/class', () => {
    const output = moduleTemplate('todos');
    expect(output).toContain("import { Module } from 'nextrush/class'");
  });
});

// ─── Middleware Template ─────────────────────────────────────────────────

describe('middlewareTemplate', () => {
  it('generates a named export function', () => {
    const output = middlewareTemplate('logger');
    expect(output).toContain('export const logger: Middleware');
  });

  it('uses camelCase for multi-word names', () => {
    const output = middlewareTemplate('request-timer');
    expect(output).toContain('export const requestTimer: Middleware');
  });

  it('imports Middleware type from nextrush', () => {
    const output = middlewareTemplate('logger');
    expect(output).toContain("import type { Middleware } from 'nextrush'");
  });

  it('calls ctx.next()', () => {
    const output = middlewareTemplate('logger');
    expect(output).toContain('await ctx.next()');
  });
});

// ─── Guard Template ──────────────────────────────────────────────────────

describe('guardTemplate', () => {
  it('generates a named export with Guard suffix', () => {
    const output = guardTemplate('auth');
    expect(output).toContain('export const authGuard: GuardFn');
  });

  it('uses camelCase for multi-word names', () => {
    const output = guardTemplate('role-check');
    expect(output).toContain('export const roleCheckGuard: GuardFn');
  });

  it('imports GuardFn from nextrush/class', () => {
    const output = guardTemplate('auth');
    expect(output).toContain("import type { GuardFn } from 'nextrush/class'");
  });

  it('does not import GuardFn from the bare nextrush root', () => {
    const output = guardTemplate('auth');
    // GuardFn is a decorator/type re-exported from 'nextrush/class', not the root.
    expect(output).not.toContain("from 'nextrush'");
  });

  it('checks authorization header', () => {
    const output = guardTemplate('auth');
    expect(output).toContain("ctx.get('authorization')");
  });
});

// ─── Route Template ──────────────────────────────────────────────────────

describe('routeTemplate', () => {
  it('imports createRouter from nextrush', () => {
    const output = routeTemplate('products');
    expect(output).toContain("import { createRouter } from 'nextrush'");
  });

  it('creates a named-export router (matches the functional template idiom)', () => {
    const output = routeTemplate('products');
    expect(output).toContain('export const productsRouter = createRouter()');
    expect(output).not.toContain('export default');
  });

  it('uses camelCase router name for multi-word names', () => {
    const output = routeTemplate('order-item');
    expect(output).toContain('export const orderItemRouter = createRouter()');
  });

  it('includes GET and POST routes with params, body, and status codes', () => {
    const output = routeTemplate('products');
    expect(output).toContain("productsRouter.get('/'");
    expect(output).toContain("productsRouter.get('/:id'");
    expect(output).toContain("productsRouter.post('/'");
    expect(output).toContain('ctx.params.id');
    expect(output).toContain('ctx.body');
    expect(output).toContain('ctx.status = 201');
  });

  it('does not use class-based decorators', () => {
    const output = routeTemplate('products');
    expect(output).not.toContain('@Controller');
    expect(output).not.toContain('@Get');
  });
});

// ─── Registry ────────────────────────────────────────────────────────────

describe('GENERATOR_TYPES', () => {
  it('contains all 6 types', () => {
    expect(GENERATOR_TYPES).toEqual([
      'controller',
      'service',
      'middleware',
      'guard',
      'route',
      'module',
    ]);
  });
});

describe('GENERATOR_ALIASES', () => {
  it('maps short aliases to types', () => {
    expect(GENERATOR_ALIASES['c']).toBe('controller');
    expect(GENERATOR_ALIASES['s']).toBe('service');
    expect(GENERATOR_ALIASES['m']).toBe('module');
    expect(GENERATOR_ALIASES['mw']).toBe('middleware');
    expect(GENERATOR_ALIASES['g']).toBe('guard');
    expect(GENERATOR_ALIASES['r']).toBe('route');
  });
});

describe('GENERATORS', () => {
  it('has config for every type', () => {
    for (const type of GENERATOR_TYPES) {
      const config = GENERATORS[type];
      expect(config).toBeDefined();
      expect(typeof config.template).toBe('function');
      expect(typeof config.directory).toBe('string');
      expect(typeof config.suffix).toBe('string');
    }
  });

  it('controller writes to src/controllers with .controller.ts suffix', () => {
    expect(GENERATORS.controller.directory).toBe('src/controllers');
    expect(GENERATORS.controller.suffix).toBe('.controller.ts');
  });

  it('service writes to src/services with .service.ts suffix', () => {
    expect(GENERATORS.service.directory).toBe('src/services');
    expect(GENERATORS.service.suffix).toBe('.service.ts');
  });

  it('middleware writes to src/middleware with .ts suffix', () => {
    expect(GENERATORS.middleware.directory).toBe('src/middleware');
    expect(GENERATORS.middleware.suffix).toBe('.ts');
  });

  it('guard writes to src/guards with .guard.ts suffix', () => {
    expect(GENERATORS.guard.directory).toBe('src/guards');
    expect(GENERATORS.guard.suffix).toBe('.guard.ts');
  });

  it('route writes to src/routes with .ts suffix', () => {
    expect(GENERATORS.route.directory).toBe('src/routes');
    expect(GENERATORS.route.suffix).toBe('.ts');
  });

  it('module writes to src/modules with .module.ts suffix', () => {
    expect(GENERATORS.module.directory).toBe('src/modules');
    expect(GENERATORS.module.suffix).toBe('.module.ts');
  });
});
