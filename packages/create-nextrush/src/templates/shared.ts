import { ADAPTER_PACKAGES, MIDDLEWARE_PACKAGES, NEXTRUSH_VERSION } from '../constants.js';
import type { DependencySet, ProjectOptions } from '../types.js';

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

  const pkg: Record<string, unknown> = {
    name: options.name,
    version: '0.1.0',
    private: true,
    type: 'module',
    scripts: {
      dev: 'nextrush dev',
      build: 'nextrush build',
      start: 'node dist/index.js',
    },
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

  if (needsReflectMetadata) {
    dependencies['reflect-metadata'] = '>=0.1.13';
  }

  // Middleware packages
  const middlewareDeps = MIDDLEWARE_PACKAGES[options.middleware];
  Object.assign(dependencies, middlewareDeps);

  // Runtime adapter packages (node uses built-in, others need adapters)
  const adapterDeps = ADAPTER_PACKAGES[options.runtime];
  Object.assign(dependencies, adapterDeps);

  const devDependencies: Record<string, string> = {
    '@nextrush/dev': `^${NEXTRUSH_VERSION}`,
    typescript: '^5.9.0',
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
  return `/// <reference types="nextrush/types" />
`;
}
