import { MIDDLEWARE_IMPORTS, MIDDLEWARE_SETUP } from '../constants.js';
import type { FileMap, ProjectOptions } from '../types.js';
import {
  getPortDeclaration,
  getRuntimeEntrypointImports,
} from './shared.js';

/** Generates a functional-style NextRush project. */
export function generateFunctional(options: ProjectOptions): FileMap {
  const files: FileMap = new Map();

  files.set('src/index.ts', generateEntrypoint(options));
  files.set('src/routes/health.ts', generateHealthRoute());
  files.set('src/routes/health-status.ts', generateHealthStatus());
  files.set('src/routes/__tests__/health-status.test.ts', generateHealthStatusTest());

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
