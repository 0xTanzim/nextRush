import { MIDDLEWARE_IMPORTS, MIDDLEWARE_SETUP } from '../constants.js';
import type { FileMap, ProjectOptions } from '../types.js';
import { generateConfig, getRuntimeEntrypointImports, getServerStartLine } from './shared.js';

/**
 * Generates a class-based (decorators + DI + modules) NextRush project.
 *
 * Layout: feature modules co-located under `src/modules/<feature>/`. The root
 * `AppModule` composes feature modules through `@Module({ imports })` — the same
 * composition pattern `registerModule` resolves at boot (nesting, dedupe, cycles).
 */
export function generateClassBased(options: ProjectOptions): FileMap {
  const files: FileMap = new Map();

  files.set('src/index.ts', generateEntrypoint(options));
  files.set('src/config/index.ts', generateConfig(options));
  files.set('src/app.module.ts', generateAppModule());
  files.set('src/modules/health/health.module.ts', generateHealthModule());
  files.set('src/modules/health/health.controller.ts', generateHealthController());
  files.set('src/modules/health/health.service.ts', generateHealthService());
  files.set('src/modules/todos/todos.module.ts', generateTodosModule());
  files.set('src/modules/todos/todos.controller.ts', generateTodosController());
  files.set('src/modules/todos/todos.service.ts', generateTodosService());
  files.set('src/modules/todos/todos.repository.ts', generateTodosRepository());
  files.set('src/modules/todos/__tests__/todos.service.test.ts', generateTodosServiceTest());
  files.set('src/modules/todos/__tests__/todos.controller.test.ts', generateTodosControllerTest());

  return files;
}

function generateEntrypoint(options: ProjectOptions): string {
  const middlewareImports = MIDDLEWARE_IMPORTS[options.middleware];
  const middlewareSetup = MIDDLEWARE_SETUP[options.middleware];
  const serverStartLine = getServerStartLine();

  const lines: string[] = [];

  lines.push(...getRuntimeEntrypointImports(options.runtime, 'serve'));
  lines.push("import { registerModule } from 'nextrush/class';");
  lines.push("import { AppModule } from './app.module.js';");
  lines.push("import { config } from './config/index.js';");

  if (middlewareImports) {
    lines.push(middlewareImports);
  }

  lines.push('');
  lines.push('const router = createRouter();');
  lines.push('const app = createApp({ router });');
  lines.push('');

  if (middlewareSetup) {
    lines.push('// Middleware');
    lines.push(middlewareSetup);
    lines.push('');
  }

  lines.push('// Wire the root module — registers the whole module graph in one call');
  lines.push("await registerModule(app, AppModule, { prefix: '/api' });");
  lines.push('');
  lines.push(serverStartLine);
  lines.push('');

  return lines.join('\n');
}

function generateAppModule(): string {
  return `import { Module } from 'nextrush/class';

import { HealthModule } from './modules/health/health.module.js';
import { TodosModule } from './modules/todos/todos.module.js';

@Module({
  imports: [HealthModule, TodosModule],
})
export class AppModule {}
`;
}

function generateHealthModule(): string {
  return `import { Module } from 'nextrush/class';

import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
`;
}

function generateHealthController(): string {
  return `import { Controller, Get } from 'nextrush/class';
import { HealthService } from './health.service.js';

@Controller('/health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  check() {
    return this.health.getHealth();
  }
}
`;
}

function generateHealthService(): string {
  return `import { Service } from 'nextrush/class';

@Service()
export class HealthService {
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.round(performance.now() / 1000),
    };
  }
}
`;
}

function generateTodosModule(): string {
  return `import { Module } from 'nextrush/class';

import { TodosController } from './todos.controller.js';
import { TodosRepository } from './todos.repository.js';
import { TodosService } from './todos.service.js';

@Module({
  controllers: [TodosController],
  providers: [TodosService, TodosRepository],
})
export class TodosModule {}
`;
}

