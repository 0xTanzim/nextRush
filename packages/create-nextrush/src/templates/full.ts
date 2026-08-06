import { MIDDLEWARE_IMPORTS, MIDDLEWARE_SETUP } from '../constants.js';
import type { FileMap, ProjectOptions } from '../types.js';
import {
    generateConfig,
    getRuntimeEntrypointImports,
    getServerStartLine,
} from './shared.js';

/**
 * Generates a full-featured NextRush project.
 *
 * Combines a functional `/health` route with a class-based module graph
 * (`@Module`/`AppModule` via `registerModule` — the same standard as the
 * class-based style) and a shared error-handling middleware. Both routing
 * styles in one service.
 */
export function generateFull(options: ProjectOptions): FileMap {
  const files: FileMap = new Map();

  files.set('src/index.ts', generateEntrypoint(options));
  files.set('src/config/index.ts', generateConfig(options));
  files.set('src/app.module.ts', generateAppModule());
  files.set('src/modules/hello/hello.module.ts', generateHelloModule());
  files.set('src/modules/hello/hello.controller.ts', generateHelloController());
  files.set('src/modules/hello/hello.service.ts', generateHelloService());
  files.set('src/modules/hello/__tests__/hello.service.test.ts', generateHelloServiceTest());
  files.set('src/routes/health.ts', generateHealthRoute());
  files.set('src/middleware/error-handler.ts', generateErrorHandler());

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

  lines.push("import { errorHandler } from './middleware/error-handler.js';");
  lines.push("import { healthRouter } from './routes/health.js';");
  lines.push('');
  lines.push('const router = createRouter();');
  lines.push('const app = createApp({ router });');
  lines.push('');
  lines.push('// Error handling (first middleware — catches all downstream errors)');
  lines.push('app.use(errorHandler());');
  lines.push('');

  if (middlewareSetup) {
    lines.push('// Security & parsing middleware');
    lines.push(middlewareSetup);
    lines.push('');
  }

  lines.push('// Functional routes');
  lines.push("app.route('/health', healthRouter);");
  lines.push('');
  lines.push('// Wire the root module — registers the whole module graph in one call');
  lines.push("await registerModule(app, AppModule, { prefix: '/api' });");
  lines.push('');
  lines.push(serverStartLine);
  lines.push('');

  return lines.join('\n');
}

function generateAppModule(): string {
  return `import { Module } from 'nextrush/class';

import { HelloModule } from './modules/hello/hello.module.js';

@Module({
  imports: [HelloModule],
})
export class AppModule {}
`;
}

function generateHelloModule(): string {
  return `import { Module } from 'nextrush/class';

import { HelloController } from './hello.controller.js';
import { HelloService } from './hello.service.js';

@Module({
  controllers: [HelloController],
  providers: [HelloService],
})
export class HelloModule {}
`;
}

function generateHealthRoute(): string {
  return `import { createRouter } from 'nextrush';

export const healthRouter = createRouter();

healthRouter.get('/', (ctx) => {
  ctx.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.round(performance.now() / 1000),
  });
});
`;
}

function generateHelloController(): string {
  return `import { Controller, Get, Post, Body } from 'nextrush/class';
import { HelloService } from './hello.service.js';

@Controller('/hello')
export class HelloController {
  constructor(private readonly helloService: HelloService) {}

  @Get()
  greet() {
    return this.helloService.greet();
  }

  @Post()
  greetByName(@Body() body: { name: string }) {
    return this.helloService.greetByName(body.name);
  }
}
`;
}

function generateHelloService(): string {
  return `import { Service } from 'nextrush/class';

@Service()
export class HelloService {
  greet() {
    return { message: 'Hello from NextRush!' };
  }

  greetByName(name: string) {
    return { message: \`Hello, \${name}!\` };
  }
}
`;
}

function generateHelloServiceTest(): string {
  return `import { describe, expect, it } from 'vitest';

import { HelloService } from '../hello.service.js';

describe('HelloService', () => {
  it('greets with a default message', () => {
    const service = new HelloService();
    expect(service.greet()).toEqual({ message: 'Hello from NextRush!' });
  });

  it('greets by name', () => {
    const service = new HelloService();
    expect(service.greetByName('Ada')).toEqual({ message: 'Hello, Ada!' });
  });
});
`;
}

function generateErrorHandler(): string {
  return `import { HttpError, type Middleware } from 'nextrush';

export function errorHandler(): Middleware {
  return async (ctx, next) => {
    try {
      await next();
    } catch (error: unknown) {
      const statusCode = error instanceof HttpError ? error.status : 500;
      const message =
        error instanceof Error ? error.message : 'Internal Server Error';

      ctx.status = statusCode;
      ctx.json({
        error: statusCode >= 500 ? 'Internal Server Error' : message,
        statusCode,
      });
    }
  };
}
`;
}
