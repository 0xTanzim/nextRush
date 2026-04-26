import { describe, expect, it } from 'vitest';
import {
  controllerTemplate,
  GENERATOR_ALIASES,
  GENERATOR_TYPES,
  GENERATORS,
  guardTemplate,
  middlewareTemplate,
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

  it('imports from nextrush', () => {
    const output = controllerTemplate('user');
    expect(output).toContain("import { Controller, Get, Post, Body, Param } from 'nextrush'");
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

  it('uses PascalCase for multi-word names', () => {
    const output = controllerTemplate('order-item');
    expect(output).toContain('export class OrderItemController');
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

  it('imports from nextrush', () => {
    const output = serviceTemplate('user');
    expect(output).toContain("import { Service } from 'nextrush'");
  });

  it('includes CRUD method stubs', () => {
    const output = serviceTemplate('user');
    expect(output).toContain('findAll');
    expect(output).toContain('findOne');
    expect(output).toContain('create');
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

  it('imports GuardFn from nextrush', () => {
    const output = guardTemplate('auth');
    expect(output).toContain("import type { GuardFn } from 'nextrush'");
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

  it('creates a router and exports it as default', () => {
    const output = routeTemplate('products');
    expect(output).toContain('const router = createRouter()');
    expect(output).toContain('export default router');
  });

  it('includes GET and POST routes', () => {
    const output = routeTemplate('products');
    expect(output).toContain("router.get('/'");
    expect(output).toContain("router.get('/:id'");
    expect(output).toContain("router.post('/'");
  });

  it('does not use class-based decorators', () => {
    const output = routeTemplate('products');
    expect(output).not.toContain('@Controller');
    expect(output).not.toContain('@Get');
  });
});

// ─── Registry ────────────────────────────────────────────────────────────

describe('GENERATOR_TYPES', () => {
  it('contains all 5 types', () => {
    expect(GENERATOR_TYPES).toEqual(['controller', 'service', 'middleware', 'guard', 'route']);
  });
});

describe('GENERATOR_ALIASES', () => {
  it('maps short aliases to types', () => {
    expect(GENERATOR_ALIASES['c']).toBe('controller');
    expect(GENERATOR_ALIASES['s']).toBe('service');
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
});
