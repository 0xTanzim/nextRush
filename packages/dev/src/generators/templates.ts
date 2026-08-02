/**
 * @nextrush/dev - Generator Templates
 *
 * Pure functions that produce file content for each generator type.
 * No I/O — all string generation for testability.
 *
 * @packageDocumentation
 */

/**
 * Convert a kebab-case or lowercase name to PascalCase.
 *
 * @example toPascalCase('user') => 'User'
 * @example toPascalCase('user-profile') => 'UserProfile'
 */
export function toPascalCase(name: string): string {
  return name
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');
}

/**
 * Convert a name to camelCase.
 *
 * @example toCamelCase('user') => 'user'
 * @example toCamelCase('user-profile') => 'userProfile'
 */
export function toCamelCase(name: string): string {
  const pascal = toPascalCase(name);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

// ─── Controller (class-based) ────────────────────────────────────────────

export function controllerTemplate(name: string): string {
  const className = `${toPascalCase(name)}Controller`;
  const serviceName = `${toPascalCase(name)}Service`;
  const serviceRef = `${toCamelCase(name)}Service`;
  return `import { Body, Controller, Get, Param, Post } from 'nextrush/class';
import { ${serviceName} } from './${name}.service.js';

@Controller('/${name}')
export class ${className} {
  constructor(private readonly ${serviceRef}: ${serviceName}) {}

  @Get()
  findAll() {
    return this.${serviceRef}.findAll();
  }

  @Get('/:id')
  findOne(@Param('id') id: string) {
    return this.${serviceRef}.findOne(id);
  }

  @Post()
  create(@Body() data: unknown) {
    return this.${serviceRef}.create(data);
  }
}
`;
}

// ─── Service (class-based) ───────────────────────────────────────────────

export function serviceTemplate(name: string): string {
  const className = `${toPascalCase(name)}Service`;
  return `import { HttpError } from 'nextrush';
import { Service } from 'nextrush/class';

@Service()
export class ${className} {
  findAll() {
    return [];
  }

  findOne(id: string) {
    if (!id) throw new HttpError(404, 'Not found');
    return { id };
  }

  create(data: unknown) {
    if (!data || typeof data !== 'object') throw new HttpError(400, 'Invalid input');
    return data;
  }
}
`;
}

// ─── Module (class-based feature module) ─────────────────────────────────

export function moduleTemplate(name: string): string {
  const className = `${toPascalCase(name)}Module`;
  const controllerName = `${toPascalCase(name)}Controller`;
  const serviceName = `${toPascalCase(name)}Service`;
  return `import { Module } from 'nextrush/class';

import { ${controllerName} } from './${name}.controller.js';
import { ${serviceName} } from './${name}.service.js';

@Module({
  controllers: [${controllerName}],
  providers: [${serviceName}],
})
export class ${className} {}
`;
}

// ─── Middleware ───────────────────────────────────────────────────────────

export function middlewareTemplate(name: string): string {
  const fnName = toCamelCase(name);
  return `import type { Middleware } from 'nextrush';

export const ${fnName}: Middleware = async (ctx) => {
  const start = Date.now();
  await ctx.next();
  const duration = Date.now() - start;
  console.log(\`\${ctx.method} \${ctx.path} \${ctx.status} \${duration}ms\`);
};
`;
}

// ─── Guard ───────────────────────────────────────────────────────────────

export function guardTemplate(name: string): string {
  const fnName = `${toCamelCase(name)}Guard`;
  return `import type { GuardFn } from 'nextrush/class';

export const ${fnName}: GuardFn = async (ctx) => {
  const token = ctx.get('authorization');
  if (!token) return false;
  // TODO: Validate token
  return true;
};
`;
}

// ─── Route (functional) ─────────────────────────────────────────────────

export function routeTemplate(name: string): string {
  const routerName = `${toCamelCase(name)}Router`;
  return `import { createRouter } from 'nextrush';

export const ${routerName} = createRouter();

${routerName}.get('/', (ctx) => {
  ctx.json([]);
});

${routerName}.get('/:id', (ctx) => {
  ctx.json({ id: ctx.params.id });
});

${routerName}.post('/', (ctx) => {
  ctx.status = 201;
  ctx.json(ctx.body);
});
`;
}

// ─── Template Registry ──────────────────────────────────────────────────

export type GeneratorType = 'controller' | 'service' | 'middleware' | 'guard' | 'route' | 'module';

export const GENERATOR_TYPES: readonly GeneratorType[] = [
  'controller',
  'service',
  'middleware',
  'guard',
  'route',
  'module',
];

/** Short aliases for generator types */
export const GENERATOR_ALIASES: Record<string, GeneratorType> = {
  c: 'controller',
  s: 'service',
  mw: 'middleware',
  g: 'guard',
  r: 'route',
  m: 'module',
};

interface GeneratorConfig {
  template: (name: string) => string;
  directory: string;
  suffix: string;
}

/** Configuration for each generator type */
export const GENERATORS: Record<GeneratorType, GeneratorConfig> = {
  controller: {
    template: controllerTemplate,
    directory: 'src/controllers',
    suffix: '.controller.ts',
  },
  service: {
    template: serviceTemplate,
    directory: 'src/services',
    suffix: '.service.ts',
  },
  middleware: {
    template: middlewareTemplate,
    directory: 'src/middleware',
    suffix: '.ts',
  },
  guard: {
    template: guardTemplate,
    directory: 'src/guards',
    suffix: '.guard.ts',
  },
  route: {
    template: routeTemplate,
    directory: 'src/routes',
    suffix: '.ts',
  },
  module: {
    template: moduleTemplate,
    directory: 'src/modules',
    suffix: '.module.ts',
  },
};
