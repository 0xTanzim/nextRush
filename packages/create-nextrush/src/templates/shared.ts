import type { FileMap, ProjectOptions, Runtime } from '../types.js';
import { getRunCommand } from '../utils.js';
import { getDependencies, getPackageMetadata, getRuntimeScripts } from './package-json.js';

export { generateTsconfig } from './tsconfig.js';
export { getDependencies };

/** Generates package.json content for a new project. */
export function generatePackageJson(options: ProjectOptions): string {
  const deps = getDependencies(options);
  const scripts = getRuntimeScripts(options.runtime);
  const metadata = getPackageMetadata(options.packageManager);

  const pkg: Record<string, unknown> = {
    name: options.name,
    version: '0.1.0',
    private: true,
    type: 'module',
    engines: metadata.engines,
    ...(metadata.packageManager ? { packageManager: metadata.packageManager } : {}),
    scripts,
    dependencies: deps.dependencies,
    devDependencies: deps.devDependencies,
  };

  return JSON.stringify(pkg, null, 2) + '\n';
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

/**
 * Generates a README.md for the project, deriving the "Project Structure" section from
 * the given FileMap so it can never drift from what the generator actually emits (fixes
 * F-10 — the package README's `full` listing previously named a `not-found.ts` that was
 * never generated, and this per-project README always showed the `functional` layout).
 */
export function generateReadme(options: ProjectOptions, files: FileMap): string {
  const pmRun = getRunCommand(options.packageManager);

  return `# ${options.name}

A [NextRush](https://github.com/0xTanzim/nextRush) project.

## Getting Started

\`\`\`bash
# Development
${pmRun} dev

# Build for production
${pmRun} build

# Start production server
${pmRun === 'npm run' ? 'npm start' : `${pmRun} start`}

# Run tests
${pmRun === 'npm run' ? 'npm test' : `${pmRun} test`}
\`\`\`

## Project Structure

\`\`\`
${renderFileTree(files)}
\`\`\`

## Learn More

- [NextRush Documentation](https://github.com/0xTanzim/nextRush/tree/main/apps/docs)
- [GitHub](https://github.com/0xTanzim/nextRush)
`;
}

/** Renders a sorted, indented file tree from a generated FileMap's source paths. */
function renderFileTree(files: FileMap): string {
  return [...files.keys()].filter((path) => path.startsWith('src/')).sort().join('\n');
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
  /* eslint-disable nextrush/no-runtime-identity-capability -- scaffolder emits runtime-specific template snippets for the GENERATED project; not a capability decision in this CLI's own request path */
  if (runtime === 'node') {
    return [`import { createApp, createRouter, ${serverFn} } from 'nextrush';`];
  }

  const adapterPackage = runtime === 'bun' ? '@nextrush/adapter-bun' : '@nextrush/adapter-deno';
  /* eslint-enable nextrush/no-runtime-identity-capability */

  return [
    "import { createApp, createRouter } from 'nextrush';",
    `import { ${serverFn} } from '${adapterPackage}';`,
  ];
}

/** Returns the PORT declaration line for the given runtime. */
export function getPortDeclaration(runtime: Runtime): string {
  /* eslint-disable-next-line nextrush/no-runtime-identity-capability -- scaffolder emits a runtime-specific template snippet for the GENERATED project; not a capability decision in this CLI's own request path */
  if (runtime === 'deno') {
    return "const PORT = Number(Deno.env.get('PORT')) || 8080;";
  }
  return 'const PORT = Number(process.env.PORT) || 8080;';
}

/** Runtime-safe helpers for controller auto-discovery in src and dist contexts. */
export function getControllerDiscoveryHelpers(): string {
  return `const IS_DIST_RUNTIME = import.meta.url.includes('/dist/');
const CONTROLLERS_ROOT = IS_DIST_RUNTIME ? './dist/controllers' : './src/controllers';
const CONTROLLERS_INCLUDE = IS_DIST_RUNTIME ? ['**/*.js'] : ['**/*.ts'];
`;
}
