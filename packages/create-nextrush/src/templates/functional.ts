import { MIDDLEWARE_IMPORTS, MIDDLEWARE_SETUP } from '../constants.js';
import type { FileMap, ProjectOptions } from '../types.js';
import { getRuntimeEntrypointImports } from './shared.js';

/**
 * Generates a functional-style NextRush project — a professional, production-grade
 * layered API: routes → services → repositories, with centralized config, shared
 * domain types, and custom middleware. No classes, decorators, or DI — pure
 * factory functions throughout.
 *
 * Two features teach the idioms: a minimal health check and a full todos CRUD
 * (params, query, body, response codes, error paths) backed by a pure,
 * unit-testable in-memory repository.
 */
export function generateFunctional(options: ProjectOptions): FileMap {
  const files: FileMap = new Map();

  files.set('src/index.ts', generateEntrypoint(options));
  files.set('src/config/index.ts', generateConfig(options));
  files.set('src/lib/types.ts', generateTypes());
  files.set('src/middleware/logger.ts', generateLogger());
  files.set('src/routes/health.routes.ts', generateHealthRoute());
  files.set('src/routes/todos.routes.ts', generateTodosRoute());
  files.set('src/services/health.service.ts', generateHealthService());
  files.set('src/services/todos.service.ts', generateTodosService());
  files.set('src/services/__tests__/health.service.test.ts', generateHealthServiceTest());
  files.set('src/services/__tests__/todos.service.test.ts', generateTodosServiceTest());
  files.set('src/repositories/todos.repository.ts', generateTodosRepository());
  files.set('src/repositories/__tests__/todos.repository.test.ts', generateTodosRepositoryTest());

  return files;
}

function generateEntrypoint(options: ProjectOptions): string {
  const middlewareImports = MIDDLEWARE_IMPORTS[options.middleware];
  const middlewareSetup = MIDDLEWARE_SETUP[options.middleware];

  const lines: string[] = [];

  lines.push(...getRuntimeEntrypointImports(options.runtime, 'listen', ['errorHandler']));

  if (middlewareImports) {
    lines.push(middlewareImports);
  }

  lines.push("import { config } from './config/index.js';");
  lines.push("import { logger } from './middleware/logger.js';");
  lines.push("import { healthRouter } from './routes/health.routes.js';");
  lines.push("import { todosRouter } from './routes/todos.routes.js';");
  lines.push('');
  lines.push('const router = createRouter();');
  lines.push('const app = createApp({ router });');
  lines.push('');
  lines.push('// Error handling (first middleware — catches all downstream errors)');
  lines.push("app.use(errorHandler({ includeStack: config.nodeEnv !== 'production' }));");
  lines.push('');
  lines.push('// Request logging');
  lines.push('app.use(logger());');
  lines.push('');

  if (middlewareSetup) {
    lines.push('// Middleware');
    lines.push(middlewareSetup);
    lines.push('');
  }

  lines.push('// Routes');
  lines.push("router.get('/', (ctx) => {");
  lines.push("  ctx.json({ message: 'Welcome to NextRush!' });");
  lines.push('});');
  lines.push('');
  lines.push("app.route('/health', healthRouter);");
  lines.push("app.route('/todos', todosRouter);");
  lines.push('');
  lines.push('await listen(app, config.port);');
  lines.push('');

  return lines.join('\n');
}

function generateConfig(options: ProjectOptions): string {
  // capability-exempt: scaffolder emits a runtime-specific env-reading snippet for the GENERATED project's config; not a capability decision in this CLI's own request path
  if (options.runtime === 'deno') {
    return `/** Centralized environment configuration.
 *
 * Read each variable once, convert its type, and provide a default — don't
 * scatter Deno.env.get calls across route handlers. Fail fast on missing
 * required values at startup, not deep in a request handler.
 *
 * @see https://nextrush.dev/docs/production/configuration
 */
export const config = {
  port: Number(Deno.env.get('PORT') ?? 8080),
  host: Deno.env.get('HOST') ?? '0.0.0.0',
  nodeEnv: Deno.env.get('NODE_ENV') ?? 'development',
};
`;
  }

  return `/** Centralized environment configuration.
 *
 * Read each variable once, convert its type, and provide a default — don't
 * scatter process.env reads across route handlers. Fail fast on missing
 * required values at startup, not deep in a request handler.
 *
 * @see https://nextrush.dev/docs/production/configuration
 */
export const config = {
  port: Number(process.env.PORT ?? 8080),
  host: process.env.HOST ?? '0.0.0.0',
  nodeEnv: process.env.NODE_ENV ?? 'development',
};
`;
}

