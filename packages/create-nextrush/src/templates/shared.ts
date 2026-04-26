import { ADAPTER_PACKAGES, MIDDLEWARE_PACKAGES, NEXTRUSH_VERSION } from '../constants.js';
import type { DependencySet, ProjectOptions, Runtime } from '../types.js';

/** Generates tsconfig.json content for a new project. */
export function generateTsconfig(needsDecorators: boolean): string {
  const config: Record<string, unknown> = {
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      declaration: true,
      declarationMap: true,
      sourceMap: true,
      outDir: './dist',
      rootDir: './src',
      ...(needsDecorators
        ? {
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
          }
        : {}),
    },
    include: ['src'],
    exclude: ['dist', 'node_modules'],
  };

  return JSON.stringify(config, null, 2) + '\n';
}

/** Generates package.json content for a new project. */
export function generatePackageJson(options: ProjectOptions): string {
  const deps = getDependencies(options);
  const scripts = getRuntimeScripts(options.runtime);

  const pkg: Record<string, unknown> = {
    name: options.name,
    version: '0.1.0',
    private: true,
    type: 'module',
    scripts,
    dependencies: deps.dependencies,
    devDependencies: deps.devDependencies,
  };

  return JSON.stringify(pkg, null, 2) + '\n';
}

/** Resolves the dependency sets for a project configuration. */
export function getDependencies(options: ProjectOptions): DependencySet {
  const dependencies: Record<string, string> = {
    nextrush: `^${NEXTRUSH_VERSION}`,
  };

  const needsReflectMetadata = options.style === 'class-based' || options.style === 'full';

  // reflect-metadata is auto-imported by the nextrush meta-package,
  // but we keep it as an explicit dependency so it's resolvable.
  if (needsReflectMetadata) {
    dependencies['reflect-metadata'] = '>=0.2.0';
  }

  // Middleware packages
  const middlewareDeps = MIDDLEWARE_PACKAGES[options.middleware];
  Object.assign(dependencies, middlewareDeps);

  // Runtime adapter packages (node uses built-in, others need adapters)
  const adapterDeps = ADAPTER_PACKAGES[options.runtime];
  Object.assign(dependencies, adapterDeps);

  const devDependencies: Record<string, string> = {
    '@nextrush/dev': `^${NEXTRUSH_VERSION}`,
    '@nextrush/types': `^${NEXTRUSH_VERSION}`,
    typescript: '^6.0.2',
  };

  return { dependencies, devDependencies };
}

/** Generates .gitignore content. */
export function generateGitignore(): string {
  return `# Dependencies
node_modules/

# Build output
dist/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
pnpm-debug.log*
`;
}

/** Generates a README.md for the project. */
export function generateReadme(options: ProjectOptions): string {
  const pmRun = options.packageManager === 'npm' ? 'npm run' : options.packageManager;

  return `# ${options.name}

A [NextRush](https://nextrush.dev) project.

## Getting Started

\`\`\`bash
# Development
${pmRun} dev

# Build for production
${pmRun} build

# Start production server
${pmRun === 'npm run' ? 'npm start' : `${pmRun} start`}
\`\`\`

## Project Structure

\`\`\`
src/
├── index.ts          # Application entry point
${
  options.style === 'functional'
    ? `├── routes/           # Route handlers
│   └── health.ts     # Health check route`
    : `├── controllers/      # Controller classes
│   └── health.controller.ts`
}
\`\`\`

## Learn More

- [NextRush Documentation](https://nextrush.dev)
- [GitHub](https://github.com/0xTanzim/nextrush)
`;
}

/** Generates the src/env.d.ts file for better type hints. */
export function generateEnvDts(): string {
  return `/// <reference types="@nextrush/types" />
`;
}

/** Returns import lines for the selected runtime and server function. */
export function getRuntimeEntrypointImports(
  runtime: Runtime,
  serverFn: 'listen' | 'serve'
): string[] {
  if (runtime === 'node') {
    return [`import { createApp, createRouter, ${serverFn} } from 'nextrush';`];
  }

  const adapterPackage = runtime === 'bun' ? '@nextrush/adapter-bun' : '@nextrush/adapter-deno';

  return [
    "import { createApp, createRouter } from 'nextrush';",
    `import { ${serverFn} } from '${adapterPackage}';`,
  ];
}

/** Runtime-safe helper used by generated templates for health checks. */
export function getUptimeHelperFunction(): string {
  return `function getUptimeSeconds(): number {
  const now = globalThis.performance?.now?.();
  return typeof now === 'number' ? Math.floor(now / 1000) : 0;
}
`;
}

/** Runtime-safe helper used by generated templates to resolve the server port. */
export function getPortResolverFunction(): string {
  return `function resolvePort(defaultPort = 3000): number {
  const runtimeGlobals = globalThis as {
    process?: { env?: Record<string, string | undefined> };
    Deno?: { env?: { get?: (name: string) => string | undefined } };
  };

  const portFromProcess = runtimeGlobals.process?.env?.PORT;
  const portFromDeno = runtimeGlobals.Deno?.env?.get?.('PORT');
  const parsed = Number(portFromProcess ?? portFromDeno ?? defaultPort);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultPort;
}
`;
}

/** Runtime-safe helpers for controller auto-discovery in src and dist contexts. */
export function getControllerDiscoveryHelpers(): string {
  return `const IS_DIST_RUNTIME = import.meta.url.includes('/dist/');
const CONTROLLERS_ROOT = IS_DIST_RUNTIME ? './dist' : './src';
const CONTROLLERS_INCLUDE = IS_DIST_RUNTIME ? ['**/*.js'] : ['**/*.ts'];
`;
}

function getRuntimeScripts(runtime: Runtime): {
  readonly dev: string;
  readonly build: string;
  readonly start: string;
} {
  switch (runtime) {
    case 'bun':
      return {
        dev: 'nextrush dev',
        build: 'nextrush build',
        start: 'bun dist/index.js',
      };
    case 'deno':
      return {
        dev: 'deno run --watch --allow-net --allow-read --allow-env --unstable-sloppy-imports src/index.ts',
        build: `deno run -A npm:@nextrush/dev@${NEXTRUSH_VERSION} build`,
        start: 'deno run --allow-net --allow-read --allow-env dist/index.js',
      };
    case 'node':
      return {
        dev: 'nextrush dev',
        build: 'nextrush build',
        start: 'node dist/index.js',
      };
  }
}
