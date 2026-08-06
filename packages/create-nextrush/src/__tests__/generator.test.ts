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
      expect(files.has('src/routes/health.routes.ts')).toBe(true);
    });

    it('generates config, lib, and middleware folders', () => {
      const files = generateProject(createOptions({ style: 'functional' }));
      expect(files.has('src/config/index.ts')).toBe(true);
      expect(files.has('src/lib/types.ts')).toBe(true);
      expect(files.has('src/middleware/logger.ts')).toBe(true);
    });

    it('generates a layered todos feature (routes, services, repositories)', () => {
      const files = generateProject(createOptions({ style: 'functional' }));
      expect(files.has('src/routes/todos.routes.ts')).toBe(true);
      expect(files.has('src/services/todos.service.ts')).toBe(true);
      expect(files.has('src/repositories/todos.repository.ts')).toBe(true);
      expect(files.has('src/services/__tests__/todos.service.test.ts')).toBe(true);
      expect(files.has('src/repositories/__tests__/todos.repository.test.ts')).toBe(true);
    });

    it('mounts the todos router in the entrypoint', () => {
      const files = generateProject(createOptions({ style: 'functional' }));
      const entry = files.get('src/index.ts')!;
      expect(entry).toContain("import { todosRouter } from './routes/todos.routes.js';");
      expect(entry).toContain("app.route('/todos', todosRouter);");
    });

    it('uses route params, query, body, and response codes in the todos route', () => {
      const files = generateProject(createOptions({ style: 'functional' }));
      const todos = files.get('src/routes/todos.routes.ts')!;
      expect(todos).toContain("todosRouter.get('/',");
      expect(todos).toContain("todosRouter.get('/:id',");
      expect(todos).toContain("todosRouter.post('/',");
      expect(todos).toContain("todosRouter.delete('/:id',");
      expect(todos).toContain('ctx.params.id');
      expect(todos).toContain('ctx.query.status');
      expect(todos).toContain('ctx.body');
      expect(todos).toContain('ctx.status = 201');
      expect(todos).toContain('ctx.status = 204');
    });

    it('uses framework HTTP errors (NotFoundError, BadRequestError) in the service', () => {
      const files = generateProject(createOptions({ style: 'functional' }));
      const service = files.get('src/services/todos.service.ts')!;
      expect(service).toContain("import { BadRequestError, NotFoundError } from 'nextrush';");
      expect(service).toContain('throw new NotFoundError(');
      expect(service).toContain('throw new BadRequestError(');
    });

    it('uses the built-in errorHandler middleware from nextrush', () => {
      const files = generateProject(createOptions({ style: 'functional' }));
      const entry = files.get('src/index.ts')!;
      expect(entry).toContain('errorHandler');
      expect(entry).toContain('app.use(errorHandler');
    });

    it('keeps todos state behind a pure repository factory (no global mutable state)', () => {
      const files = generateProject(createOptions({ style: 'functional' }));
      const repo = files.get('src/repositories/todos.repository.ts')!;
      expect(repo).toContain('export function createTodoRepository()');
      expect(repo).not.toContain('export const todos');
      expect(repo).not.toContain('class TodoStore');
    });

    it('uses createApp, createRouter, serve imports', () => {
      const files = generateProject(createOptions({ style: 'functional' }));
      const entry = files.get('src/index.ts')!;
      expect(entry).toContain('createApp');
      expect(entry).toContain('createRouter');
      expect(entry).toContain('serve');
      expect(entry).toContain("from 'nextrush'");
    });

    it('uses config for the port (no inline process.env in the entrypoint)', () => {
      const files = generateProject(createOptions({ style: 'functional' }));
      const entry = files.get('src/index.ts')!;
      expect(entry).toContain("import { config } from './config/index.js';");
      expect(entry).toContain('await serve(app, { port: config.port, host: config.host });');
      expect(entry).not.toContain('const PORT =');
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
      const health = files.get('src/routes/health.routes.ts')!;
      expect(health).toContain('healthRouter');
      expect(health).toContain('getHealthStatus');
    });

    it('uses adapter-bun serve import for bun runtime', () => {
      const files = generateProject(createOptions({ style: 'functional', runtime: 'bun' }));
      const entry = files.get('src/index.ts')!;
      expect(entry).toContain("import { serve } from '@nextrush/adapter-bun'");
    });

    it('reads the port from config, not an inline constant, and forwards host', () => {
      const files = generateProject(createOptions({ style: 'functional' }));
      const entry = files.get('src/index.ts')!;
      expect(entry).toContain('await serve(app, { port: config.port, host: config.host });');
      const configFile = files.get('src/config/index.ts')!;
      expect(configFile).toContain('process.env.PORT');
    });

    it('uses a cross-runtime uptime in the health service pure function', () => {
      const files = generateProject(createOptions({ style: 'functional' }));
      const status = files.get('src/services/health.service.ts')!;
      expect(status).toContain('performance.now()');
      expect(status).not.toContain('getUptimeSeconds');
      expect(status).not.toContain('process.uptime');
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
      expect(entry).toContain("import { config } from './config/index.js';");
      expect(entry).toContain('await serve(app, { port: config.port, host: config.host });');
      expect(entry).not.toContain('const PORT = Number(process.env.PORT) || 8080;');
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

    it('uses a cross-runtime uptime in health service', () => {
      const files = generateProject(createOptions({ style: 'class-based' }));
      const service = files.get('src/modules/health/health.service.ts')!;
      expect(service).toContain('performance.now()');
      expect(service).not.toContain('getUptimeSeconds');
      expect(service).not.toContain('process.uptime');
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
      expect(files.has('src/app.module.ts')).toBe(true);
      expect(files.has('src/modules/hello/hello.module.ts')).toBe(true);
      expect(files.has('src/modules/hello/hello.controller.ts')).toBe(true);
      expect(files.has('src/modules/hello/hello.service.ts')).toBe(true);
      expect(files.has('src/routes/health.ts')).toBe(true);
      expect(files.has('src/middleware/error-handler.ts')).toBe(true);
    });

    it('uses serve with host instead of a bare listen', () => {
      const files = generateProject(createOptions({ style: 'full' }));
      const entry = files.get('src/index.ts')!;
      expect(entry).toContain('await serve(app, { port: config.port, host: config.host });');
      expect(entry).not.toContain('await listen(app, PORT)');
      expect(entry).not.toContain('const PORT =');
    });

    it('imports the error handler', () => {
      const files = generateProject(createOptions({ style: 'full' }));
      const entry = files.get('src/index.ts')!;
      expect(entry).toContain('errorHandler');
    });

    it('uses @Post and @Body decorators', () => {
      const files = generateProject(createOptions({ style: 'full' }));
      const controller = files.get('src/modules/hello/hello.controller.ts')!;
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

    it('entrypoint uses config-based serve with host', () => {
      const files = generateProject(createOptions({ style: 'full' }));
      const entry = files.get('src/index.ts')!;
      expect(entry).toContain("import { config } from './config/index.js';");
      expect(entry).toContain('await serve(app, { port: config.port, host: config.host });');
      expect(entry).not.toContain('const PORT = Number(process.env.PORT) || 8080;');
    });

    it('wires the root module with registerModule instead of filesystem discovery', () => {
      const files = generateProject(createOptions({ style: 'full' }));
      const entry = files.get('src/index.ts')!;
      expect(entry).toContain("import { registerModule } from 'nextrush/class';");
      expect(entry).toContain("import { AppModule } from './app.module.js';");
      expect(entry).toContain('await registerModule(app, AppModule');
      expect(entry).not.toContain('registerControllers');
      expect(entry).not.toContain('CONTROLLERS_ROOT');
      expect(entry).not.toContain('IS_DIST_RUNTIME');
    });

    it('declares the feature module in the root AppModule via imports', () => {
      const files = generateProject(createOptions({ style: 'full' }));
      const appModule = files.get('src/app.module.ts')!;
      expect(appModule).toContain('@Module({');
      expect(appModule).toContain('imports: [HelloModule]');
      expect(appModule).toContain("import { HelloModule } from './modules/hello/hello.module.js';");
      expect(appModule).toContain('export class AppModule');
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
      // start loads .env via --env-file, scoped permissions, no -A
      expect(pkg.scripts.start).toBe(
        'deno run --allow-net --allow-read --allow-env --env-file=.env dist/index.js'
      );

      for (const script of [pkg.scripts.dev, pkg.scripts.build, pkg.scripts.start]) {
        expect(script).not.toContain('@latest');
        expect(script).not.toMatch(/(^|\s)-A(\s|$)/);
      }
    });
  });

  describe('deno runtime is Deno-first (not a Node clone)', () => {
    it('generates a deno.json with Deno types and no Node typings', () => {
      const files = generateProject(createOptions({ style: 'functional', runtime: 'deno' }));
      const denoJson = JSON.parse(files.get('deno.json')!) as {
        compilerOptions: { lib?: unknown; experimentalDecorators?: unknown };
        unstable?: unknown;
        nodeModulesDir?: unknown;
      };
      expect(files.has('deno.json')).toBe(true);
      expect(denoJson.compilerOptions.lib).toContain('deno.window');
      expect(denoJson.compilerOptions.experimentalDecorators).toBeUndefined();
      // Native Deno tooling (deno check/test/LSP) must resolve the `.js`-specifier
      // relative imports and bare `@nextrush/*` specifiers — config, not just the
      // hand-written npm scripts (Deno-first fix).
      expect(denoJson.unstable).toEqual(['sloppy-imports']);
      expect(denoJson.nodeModulesDir).toBe('auto');
    });

    it('does not install @types/node for a deno project', () => {
      const files = generateProject(createOptions({ style: 'functional', runtime: 'deno' }));
      const pkg = JSON.parse(files.get('package.json')!) as {
        devDependencies: Record<string, unknown>;
      };
      expect(pkg.devDependencies['@types/node']).toBeUndefined();
    });

    it('does not force types node in the deno tsconfig', () => {
      const files = generateProject(createOptions({ style: 'functional', runtime: 'deno' }));
      const tsconfig = JSON.parse(files.get('tsconfig.json')!) as {
        compilerOptions: { types?: unknown };
      };
      expect(tsconfig.compilerOptions.types).toBeUndefined();
    });

    it('adds decorator flags to deno.json for class-based/full projects', () => {
      const files = generateProject(createOptions({ style: 'class-based', runtime: 'deno' }));
      const denoJson = JSON.parse(files.get('deno.json')!) as {
        compilerOptions: { experimentalDecorators?: unknown; emitDecoratorMetadata?: unknown };
      };
      expect(denoJson.compilerOptions.experimentalDecorators).toBe(true);
      expect(denoJson.compilerOptions.emitDecoratorMetadata).toBe(true);
    });

    it('does not emit a deno.json for node/bun projects', () => {
      const nodeFiles = generateProject(createOptions({ runtime: 'node' }));
      expect(nodeFiles.has('deno.json')).toBe(false);
      const bunFiles = generateProject(createOptions({ runtime: 'bun' }));
      expect(bunFiles.has('deno.json')).toBe(false);
    });

    it('reads the port from Deno.env in a deno project config', () => {
      const files = generateProject(createOptions({ style: 'functional', runtime: 'deno' }));
      const config = files.get('src/config/index.ts')!;
      expect(config).toContain("Deno.env.get('PORT')");
      expect(config).not.toContain('process.env');
    });

    it('omits engines.node from a deno project package.json (the app is not Node-dependent)', () => {
      const files = generateProject(createOptions({ style: 'functional', runtime: 'deno' }));
      const pkg = JSON.parse(files.get('package.json')!) as { engines?: unknown };
      expect(pkg.engines).toBeUndefined();
    });
  });

  describe('file counts', () => {
    it('functional minimal generates correct number of files', () => {
      const files = generateProject(createOptions({ style: 'functional', middleware: 'minimal' }));
      // tsconfig, package.json, README, .gitignore, .env, .env.example, env.d.ts,
      // src/index.ts, config/index.ts, lib/types.ts, middleware/logger.ts,
      // routes/health.routes.ts, routes/todos.routes.ts,
      // services/health.service.ts, services/todos.service.ts,
      // services/__tests__/health.service.test.ts, services/__tests__/todos.service.test.ts,
      // repositories/todos.repository.ts, repositories/__tests__/todos.repository.test.ts
      expect(files.size).toBe(19);
    });

    it('class-based generates correct number of files', () => {
      const files = generateProject(createOptions({ style: 'class-based', middleware: 'minimal' }));
      // tsconfig, package.json, README, .gitignore, .env, .env.example, env.d.ts,
      // src/index.ts, src/config/index.ts, src/app.module.ts,
      // modules/health/{health.module,health.controller,health.service}.ts,
      // modules/todos/{todos.module,todos.controller,todos.service,todos.repository}.ts,
      // modules/todos/__tests__/{todos.service,todos.controller}.test.ts
      expect(files.size).toBe(19);
    });

    it('full generates correct number of files', () => {
      const files = generateProject(createOptions({ style: 'full', middleware: 'minimal' }));
      // tsconfig, package.json, README, .gitignore, .env, .env.example, env.d.ts,
      // src/index.ts, src/config/index.ts, src/app.module.ts,
      // modules/hello/hello.module.ts, modules/hello/hello.controller.ts,
      // modules/hello/hello.service.ts, modules/hello/__tests__/hello.service.test.ts,
      // routes/health.ts, middleware/error-handler.ts
      expect(files.size).toBe(16);
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
