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
  return `import { Controller, Get, Post, Body, Param } from 'nextrush';

@Controller('/${name}')
export class ${className} {
  @Get()
  async findAll() {
    return [];
  }

  @Get('/:id')
  async findOne(@Param('id') id: string) {
    return { id };
  }

  @Post()
  async create(@Body() data: unknown) {
    return data;
  }
}
`;
}

// ─── Service (class-based) ───────────────────────────────────────────────

export function serviceTemplate(name: string): string {
  const className = `${toPascalCase(name)}Service`;
  return `import { Service } from 'nextrush';

@Service()
export class ${className} {
  async findAll() {
    return [];
  }

  async findOne(id: string) {
    return { id };
  }

  async create(data: unknown) {
    return data;
  }
}
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
  return `import type { GuardFn } from 'nextrush';

export const ${fnName}: GuardFn = async (ctx) => {
  const token = ctx.get('authorization');
  if (!token) return false;
  // TODO: Validate token
  return true;
};
`;
}

// ─── Route (functional) ─────────────────────────────────────────────────

export function routeTemplate(_name: string): string {
  return `import { createRouter } from 'nextrush';

const router = createRouter();

router.get('/', (ctx) => {
  ctx.json([]);
});

router.get('/:id', (ctx) => {
  ctx.json({ id: ctx.params.id });
});

router.post('/', (ctx) => {
  ctx.json(ctx.body);
});

export default router;
`;
}

// ─── Template Registry ──────────────────────────────────────────────────

export type GeneratorType = 'controller' | 'service' | 'middleware' | 'guard' | 'route';

export const GENERATOR_TYPES: readonly GeneratorType[] = [
  'controller',
  'service',
  'middleware',
  'guard',
  'route',
];

/** Short aliases for generator types */
export const GENERATOR_ALIASES: Record<string, GeneratorType> = {
  c: 'controller',
  s: 'service',
  mw: 'middleware',
  g: 'guard',
  r: 'route',
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
};