function generateTypes(): string {
  return `/** Shared domain types — the application's data contract, independent of
 * any specific layer (route, service, or repository). */
export interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

export interface CreateTodoInput {
  title: string;
  completed?: boolean;
}
`;
}

function generateLogger(): string {
  return `import type { Middleware } from 'nextrush';

/** Request logger — logs the HTTP method, path, status code, and duration for
 * every request. A simple example of a before/after middleware (wraps next()). */
export function logger(): Middleware {
  return async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    console.info(ctx.method + ' ' + ctx.path + ' ' + ctx.status + ' - ' + ms + 'ms');
  };
}
`;
}

function generateHealthRoute(): string {
  return `import { createRouter } from 'nextrush';

import { getHealthStatus } from '../services/health.service.js';

export const healthRouter = createRouter();

healthRouter.get('/', (ctx) => {
  ctx.json(getHealthStatus());
});
`;
}

function generateTodosRoute(): string {
  return `import { createRouter } from 'nextrush';

import type { CreateTodoInput } from '../lib/types.js';
import { createTodoRepository } from '../repositories/todos.repository.js';
import { createTodoService } from '../services/todos.service.js';

const todoService = createTodoService(createTodoRepository());

export const todosRouter = createRouter();

todosRouter.get('/', (ctx) => {
  const status = typeof ctx.query.status === 'string' ? ctx.query.status : undefined;
  ctx.json(todoService.list(status));
});

todosRouter.get('/:id', (ctx) => {
  ctx.json(todoService.get(ctx.params.id));
});

todosRouter.post('/', (ctx) => {
  const input = (ctx.body ?? {}) as Partial<CreateTodoInput>;
  ctx.status = 201;
  ctx.json(todoService.create({ title: input.title ?? '', completed: input.completed }));
});

todosRouter.delete('/:id', (ctx) => {
  todoService.remove(ctx.params.id);
  ctx.status = 204;
});
`;
}

function generateHealthService(): string {
  return `/** Pure health-check payload builder — kept separate from the route so it's
 * unit-testable without spinning up an HTTP server. */
export function getHealthStatus(): {
  status: 'ok';
  timestamp: string;
  uptime: number;
} {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.round(performance.now() / 1000),
  };
}
`;
}

function generateTodosService(): string {
  return `import { BadRequestError, NotFoundError } from 'nextrush';

import type { CreateTodoInput, Todo } from '../lib/types.js';
import type { TodoRepository } from '../repositories/todos.repository.js';

/** Todo business logic — validation and filtering layered over the repository.
 * Throws framework HTTP errors (NotFoundError / BadRequestError) for expected
 * error conditions; the built-in errorHandler middleware formats the response. */
export function createTodoService(repository: TodoRepository) {
  return {
    list(status?: string): Todo[] {
      const all = repository.findAll();
      if (status !== 'completed' && status !== 'pending') return all;
      const completed = status === 'completed';
      return all.filter((todo) => todo.completed === completed);
    },

    get(id: string): Todo {
      const todo = repository.findById(id);
      if (!todo) throw new NotFoundError('Todo not found');
      return todo;
    },

    create(input: CreateTodoInput): Todo {
      const title = input.title.trim();
      if (!title) throw new BadRequestError('Todo title is required');
      return repository.save({ title, completed: input.completed ?? false });
    },

    remove(id: string): void {
      if (!repository.delete(id)) throw new NotFoundError('Todo not found');
    },
  };
}

export type TodoService = ReturnType<typeof createTodoService>;
`;
}