function generateTodosController(): string {
  return `import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from 'nextrush/class';
import type { Todo } from './todos.repository.js';
import type { CreateTodoInput } from './todos.service.js';
import { TodosService } from './todos.service.js';

@Controller('/todos')
export class TodosController {
  constructor(private readonly todos: TodosService) {}

  @Get()
  list(@Query('status') status?: string): Todo[] {
    return this.todos.list(status);
  }

  @Get(':id')
  get(@Param('id') id: string): Todo {
    return this.todos.get(id);
  }

  @Post()
  @HttpCode(201)
  create(@Body() input: CreateTodoInput): Todo {
    return this.todos.create(input);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string): void {
    this.todos.remove(id);
  }
}
`;
}

function generateTodosService(): string {
  return `import { HttpError } from 'nextrush';
import { Service } from 'nextrush/class';
import { TodosRepository, type Todo } from './todos.repository.js';

export interface CreateTodoInput {
  title: string;
  completed?: boolean;
}

@Service()
export class TodosService {
  constructor(private readonly repository: TodosRepository) {}

  list(status?: string): Todo[] {
    const todos = this.repository.findAll();
    if (!status) return todos;
    const completed = status === 'completed';
    return todos.filter((todo) => todo.completed === completed);
  }

  get(id: string): Todo {
    const todo = this.repository.findById(id);
    if (!todo) throw new HttpError(404, 'Todo not found');
    return todo;
  }

  create(input: CreateTodoInput): Todo {
    const title = input.title.trim();
    if (!title) throw new HttpError(400, 'Todo title is required');
    return this.repository.create({ title, completed: input.completed ?? false });
  }

  remove(id: string): void {
    if (!this.repository.delete(id)) throw new HttpError(404, 'Todo not found');
  }
}
`;
}

function generateTodosRepository(): string {
  return `import { Repository } from 'nextrush/class';

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

@Repository()
export class TodosRepository {
  private readonly todos = new Map<string, Todo>();
  private nextId = 1;

  findAll(): Todo[] {
    return [...this.todos.values()];
  }

  findById(id: string): Todo | undefined {
    return this.todos.get(id);
  }

  create(input: Omit<Todo, 'id'>): Todo {
    const todo: Todo = { ...input, id: String(this.nextId++) };
    this.todos.set(todo.id, todo);
    return todo;
  }

  delete(id: string): boolean {
    return this.todos.delete(id);
  }
}
`;
}

function generateTodosServiceTest(): string {
  return `import { describe, expect, it } from 'vitest';

import { TodosRepository } from '../todos.repository.js';
import { TodosService } from '../todos.service.js';

describe('TodosService', () => {
  it('creates and lists todos', () => {
    const service = new TodosService(new TodosRepository());
    const created = service.create({ title: 'Ship NextRush', completed: false });

    expect(service.list()).toContainEqual(created);
  });

  it('filters todos by completion status', () => {
    const service = new TodosService(new TodosRepository());
    service.create({ title: 'Done', completed: true });
    service.create({ title: 'Open', completed: false });

    expect(service.list('completed')).toHaveLength(1);
    expect(service.list('completed')[0].title).toBe('Done');
  });

  it('throws a 404 for an unknown todo', () => {
    const service = new TodosService(new TodosRepository());

    expect(() => service.get('missing')).toThrow(/not found/i);
  });

  it('rejects an empty title', () => {
    const service = new TodosService(new TodosRepository());

    expect(() => service.create({ title: '   ' })).toThrow(/required/i);
  });
});
`;
}

function generateTodosControllerTest(): string {
  return `import { describe, expect, it } from 'vitest';

import { TodosController } from '../todos.controller.js';
import { TodosRepository } from '../todos.repository.js';
import { TodosService } from '../todos.service.js';

describe('TodosController', () => {
  it('creates a todo and lists it', () => {
    const controller = new TodosController(new TodosService(new TodosRepository()));
    const created = controller.create({ title: 'Test todo', completed: false });

    expect(controller.list()).toHaveLength(1);
    expect(controller.get(created.id)).toEqual(created);
  });

  it('deletes a todo by id', () => {
    const controller = new TodosController(new TodosService(new TodosRepository()));
    const created = controller.create({ title: 'Remove me', completed: false });

    expect(() => controller.remove(created.id)).not.toThrow();
    expect(controller.list()).toHaveLength(0);
  });
});
`;
}
