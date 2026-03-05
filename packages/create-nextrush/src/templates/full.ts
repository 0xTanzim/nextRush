import { MIDDLEWARE_IMPORTS, MIDDLEWARE_SETUP } from '../constants.js';
import type { FileMap, ProjectOptions } from '../types.js';

/**
 * Generates a full-featured NextRush project.
 * Combines functional routes + class-based controllers + middleware + error handling.
 */
export function generateFull(options: ProjectOptions): FileMap {
  const files: FileMap = new Map();

  files.set('src/index.ts', generateEntrypoint(options));
  files.set('src/routes/health.ts', generateHealthRoute());
  files.set('src/controllers/hello.controller.ts', generateHelloController());
  files.set('src/services/hello.service.ts', generateHelloService());
  files.set('src/middleware/error-handler.ts', generateErrorHandler());
  files.set('src/middleware/not-found.ts', generateNotFound());

  return files;
}

function generateEntrypoint(options: ProjectOptions): string {
  const middlewareImports = MIDDLEWARE_IMPORTS[options.middleware];
  const middlewareSetup = MIDDLEWARE_SETUP[options.middleware];

  const lines: string[] = [];

  lines.push("import 'reflect-metadata';");
  lines.push("import { createApp, createRouter, serve, controllersPlugin } from 'nextrush';");

  if (middlewareImports) {
    lines.push(middlewareImports);
  }

  lines.push("import { errorHandler } from './middleware/error-handler.js';");
  lines.push("import { notFoundHandler } from './middleware/not-found.js';");
  lines.push("import { healthRouter } from './routes/health.js';");
  lines.push('');
  lines.push('const app = createApp();');
  lines.push('const router = createRouter();');
  lines.push("const PORT = Number(process.env['PORT']) || 3000;");
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
  lines.push('// Auto-discover controllers');
  lines.push('app.plugin(');
  lines.push('  controllersPlugin({');
  lines.push('    router,');
  lines.push("    root: './src',");
  lines.push("    prefix: '/api',");
  lines.push('  })');
  lines.push(');');
  lines.push('');
  lines.push("app.route('/', router);");
  lines.push('');
  lines.push('// 404 handler (after all routes)');
  lines.push('app.use(notFoundHandler());');
  lines.push('');
  lines.push('await serve(app, {');
  lines.push('  port: PORT,');
  lines.push('  onListen: ({ port: p }) => {');
  lines.push('    console.log(`🚀 Server running on http://localhost:${p}`);');
  lines.push('  },');
  lines.push('});');
  lines.push('');

  return lines.join('\n');
}

function generateHealthRoute(): string {
  return `import { createRouter } from 'nextrush';

export const healthRouter = createRouter();

healthRouter.get('/', (ctx) => {
  ctx.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});
`;
}

function generateHelloController(): string {
  return `import { Controller, Get, Post, Body } from 'nextrush';
import { HelloService } from '../services/hello.service.js';

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
  return `import { Service } from 'nextrush';

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

function generateErrorHandler(): string {
  return `import type { Middleware } from 'nextrush';

export function errorHandler(): Middleware {
  return async (ctx, next) => {
    try {
      await next();
    } catch (error: unknown) {
      const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
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

function generateNotFound(): string {
  return `import type { Middleware } from 'nextrush';

export function notFoundHandler(): Middleware {
  return async (ctx) => {
    ctx.status = 404;
    ctx.json({
      error: 'Not Found',
      statusCode: 404,
      path: ctx.path,
    });
  };
}
`;
}
