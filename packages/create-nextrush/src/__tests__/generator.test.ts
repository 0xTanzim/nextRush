import { describe, expect, it } from 'vitest';

import { generateProject } from '../generator.js';
import type { ProjectOptions } from '../types.js';

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
      expect(pkg.devDependencies['typescript']).toBeDefined();
    });
  });

  describe('functional style', () => {
    it('generates entry point and health route', () => {
      const files = generateProject(createOptions({ style: 'functional' }));
      expect(files.has('src/index.ts')).toBe(true);
      expect(files.has('src/routes/health.ts')).toBe(true);
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

    it('generates a health route with JSON response', () => {
      const files = generateProject(createOptions({ style: 'functional' }));
      const health = files.get('src/routes/health.ts')!;
      expect(health).toContain('healthRouter');
      expect(health).toContain("status: 'ok'");
    });
  });

  describe('class-based style', () => {
    it('generates controller and service files', () => {
      const files = generateProject(createOptions({ style: 'class-based' }));
      expect(files.has('src/index.ts')).toBe(true);
      expect(files.has('src/controllers/health.controller.ts')).toBe(true);
      expect(files.has('src/services/app.service.ts')).toBe(true);
    });

    it('does not manually import reflect-metadata (auto-imported by nextrush)', () => {
      const files = generateProject(createOptions({ style: 'class-based' }));
      const entry = files.get('src/index.ts')!;
      expect(entry).not.toContain("import 'reflect-metadata'");
    });

    it('uses controllersPlugin with root ./src', () => {
      const files = generateProject(createOptions({ style: 'class-based' }));
      const entry = files.get('src/index.ts')!;
      expect(entry).toContain('controllersPlugin');
      expect(entry).toContain("root: './src'");
    });

    it('uses @Controller and @Get decorators', () => {
      const files = generateProject(createOptions({ style: 'class-based' }));
      const controller = files.get('src/controllers/health.controller.ts')!;
      expect(controller).toContain('@Controller');
      expect(controller).toContain('@Get');
    });

    it('uses @Service decorator', () => {
      const files = generateProject(createOptions({ style: 'class-based' }));
      const service = files.get('src/services/app.service.ts')!;
      expect(service).toContain('@Service');
    });

    it('includes reflect-metadata in dependencies', () => {
      const files = generateProject(createOptions({ style: 'class-based' }));
      const pkg = JSON.parse(files.get('package.json')!);
      expect(pkg.dependencies['reflect-metadata']).toBeDefined();
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
      expect(files.has('src/middleware/not-found.ts')).toBe(true);
    });

    it('uses serve instead of listen', () => {
      const files = generateProject(createOptions({ style: 'full' }));
      const entry = files.get('src/index.ts')!;
      expect(entry).toContain('serve');
      expect(entry).toContain('onListen');
    });

    it('imports error and not-found handlers', () => {
      const files = generateProject(createOptions({ style: 'full' }));
      const entry = files.get('src/index.ts')!;
      expect(entry).toContain('errorHandler');
      expect(entry).toContain('notFoundHandler');
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

    it('error handler catches and returns JSON', () => {
      const files = generateProject(createOptions({ style: 'full' }));
      const handler = files.get('src/middleware/error-handler.ts')!;
      expect(handler).toContain('ctx.json');
      expect(handler).toContain('await next()');
      expect(handler).toContain('catch');
    });

    it('not-found handler returns 404', () => {
      const files = generateProject(createOptions({ style: 'full' }));
      const handler = files.get('src/middleware/not-found.ts')!;
      expect(handler).toContain('ctx.status = 404');
      expect(handler).toContain("'Not Found'");
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

    it('deno runtime adds adapter-deno dep', () => {
      const files = generateProject(createOptions({ runtime: 'deno' }));
      const pkg = JSON.parse(files.get('package.json')!);
      expect(pkg.dependencies['@nextrush/adapter-deno']).toBeDefined();
    });
  });

  describe('file counts', () => {
    it('functional minimal generates correct number of files', () => {
      const files = generateProject(createOptions({ style: 'functional', middleware: 'minimal' }));
      // tsconfig, package.json, README, .gitignore, env.d.ts, src/index.ts, routes/health.ts
      expect(files.size).toBe(7);
    });

    it('class-based generates correct number of files', () => {
      const files = generateProject(createOptions({ style: 'class-based', middleware: 'minimal' }));
      // tsconfig, package.json, README, .gitignore, env.d.ts, src/index.ts, health.controller.ts, app.service.ts
      expect(files.size).toBe(8);
    });

    it('full generates correct number of files', () => {
      const files = generateProject(createOptions({ style: 'full', middleware: 'minimal' }));
      // tsconfig, package.json, README, .gitignore, env.d.ts, src/index.ts,
      // routes/health.ts, controllers/hello.controller.ts, services/hello.service.ts,
      // middleware/error-handler.ts, middleware/not-found.ts
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
