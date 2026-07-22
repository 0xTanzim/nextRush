import { MIDDLEWARE_IMPORTS, MIDDLEWARE_SETUP } from '../constants.js';
import type { FileMap, ProjectOptions } from '../types.js';
import {
  getControllerDiscoveryHelpers,
  getPortDeclaration,
  getRuntimeEntrypointImports,
} from './shared.js';

/** Generates a class-based (decorators + DI) NextRush project. */
export function generateClassBased(options: ProjectOptions): FileMap {
  const files: FileMap = new Map();

  files.set('src/index.ts', generateEntrypoint(options));
  files.set('src/controllers/health.controller.ts', generateHealthController());
  files.set('src/services/app.service.ts', generateAppService());
  files.set('src/services/__tests__/app.service.test.ts', generateAppServiceTest());

  return files;
}

function generateEntrypoint(options: ProjectOptions): string {
  const middlewareImports = MIDDLEWARE_IMPORTS[options.middleware];
  const middlewareSetup = MIDDLEWARE_SETUP[options.middleware];
  const portDecl = getPortDeclaration(options.runtime);
  const controllerDiscoveryHelpers = getControllerDiscoveryHelpers();

  const lines: string[] = [];

  lines.push(...getRuntimeEntrypointImports(options.runtime, 'listen'));
  lines.push("import { registerControllers } from 'nextrush/class';");

  if (middlewareImports) {
    lines.push(middlewareImports);
  }

  lines.push('');
  lines.push('const router = createRouter();');
  lines.push('const app = createApp({ router });');
  lines.push(portDecl);
  lines.push(controllerDiscoveryHelpers.trimEnd());
  lines.push('');

  if (middlewareSetup) {
    lines.push('// Middleware');
    lines.push(middlewareSetup);
    lines.push('');
  }

  lines.push('// Auto-discover controllers');
  lines.push('await registerControllers(app, {');
  lines.push('  root: CONTROLLERS_ROOT,');
  lines.push('  include: CONTROLLERS_INCLUDE,');
  lines.push("  prefix: '/api',");
  lines.push('  strict: true,');
  lines.push('});');
  lines.push('');
  lines.push('await listen(app, PORT);');
  lines.push('');

  return lines.join('\n');
}

function generateHealthController(): string {
  return `import { Controller, Get } from 'nextrush/class';
import { AppService } from '../services/app.service.js';

@Controller('/health')
export class HealthController {
  constructor(private readonly appService: AppService) {}

  @Get()
  check() {
    return this.appService.getHealth();
  }
}
`;
}

function generateAppService(): string {
  return `import { Service } from 'nextrush/class';

@Service()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
`;
}

function generateAppServiceTest(): string {
  return `import { describe, expect, it } from 'vitest';

import { AppService } from '../app.service.js';

describe('AppService', () => {
  it('reports status ok with a timestamp and uptime', () => {
    const service = new AppService();
    const result = service.getHealth();

    expect(result.status).toBe('ok');
    expect(new Date(result.timestamp).toString()).not.toBe('Invalid Date');
    expect(result.uptime).toBeGreaterThanOrEqual(0);
  });
});
`;
}