function generateTodosRepository(): string {
  return `import type { Todo } from '../lib/types.js';

/** In-memory todo repository — pure data access with no business logic.
 * A factory returning a closure keeps state per-instance (no global mutable
 * state) and keeps every operation unit-testable without an HTTP server. */
export function createTodoRepository() {
  const todos = new Map<string, Todo>();
  let nextId = 1;

  return {
    findAll(): Todo[] {
      return [...todos.values()];
    },

    findById(id: string): Todo | undefined {
      return todos.get(id);
    },

    save(input: Omit<Todo, 'id'>): Todo {
      const todo: Todo = { ...input, id: String(nextId++) };
      todos.set(todo.id, todo);
      return todo;
    },

    delete(id: string): boolean {
      return todos.delete(id);
    },
  };
}

export type TodoRepository = ReturnType<typeof createTodoRepository>;
`;
}

function generateHealthServiceTest(): string {
  return `import { describe, expect, it } from 'vitest';

import { getHealthStatus } from '../health.service.js';

describe('getHealthStatus', () => {
  it('reports status ok with a timestamp and uptime', () => {
    const result = getHealthStatus();

    expect(result.status).toBe('ok');
    expect(new Date(result.timestamp).toString()).not.toBe('Invalid Date');
    expect(result.uptime).toBeGreaterThanOrEqual(0);
  });
});
`;
}

function generateTodosServiceTest(): string {
  return `import { describe, expect, it } from 'vitest';

import { BadRequestError, NotFoundError } from 'nextrush';
import { createTodoRepository } from '../../repositories/todos.repository.js';
import { createTodoService } from '../todos.service.js';

describe('createTodoService', () => {
  it('creates and lists todos', () => {
    const service = createTodoService(createTodoRepository());
    const created = service.create({ title: 'Ship NextRush', completed: false });

    expect(service.list()).toContainEqual(created);
  });

  it('filters todos by completion status', () => {
    const service = createTodoService(createTodoRepository());
    service.create({ title: 'Done', completed: true });
    service.create({ title: 'Open', completed: false });

    expect(service.list('completed')).toHaveLength(1);
    expect(service.list('completed')[0].title).toBe('Done');
  });

  it('throws NotFoundError for an unknown todo', () => {
    const service = createTodoService(createTodoRepository());

    expect(() => service.get('missing')).toThrow(NotFoundError);
  });

  it('throws BadRequestError for an empty title', () => {
    const service = createTodoService(createTodoRepository());

    expect(() => service.create({ title: '   ' })).toThrow(BadRequestError);
  });

  it('removes a todo and throws NotFoundError if already removed', () => {
    const service = createTodoService(createTodoRepository());
    const created = service.create({ title: 'Remove me', completed: false });

    service.remove(created.id);
    expect(() => service.remove(created.id)).toThrow(NotFoundError);
    expect(service.list()).toHaveLength(0);
  });
});
`;
}

function generateTodosRepositoryTest(): string {
  return `import { describe, expect, it } from 'vitest';

import { createTodoRepository } from '../todos.repository.js';

describe('createTodoRepository', () => {
  it('saves and finds all todos', () => {
    const repo = createTodoRepository();
    const created = repo.save({ title: 'Ship NextRush', completed: false });

    expect(repo.findAll()).toContainEqual(created);
  });

  it('finds a todo by id', () => {
    const repo = createTodoRepository();
    const created = repo.save({ title: 'Test', completed: false });

    expect(repo.findById(created.id)).toEqual(created);
  });

  it('returns undefined for an unknown id', () => {
    const repo = createTodoRepository();

    expect(repo.findById('missing')).toBeUndefined();
  });

  it('deletes a todo and reports whether it existed', () => {
    const repo = createTodoRepository();
    const created = repo.save({ title: 'Remove me', completed: false });

    expect(repo.delete(created.id)).toBe(true);
    expect(repo.delete(created.id)).toBe(false);
    expect(repo.findAll()).toHaveLength(0);
  });
});
`;
}

