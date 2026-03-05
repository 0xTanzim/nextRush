import { MIDDLEWARE_IMPORTS, MIDDLEWARE_SETUP } from '../constants.js';
import type { FileMap, ProjectOptions } from '../types.js';

/** Generates a functional-style NextRush project. */
export function generateFunctional(options: ProjectOptions): FileMap {
  const files: FileMap = new Map();

  files.set('src/index.ts', generateEntrypoint(options));
  files.set('src/routes/health.ts', generateHealthRoute());

  return files;
}

function generateEntrypoint(options: ProjectOptions): string {
  const middlewareImports = MIDDLEWARE_IMPORTS[options.middleware];
  const middlewareSetup = MIDDLEWARE_SETUP[options.middleware];

  const lines: string[] = [];

  lines.push("import { createApp, createRouter, listen } from 'nextrush';");

  if (middlewareImports) {
    lines.push(middlewareImports);
  }

  lines.push("import { healthRouter } from './routes/health.js';");
  lines.push('');
  lines.push('const app = createApp();');
  lines.push('const router = createRouter();');
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
  lines.push("app.route('/', router);");
  lines.push("app.route('/health', healthRouter);");
  lines.push('');
  lines.push('await listen(app, 3000);');
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
