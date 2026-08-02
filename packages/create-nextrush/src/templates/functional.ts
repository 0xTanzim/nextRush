import { MIDDLEWARE_IMPORTS, MIDDLEWARE_SETUP } from '../constants.js';
import type { FileMap, ProjectOptions } from '../types.js';
import {
  getPortDeclaration,
  getRuntimeEntrypointImports,
} from './shared.js';

/**
 * Generates a functional-style NextRush project — route handlers + pure helper
 * functions, no classes or DI. Two features teach the idioms: a minimal health
 * check and a full todos CRUD (params, query, body, response codes, error paths)
 * backed by a pure, unit-testable in-memory store.
 */
export function generateFunctional(options: ProjectOptions): FileMap {
  const files: FileMap = new Map();

  files.set('src/index.ts', generateEntrypoint(options));
  files.set('src/routes/health.ts', generateHealthRoute());
  files.set('src/routes/health-status.ts', generateHealthStatus());
  files.set('src/routes/todos.ts', generateTodosRoute());
  files.set('src/routes/todos-data.ts', generateTodosData());
  files.set('src/routes/__tests__/health-status.test.ts', generateHealthStatusTest());
  files.set('src/routes/__tests__/todos-data.test.ts', generateTodosDataTest());

  return files;
}

function generateEntrypoint(options: ProjectOptions): string {
  const middlewareImports = MIDDLEWARE_IMPORTS[options.middleware];
  const middlewareSetup = MIDDLEWARE_SETUP[options.middleware];
  const portDecl = getPortDeclaration(options.runtime);

  const lines: string[] = [];

  lines.push(...getRuntimeEntrypointImports(options.runtime, 'listen'));

  if (middlewareImports) {
    lines.push(middlewareImports);
  }

  lines.push("import { healthRouter } from './routes/health.js';");
  lines.push("import { todosRouter } from './routes/todos.js';");
  lines.push('');
  lines.push('const router = createRouter();');
  lines.push('const app = createApp({ router });');
  lines.push(portDecl);
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
  lines.push('await listen(app, PORT);');
  lines.push('');

  return lines.join('\n');
}

function generateHealthRoute(): string {
  return `import { createRouter } from 'nextrush';

import { getHealthStatus } from './health-status.js';

export const healthRouter = createRouter();

healthRouter.get('/', (ctx) => {
  ctx.json(getHealthStatus());
});
`;
}

function generateHealthStatus(): string {
  return `/** Pure health-check payload builder — kept separate from the route so it's unit-testable
 * without spinning up an HTTP server. */
export function getHealthStatus(): { status: 'ok'; timestamp: string; uptime: number } {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };
}
`;
}

function generateHealthStatusTest(): string {
  return `import { describe, expect, it } from 'vitest';

import { getHealthStatus } from '../health-status.js';

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

function generateTodosRoute(): string {
  return `import { createRouter } from 'nextrush';

import { createTodoStore, type CreateTodoInput } from './todos-data.js';

const todoStore = createTodoStore();

export const todosRouter = createRouter();

todosRouter.get('/', (ctx) => {
  const status = typeof ctx.query.status === 'string' ? ctx.query.status : undefined;
  ctx.json(todoStore.list(status));
});

todosRouter.get('/:id', (ctx) => {
  const todo = todoStore.get(ctx.params.id);
  if (!todo) ctx.throw(404, 'Todo not found');
  ctx.json(todo);
});

todosRouter.post('/', (ctx) => {
  const input = (ctx.body ?? {}) as Partial<CreateTodoInput>;
  try {
    const todo = todoStore.create({ title: input.title ?? '', completed: input.completed });
    ctx.status = 201;
    ctx.json(todo);
  } catch (err) {
    ctx.throw(400, err instanceof Error ? err.message : 'Invalid todo');
  }
});

todosRouter.delete('/:id', (ctx) => {
  if (!todoStore.remove(ctx.params.id)) ctx.throw(404, 'Todo not found');
  ctx.status = 204;
});
`;
}

function generateTodosData(): string {
  return `export interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

export interface CreateTodoInput {
  title: string;
  completed?: boolean;
}

/** In-memory todo store. A factory returning a closure keeps state per-instance and
 * keeps every operation a pure function — unit-testable without an HTTP server. */
export function createTodoStore() {
  const todos = new Map<string, Todo>();
  let nextId = 1;

  return {
    list(status?: string): Todo[] {
      const all = [...todos.values()];
      if (status !== 'completed' && status !== 'pending') return all;
      const completed = status === 'completed';
      return all.filter((todo) => todo.completed === completed);
    },

    get(id: string): Todo | undefined {
      return todos.get(id);
    },

    create(input: CreateTodoInput): Todo {
      const title = input.title.trim();
      if (!title) throw new Error('Todo title is required');
      const todo: Todo = { id: String(nextId++), title, completed: input.completed ?? false };
      todos.set(todo.id, todo);
      return todo;
    },

    remove(id: string): boolean {
      return todos.delete(id);
    },
  };
}

export type TodoStore = ReturnType<typeof createTodoStore>;
`;
}

function generateTodosDataTest(): string {
  return `import { describe, expect, it } from 'vitest';

import { createTodoStore } from '../todos-data.js';

describe('createTodoStore', () => {
  it('creates and lists todos', () => {
    const store = createTodoStore();
    const created = store.create({ title: 'Ship NextRush', completed: false });

    expect(store.list()).toContainEqual(created);
  });

  it('filters todos by completion status', () => {
    const store = createTodoStore();
    store.create({ title: 'Done', completed: true });
    store.create({ title: 'Open', completed: false });

    expect(store.list('completed')).toHaveLength(1);
    expect(store.list('completed')[0].title).toBe('Done');
  });

  it('returns undefined for an unknown todo', () => {
    const store = createTodoStore();

    expect(store.get('missing')).toBeUndefined();
  });

  it('rejects an empty title', () => {
    const store = createTodoStore();

    expect(() => store.create({ title: '   ' })).toThrow(/required/i);
  });

  it('removes a todo and reports whether it existed', () => {
    const store = createTodoStore();
    const created = store.create({ title: 'Remove me', completed: false });

    expect(store.remove(created.id)).toBe(true);
    expect(store.remove(created.id)).toBe(false);
    expect(store.list()).toHaveLength(0);
  });
});
`;
}
