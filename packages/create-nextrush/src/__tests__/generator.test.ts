import { beforeEach, describe, expect, it } from 'vitest';

import { generateProject } from '../generator.js';
import type { ProjectOptions } from '../types.js';
import { seedAllPackageVersions } from './test-helpers.js';

beforeEach(() => {
  seedAllPackageVersions('^3.0.5');
});

function createOptions(overrides: Partial<ProjectOptions> = {}): ProjectOptions {
  return {
    name: 'test-app',
    directory: './test-app',
    style: 'functional',
    runtime: 'node',
    middleware: 'minimal',
    packageManager: 'pnpm',
    git: true,
    install: true,
    ...overrides,
  };
}

describe('generateProject', () => {
  describe('shared files', () => {
    it('generates tsconfig.json with strict mode', () => {
      const files = generateProject(createOptions());
      expect(files.has('tsconfig.json')).toBe(true);

      const tsconfig = JSON.parse(files.get('tsconfig.json')!);
      expect(tsconfig.compilerOptions.strict).toBe(true);
      expect(tsconfig.compilerOptions.target).toBe('ES2022');
      expect(tsconfig.compilerOptions.module).toBe('NodeNext');
    });

    it('enables decorator options for class-based style', () => {
      const files = generateProject(createOptions({ style: 'class-based' }));
      const tsconfig = JSON.parse(files.get('tsconfig.json')!);
      expect(tsconfig.compilerOptions.experimentalDecorators).toBe(true);
      expect(tsconfig.compilerOptions.emitDecoratorMetadata).toBe(true);
    });

    it('enables decorator options for full style', () => {
      const files = generateProject(createOptions({ style: 'full' }));
      const tsconfig = JSON.parse(files.get('tsconfig.json')!);
      expect(tsconfig.compilerOptions.experimentalDecorators).toBe(true);
      expect(tsconfig.compilerOptions.emitDecoratorMetadata).toBe(true);
    });

    it('does not enable decorators for functional style', () => {
      const files = generateProject(createOptions({ style: 'functional' }));
      const tsconfig = JSON.parse(files.get('tsconfig.json')!);
      expect(tsconfig.compilerOptions.experimentalDecorators).toBeUndefined();
      expect(tsconfig.compilerOptions.emitDecoratorMetadata).toBeUndefined();
    });

    it('generates package.json with correct name and scripts', () => {
      const files = generateProject(createOptions({ name: 'my-cool-app' }));
      const pkg = JSON.parse(files.get('package.json')!);
      expect(pkg.name).toBe('my-cool-app');
      expect(pkg.type).toBe('module');
      expect(pkg.scripts.dev).toBe('nextrush dev');
      expect(pkg.scripts.build).toBe('nextrush build');
      expect(pkg.scripts.start).toBe('node dist/index.js');
    });

    it('generates README.md with project name', () => {
      const files = generateProject(createOptions({ name: 'test-project' }));
      const readme = files.get('README.md')!;
      expect(readme).toContain('# test-project');
      expect(readme).toContain('NextRush');
    });

    it('always generates .gitignore', () => {
      const withGit = generateProject(createOptions({ git: true }));
      const withoutGit = generateProject(createOptions({ git: false }));
      expect(withGit.has('.gitignore')).toBe(true);
      expect(withoutGit.has('.gitignore')).toBe(true);
      expect(withGit.get('.gitignore')).toContain('node_modules');
    });

    it('generates env.d.ts', () => {
      const files = generateProject(createOptions());
      expect(files.has('src/env.d.ts')).toBe(true);
      expect(files.get('src/env.d.ts')).toContain('@nextrush/types');
    });

    it('includes nextrush as dependency', () => {
      const files = generateProject(createOptions());
      const pkg = JSON.parse(files.get('package.json')!);
      expect(pkg.dependencies['nextrush']).toBeDefined();
    });

    it('always includes @nextrush/dev and typescript in devDeps', () => {
      const files = generateProject(createOptions());
      const pkg = JSON.parse(files.get('package.json')!);
      expect(pkg.devDependencies['@nextrush/dev']).toBeDefined();
      expect(pkg.devDependencies['@nextrush/types']).toBeDefined();
      expect(pkg.devDependencies['typescript']).toBeDefined();
    });
  });

  describe('functional style', () => {
    it('generates entry point and health route', () => {
      const files = generateProject(createOptions({ style: 'functional' }));
      expect(files.has('src/index.ts')).toBe(true);
      expect(files.has('src/routes/health.ts')).toBe(true);
    });

    it('generates a todos CRUD feature with a pure data store', () => {
      const files = generateProject(createOptions({ style: 'functional' }));
      expect(files.has('src/routes/todos.ts')).toBe(true);
      expect(files.has('src/routes/todos-data.ts')).toBe(true);
      expect(files.has('src/routes/__tests__/todos-data.test.ts')).toBe(true);
    });

    it('mounts the todos router in the entrypoint', () => {
      const files = generateProject(createOptions({ style: 'functional' }));
      const entry = files.get('src/index.ts')!;
      expect(entry).toContain("import { todosRouter } from './routes/todos.js';");
      expect(entry).toContain("app.route('/todos', todosRouter);");
    });

    it('uses route params, query, body, and response codes in the todos feature', () => {
      const files = generateProject(createOptions({ style: 'functional' }));
      const todos = files.get('src/routes/todos.ts')!;
      expect(todos).toContain("todosRouter.get('/',");
      expect(todos).toContain("todosRouter.get('/:id',");
      expect(todos).toContain("todosRouter.post('/',");
      expect(todos).toContain("todosRouter.delete('/:id',");
      expect(todos).toContain('ctx.params.id');
      expect(todos).toContain('ctx.query.status');
      expect(todos).toContain('ctx.body');
      expect(todos).toContain('ctx.status = 201');
      expect(todos).toContain('ctx.status = 204');
      expect(todos).toContain('ctx.throw(404');
      expect(todos).toContain('ctx.throw(400');
    });

    it('keeps todos state behind a pure store factory (no global mutable state)', () => {
      const files = generateProject(createOptions({ style: 'functional' }));
      const data = files.get('src/routes/todos-data.ts')!;
      expect(data).toContain('export function createTodoStore()');
      expect(data).not.toContain('export const todos');
      expect(data).not.toContain('class TodoStore');
    });

    it('uses createApp, createRouter, listen imports', () => {
      const files = generateProject(createOptions({ style: 'functional' }));
      const entry = files.get('src/index.ts')!;
      expect(entry).toContain('createApp');
      expect(entry).toContain('createRouter');
      expect(entry).toContain('listen');
      expect(entry).toContain("from 'nextrush'");
    });

    it('does not import reflect-metadata', () => {
      const files = generateProject(createOptions({ style: 'functional' }));
      const entry = files.get('src/index.ts')!;
      expect(entry).not.toContain('reflect-metadata');
    });

    it('does not include reflect-metadata in dependencies', () => {
      const files = generateProject(createOptions({ style: 'functional' }));
      const pkg = JSON.parse(files.get('package.json')!);
      expect(pkg.dependencies['reflect-metadata']).toBeUndefined();
    });

    it('does not include @nextrush/class in dependencies (optional peer, functional-only)', () => {
      // nextrush declares @nextrush/class as an OPTIONAL peer dependency (framework-composition
      // integrity, task 5.6/5.1) — a functional project must not scaffold it.
      const files = generateProject(createOptions({ style: 'functional' }));
      const pkg = JSON.parse(files.get('package.json')!);
      expect(pkg.dependencies['@nextrush/class']).toBeUndefined();
    });

    it('includes middleware imports for api preset', () => {
      const files = generateProject(createOptions({ style: 'functional', middleware: 'api' }));
      const entry = files.get('src/index.ts')!;
      expect(entry).toContain('@nextrush/cors');
      expect(entry).toContain('@nextrush/body-parser');
      expect(entry).toContain('@nextrush/helmet');
    });

    it('has no middleware imports for minimal preset', () => {
      const files = generateProject(createOptions({ style: 'functional', middleware: 'minimal' }));
      const entry = files.get('src/index.ts')!;
      expect(entry).not.toContain('@nextrush/cors');
    });

    it('generates a health route wired to a testable pure status function', () => {
      const files = generateProject(createOptions({ style: 'functional' }));
      const health = files.get('src/routes/health.ts')!;
      expect(health).toContain('healthRouter');
      expect(health).toContain('getHealthStatus');
    });

    it('uses adapter-bun listen import for bun runtime', () => {
      const files = generateProject(createOptions({ style: 'functional', runtime: 'bun' }));
      const entry = files.get('src/index.ts')!;
      expect(entry).toContain("import { listen } from '@nextrush/adapter-bun'");
    });

    it('uses simple PORT declaration in entrypoint', () => {
      const files = generateProject(createOptions({ style: 'functional' }));
      const entry = files.get('src/index.ts')!;
      expect(entry).toContain('const PORT = Number(process.env.PORT) || 8080;');
      expect(entry).toContain('await listen(app, PORT);');
    });

    it('uses process.uptime() in the health-status pure function', () => {
      const files = generateProject(createOptions({ style: 'functional' }));
      const status = files.get('src/routes/health-status.ts')!;
      expect(status).toContain('process.uptime()');
      expect(status).not.toContain('getUptimeSeconds');
    });
  });

  describe('class-based style', () => {
    it('generates feature-module, controller, and service files', () => {
      const files = generateProject(createOptions({ style: 'class-based' }));
      expect(files.has('src/index.ts')).toBe(true);
      expect(files.has('src/app.module.ts')).toBe(true);
      expect(files.has('src/modules/health/health.module.ts')).toBe(true);
      expect(files.has('src/modules/health/health.controller.ts')).toBe(true);
      expect(files.has('src/modules/health/health.service.ts')).toBe(true);
      expect(files.has('src/modules/todos/todos.module.ts')).toBe(true);
      expect(files.has('src/modules/todos/todos.controller.ts')).toBe(true);
      expect(files.has('src/modules/todos/todos.service.ts')).toBe(true);
      expect(files.has('src/modules/todos/todos.repository.ts')).toBe(true);
    });

    it('does not manually import reflect-metadata (auto-imported by nextrush)', () => {
      const files = generateProject(createOptions({ style: 'class-based' }));
      const entry = files.get('src/index.ts')!;
      expect(entry).not.toContain("import 'reflect-metadata'");
    });

    it('wires the root module with registerModule instead of filesystem discovery', () => {
      const files = generateProject(createOptions({ style: 'class-based' }));
      const entry = files.get('src/index.ts')!;
      expect(entry).toContain("import { registerModule } from 'nextrush/class';");
      expect(entry).toContain("import { AppModule } from './app.module.js';");
      expect(entry).toContain('await registerModule(app, AppModule');
      expect(entry).not.toContain('registerControllers');
      expect(entry).not.toContain('CONTROLLERS_ROOT');
      expect(entry).not.toContain('IS_DIST_RUNTIME');
    });

    it('declares feature modules in the root AppModule via imports', () => {
      const files = generateProject(createOptions({ style: 'class-based' }));
      const appModule = files.get('src/app.module.ts')!;
      expect(appModule).toContain("@Module({");
      expect(appModule).toContain('imports: [HealthModule, TodosModule]');
      expect(appModule).toContain("import { HealthModule } from './modules/health/health.module.js';");
      expect(appModule).toContain("import { TodosModule } from './modules/todos/todos.module.js';");
      expect(appModule).toContain('export class AppModule');
    });

    it('uses simple PORT declaration in class-based entrypoint', () => {
      const files = generateProject(createOptions({ style: 'class-based' }));
      const entry = files.get('src/index.ts')!;
      expect(entry).toContain('const PORT = Number(process.env.PORT) || 8080;');
      expect(entry).toContain('await listen(app, PORT);');
    });

    it('uses @Controller and @Get decorators', () => {
      const files = generateProject(createOptions({ style: 'class-based' }));
      const controller = files.get('src/modules/health/health.controller.ts')!;
      expect(controller).toContain('@Controller');
      expect(controller).toContain('@Get');
    });

    it('uses @Service decorator', () => {
      const files = generateProject(createOptions({ style: 'class-based' }));
      const service = files.get('src/modules/health/health.service.ts')!;
      expect(service).toContain('@Service');
    });

    it('uses process.uptime() in health service', () => {
      const files = generateProject(createOptions({ style: 'class-based' }));
      const service = files.get('src/modules/health/health.service.ts')!;
      expect(service).toContain('process.uptime()');
      expect(service).not.toContain('getUptimeSeconds');
    });

    it('uses full CRUD decorator surface in the todos feature', () => {
      const files = generateProject(createOptions({ style: 'class-based' }));
      const controller = files.get('src/modules/todos/todos.controller.ts')!;
      expect(controller).toContain('@Controller(\'/todos\')');
      expect(controller).toContain('@Get()');
      expect(controller).toContain('@Get(\':id\')');
      expect(controller).toContain('@Post()');
      expect(controller).toContain('@Delete(\':id\')');
      expect(controller).toContain('@Param(\'id\')');
      expect(controller).toContain('@Body()');
      expect(controller).toContain('@Query(\'status\')');
      expect(controller).toContain('@HttpCode(201)');
      expect(controller).toContain('@HttpCode(204)');
    });

    it('uses @Repository and HttpError in the todos feature', () => {
      const files = generateProject(createOptions({ style: 'class-based' }));
      const repository = files.get('src/modules/todos/todos.repository.ts')!;
      expect(repository).toContain('@Repository()');
      const service = files.get('src/modules/todos/todos.service.ts')!;
      expect(service).toContain("import { HttpError } from 'nextrush';");
      expect(service).toContain("import { Service } from 'nextrush/class';");
      expect(service).toContain('new HttpError(404');
    });

    it('includes reflect-metadata in dependencies', () => {
      const files = generateProject(createOptions({ style: 'class-based' }));
      const pkg = JSON.parse(files.get('package.json')!);
      expect(pkg.dependencies['reflect-metadata']).toBeDefined();
    });

    it('includes @nextrush/class in dependencies (required optional peer for the class subpath)', () => {
      // nextrush declares @nextrush/class as an OPTIONAL peer dependency (framework-composition
      // integrity, task 5.6) — class-based/full scaffolds must add it explicitly or
      // `nextrush/class` fails to resolve for a generated project.
      const files = generateProject(createOptions({ style: 'class-based' }));
      const pkg = JSON.parse(files.get('package.json')!);
      expect(pkg.dependencies['@nextrush/class']).toBeDefined();
    });

    it('does not generate functional route files', () => {
      const files = generateProject(createOptions({ style: 'class-based' }));
      expect(files.has('src/routes/health.ts')).toBe(false);
    });
  });

  describe('full style', () => {
    it('generates all expected files', () => {
      const files = generateProject(createOptions({ style: 'full' }));
      expect(files.has('src/index.ts')).toBe(true);
      expect(files.has('src/routes/health.ts')).toBe(true);
      expect(files.has('src/controllers/hello.controller.ts')).toBe(true);
      expect(files.has('src/services/hello.service.ts')).toBe(true);
      expect(files.has('src/middleware/error-handler.ts')).toBe(true);
    });

    it('uses serve instead of listen', () => {
      const files = generateProject(createOptions({ style: 'full' }));
      const entry = files.get('src/index.ts')!;
      expect(entry).toContain('serve');
      expect(entry).toContain('onListen');
    });

    it('imports the error handler', () => {
      const files = generateProject(createOptions({ style: 'full' }));
      const entry = files.get('src/index.ts')!;
      expect(entry).toContain('errorHandler');
    });

    it('uses @Post and @Body decorators', () => {
      const files = generateProject(createOptions({ style: 'full' }));
      const controller = files.get('src/controllers/hello.controller.ts')!;
      expect(controller).toContain('@Post');
      expect(controller).toContain('@Body');
    });

    it('includes reflect-metadata in dependencies', () => {
      const files = generateProject(createOptions({ style: 'full' }));
      const pkg = JSON.parse(files.get('package.json')!);
      expect(pkg.dependencies['reflect-metadata']).toBeDefined();
    });

    it('includes @nextrush/class in dependencies (required optional peer for the class subpath)', () => {
      const files = generateProject(createOptions({ style: 'full' }));
      const pkg = JSON.parse(files.get('package.json')!);
      expect(pkg.dependencies['@nextrush/class']).toBeDefined();
    });

    it('error handler catches and returns JSON', () => {
      const files = generateProject(createOptions({ style: 'full' }));
      const handler = files.get('src/middleware/error-handler.ts')!;
      expect(handler).toContain('ctx.json');
      expect(handler).toContain('await next()');
      expect(handler).toContain('catch');
    });

    it('error handler maps status from HttpError', () => {
      const files = generateProject(createOptions({ style: 'full' }));
      const handler = files.get('src/middleware/error-handler.ts')!;
      expect(handler).toContain('error instanceof HttpError ? error.status : 500');
    });

    it('entrypoint uses simple PORT declaration', () => {
      const files = generateProject(createOptions({ style: 'full' }));
      const entry = files.get('src/index.ts')!;
      expect(entry).toContain('const PORT = Number(process.env.PORT) || 8080;');
    });

    it('uses awaited registerControllers with runtime-safe discovery config in full template', () => {
      const files = generateProject(createOptions({ style: 'full' }));
      const entry = files.get('src/index.ts')!;
      expect(entry).toContain('await registerControllers(');
      expect(entry).toContain('root: CONTROLLERS_ROOT');
      expect(entry).toContain('include: CONTROLLERS_INCLUDE');
      expect(entry).toContain('strict: true');
    });
  });

  describe('middleware presets', () => {
    it('api preset adds cors, body-parser, helmet deps', () => {
      const files = generateProject(createOptions({ middleware: 'api' }));
      const pkg = JSON.parse(files.get('package.json')!);
      expect(pkg.dependencies['@nextrush/cors']).toBeDefined();
      expect(pkg.dependencies['@nextrush/body-parser']).toBeDefined();
      expect(pkg.dependencies['@nextrush/helmet']).toBeDefined();
    });

    it('full preset adds all middleware deps', () => {
      const files = generateProject(createOptions({ middleware: 'full' }));
      const pkg = JSON.parse(files.get('package.json')!);
      expect(pkg.dependencies['@nextrush/cors']).toBeDefined();
      expect(pkg.dependencies['@nextrush/body-parser']).toBeDefined();
      expect(pkg.dependencies['@nextrush/helmet']).toBeDefined();
      expect(pkg.dependencies['@nextrush/rate-limit']).toBeDefined();
      expect(pkg.dependencies['@nextrush/compression']).toBeDefined();
      expect(pkg.dependencies['@nextrush/request-id']).toBeDefined();
    });

    it('minimal preset adds no middleware deps', () => {
      const files = generateProject(createOptions({ middleware: 'minimal' }));
      const pkg = JSON.parse(files.get('package.json')!);
      expect(pkg.dependencies['@nextrush/cors']).toBeUndefined();
      expect(pkg.dependencies['@nextrush/body-parser']).toBeUndefined();
    });
  });

  describe('runtime adapters', () => {
    it('node runtime adds no adapter dep', () => {
      const files = generateProject(createOptions({ runtime: 'node' }));
      const pkg = JSON.parse(files.get('package.json')!);
      expect(pkg.dependencies['@nextrush/adapter-bun']).toBeUndefined();
      expect(pkg.dependencies['@nextrush/adapter-deno']).toBeUndefined();
    });

    it('bun runtime adds adapter-bun dep', () => {
      const files = generateProject(createOptions({ runtime: 'bun' }));
      const pkg = JSON.parse(files.get('package.json')!);
      expect(pkg.dependencies['@nextrush/adapter-bun']).toBeDefined();
    });

    it('bun runtime scripts use bun tooling', () => {
      const files = generateProject(createOptions({ runtime: 'bun' }));
      const pkg = JSON.parse(files.get('package.json')!);
      expect(pkg.scripts.dev).toBe('bun nextrush dev');
      expect(pkg.scripts.build).toBe('bun nextrush build');
      expect(pkg.scripts.start).toBe('bun dist/index.js');
    });

    it('deno runtime adds adapter-deno dep', () => {
      const files = generateProject(createOptions({ runtime: 'deno' }));
      const pkg = JSON.parse(files.get('package.json')!);
      expect(pkg.dependencies['@nextrush/adapter-deno']).toBeDefined();
    });

    it('deno runtime scripts route through the toolchain — no @latest, no blanket -A', () => {
      const files = generateProject(createOptions({ runtime: 'deno' }));
      const pkg = JSON.parse(files.get('package.json')!);

      expect(pkg.scripts.dev).toContain('npm:nextrush dev');
      expect(pkg.scripts.build).toContain('npm:nextrush build');
      expect(pkg.scripts.start).toBe('deno run --allow-net --allow-read --allow-env dist/index.js');

      for (const script of [pkg.scripts.dev, pkg.scripts.build, pkg.scripts.start]) {
        expect(script).not.toContain('@latest');
        expect(script).not.toMatch(/(^|\s)-A(\s|$)/);
      }
    });
  });

  describe('file counts', () => {
    it('functional minimal generates correct number of files', () => {
      const files = generateProject(createOptions({ style: 'functional', middleware: 'minimal' }));
      // tsconfig, package.json, README, .gitignore, env.d.ts, src/index.ts,
      // routes/health.ts, routes/health-status.ts, routes/todos.ts, routes/todos-data.ts,
      // routes/__tests__/health-status.test.ts, routes/__tests__/todos-data.test.ts
      expect(files.size).toBe(12);
    });

    it('class-based generates correct number of files', () => {
      const files = generateProject(createOptions({ style: 'class-based', middleware: 'minimal' }));
      // tsconfig, package.json, README, .gitignore, env.d.ts, src/index.ts, src/app.module.ts,
      // modules/health/{health.module,health.controller,health.service}.ts,
      // modules/todos/{todos.module,todos.controller,todos.service,todos.repository}.ts,
      // modules/todos/__tests__/{todos.service,todos.controller}.test.ts
      expect(files.size).toBe(16);
    });

    it('full generates correct number of files', () => {
      const files = generateProject(createOptions({ style: 'full', middleware: 'minimal' }));
      // tsconfig, package.json, README, .gitignore, env.d.ts, src/index.ts,
      // routes/health.ts, controllers/hello.controller.ts, services/hello.service.ts,
      // services/__tests__/hello.service.test.ts, middleware/error-handler.ts
      expect(files.size).toBe(11);
    });

    it('git flag does not affect file count', () => {
      const withGit = generateProject(
        createOptions({ style: 'functional', middleware: 'minimal', git: true })
      );
      const withoutGit = generateProject(
        createOptions({ style: 'functional', middleware: 'minimal', git: false })
      );
      expect(withGit.size).toBe(withoutGit.size);
    });
  });
});
