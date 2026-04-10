import { MIDDLEWARE_IMPORTS, MIDDLEWARE_SETUP } from '../constants.js';
import type { FileMap, ProjectOptions } from '../types.js';
import {
  getPortResolverFunction,
  getRuntimeEntrypointImports,
  getUptimeHelperFunction,
} from './shared.js';

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
  const portResolver = getPortResolverFunction();

  const lines: string[] = [];

  lines.push(...getRuntimeEntrypointImports(options.runtime, 'listen'));

  if (middlewareImports) {
    lines.push(middlewareImports);
  }

  lines.push("import { healthRouter } from './routes/health.js';");
  lines.push('');
  lines.push('const app = createApp();');
  lines.push('const router = createRouter();');
  lines.push(portResolver.trimEnd());
  lines.push('const PORT = resolvePort();');
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
  lines.push('await listen(app, PORT);');
  lines.push('');

  return lines.join('\n');
}

function generateHealthRoute(): string {
  const uptimeHelper = getUptimeHelperFunction();

  return `import { createRouter } from 'nextrush';

export const healthRouter = createRouter();

${uptimeHelper}

healthRouter.get('/', (ctx) => {
  ctx.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: getUptimeSeconds(),
  });
});
`;
}
