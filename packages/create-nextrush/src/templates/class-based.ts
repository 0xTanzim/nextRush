import { MIDDLEWARE_IMPORTS, MIDDLEWARE_SETUP } from '../constants.js';
import type { FileMap, ProjectOptions } from '../types.js';

/** Generates a class-based (decorators + DI) NextRush project. */
export function generateClassBased(options: ProjectOptions): FileMap {
  const files: FileMap = new Map();

  files.set('src/index.ts', generateEntrypoint(options));
  files.set('src/controllers/health.controller.ts', generateHealthController());
  files.set('src/services/app.service.ts', generateAppService());

  return files;
}

function generateEntrypoint(options: ProjectOptions): string {
  const middlewareImports = MIDDLEWARE_IMPORTS[options.middleware];
  const middlewareSetup = MIDDLEWARE_SETUP[options.middleware];

  const lines: string[] = [];

  lines.push("import { createApp, createRouter, listen } from 'nextrush';");
  lines.push("import { controllersPlugin } from 'nextrush/class';");

  if (middlewareImports) {
    lines.push(middlewareImports);
  }

  lines.push('');
  lines.push('const app = createApp();');
  lines.push('const router = createRouter();');
  lines.push('');

  if (middlewareSetup) {
    lines.push('// Middleware');
    lines.push(middlewareSetup);
    lines.push('');
  }

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
  lines.push('await listen(app, 3000);');
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
