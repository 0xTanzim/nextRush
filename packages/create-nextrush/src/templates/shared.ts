import type { FileMap, ProjectOptions, Runtime } from '../types.js';
import { getRunCommand } from '../utils.js';
import { getExampleReadmeSection } from './example.js';
import { getDependencies, getPackageMetadata, getRuntimeScripts } from './package-json.js';

export { generateTsconfig } from './tsconfig.js';
export { getDependencies };

/** Generates package.json content for a new project. */
export function generatePackageJson(options: ProjectOptions): string {
  const deps = getDependencies(options);
  const scripts = getRuntimeScripts(options.runtime);
  const metadata = getPackageMetadata(options.packageManager, options.runtime);

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

/** Valid port range for the generated config's PORT normalization (1–65535). */
const MAX_PORT = 65535;

/**
 * Generates the centralized `src/config/index.ts` for a generated project — the single
 * source of truth for application configuration, shared across every scaffold style.
 *
 * The implementation is runtime-split (`process.env` for node/bun, `Deno.env.get` for
 * deno) behind one consistent `{ port, host, nodeEnv }` surface. PORT/NODE_ENV are
 * normalized deterministically: a malformed PORT (empty/invalid/zero/negative/overflow)
 * resolves to 8080 instead of NaN/0, and an unknown NODE_ENV coerces to 'development'
 * so error-handler behavior is never flipped by an unexpected value.
 *
 * capability-exempt: scaffolder emits a runtime-specific env-reading snippet for the
 * GENERATED project's config; not a capability decision in this CLI's own request path.
 */
export function generateConfig(options: ProjectOptions): string {
  /* eslint-disable-next-line nextrush/no-runtime-identity-capability -- scaffolder emits a runtime-specific env-reading snippet for the GENERATED project's config; not a capability decision in this CLI's own request path */
  const isDeno = options.runtime === 'deno';
  const readEnv = (name: string): string => (isDeno ? `Deno.env.get('${name}')` : `process.env.${name}`);
  const envSource = isDeno ? 'Deno.env.get' : 'process.env';

  return `/** Centralized environment configuration.
 *
 * Read each variable once, convert its type, and provide a default — don't
 * scatter ${envSource} calls across
 * route handlers. Fail fast on missing required values at startup, not deep in a
 * request handler. A malformed PORT (empty/non-numeric/zero/out-of-range) falls back
 * to 8080, and an unknown NODE_ENV falls back to 'development'.
 *
 * @see https://nextrush.dev/docs/production/configuration
 */
const parsePort = (raw: string | undefined): number => {
  if (raw === undefined || raw === '') return 8080;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= ${String(MAX_PORT)} ? parsed : 8080;
};

const parseNodeEnv = (raw: string | undefined): 'development' | 'production' | 'test' =>
  raw === 'production' || raw === 'test' ? raw : 'development';

export const config = {
  port: parsePort(${readEnv('PORT')}),
  host: ${readEnv('HOST')} ?? '0.0.0.0',
  nodeEnv: parseNodeEnv(${readEnv('NODE_ENV')}),
} as const;
`;
}

/** Generates `.env` / `.env.example` — the same layout for EVERY runtime; only the
 * loading mechanism differs (dotenv import for node/bun, `--env-file` for deno). */
export function generateEnvFiles(): { path: string; content: string }[] {
  const example = `.env.example`;
  const exampleContent = `# Copy to .env and fill in your values — .env is gitignored.
HOST=
PORT=
NODE_ENV=
`;

  return [
    { path: '.env', content: `HOST=0.0.0.0\nPORT=8080\nNODE_ENV=development\n` },
    { path: example, content: exampleContent },
  ];
}

/**
 * Generates a `.yarnrc.yml` for Yarn projects.
 *
 * Yarn Berry (v4) defaults to PnP, which never materializes `node_modules` — a
 * generated project's scripts (`nextrush dev`/`build`, `vitest`) assume a classic
 * `node_modules` layout. Pinning `nodeLinker: node-modules` makes Yarn behave like
 * the other supported managers so install/build/dev work out of the box (fixes the
 * Docker-matrix Yarn failure where `yarn build` could not find `@nextrush/dev`).
 */
export function generateYarnrc(): string {
  return `nodeLinker: node-modules
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
  // Every runtime ships a .env + .env.example; the loading mechanism differs.
  /* eslint-disable nextrush/no-runtime-identity-capability -- scaffolder emits runtime-specific docs from user choice, not a capability decision in this CLI's own request path */
  const loadingNote =
    options.runtime === 'deno'
      ? `The \`start\` script loads \`.env\` via Deno's \`--env-file=.env\`; \`nextrush dev\`
loads it through the dev toolchain.`
      : `The entrypoint loads \`.env\` via \`dotenv\` (first import).`;

  // The loader that must not overwrite existing env (documented in the dev-precedence note).
  const loaderName = options.runtime === 'deno' ? '`--env-file`' : 'dotenv';
  /* eslint-enable nextrush/no-runtime-identity-capability */

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

## Environment

The project ships a \`.env\` with sensible defaults and a committed \`.env.example\`
documenting the variables. \`.env\` is gitignored — never commit it. ${loadingNote}

| Variable   | Default       | Description                              |
| ---------- | ------------- | ---------------------------------------- |
| \`HOST\`    | \`0.0.0.0\`    | Interface the server binds to            |
| \`PORT\`    | \`8080\`       | Port the server listens on               |
| \`NODE_ENV\` | \`development\` | \`development\` / \`production\` / \`test\` |

> [!NOTE]
> Under \`${pmRun} dev\`, the NextRush dev toolchain injects \`PORT\` and
> \`NODE_ENV=development\` into the spawned process, which takes precedence over
> \`.env\` (${loaderName} does not overwrite existing env). To change the dev port, pass
> \`--port\` to the dev command or set it in \`nextrush.config.ts\`. The production start
> (\`${pmRun} start\`) honors \`.env\` directly.

## Production

Validate the production build locally before deploying:

\`\`\`bash
${pmRun} build
${pmRun === 'npm run' ? 'npm start' : `${pmRun} start`}
# then open the health endpoint: http://localhost:8080/health
\`\`\`

See the [production documentation](https://nextrush.dev/docs/production) for deployment,
configuration, and operations guidance.

## Project Structure

\`\`\`
${renderFileTree(files)}
\`\`\`
${getExampleReadmeSection(options)}
## Learn More

- [NextRush Documentation](https://github.com/0xTanzim/nextRush/tree/main/apps/website)
- [GitHub](https://github.com/0xTanzim/nextRush)
`;
}

/** Renders a sorted, indented file tree from a generated FileMap's paths.
 *
 * Includes the root-level env files (`.env`/`.env.example`) so the structure listing
 * reflects exactly what was emitted, plus the `src/` tree. */
function renderFileTree(files: FileMap): string {
  const envFiles = [...files.keys()]
    .filter((path) => path === '.env' || path === '.env.example')
    .sort();
  const srcFiles = [...files.keys()].filter((path) => path.startsWith('src/')).sort();
  return [...envFiles, ...srcFiles].join('\n');
}

/** Generates the src/env.d.ts file for better type hints.
 *
 * Deno resolves ambient type packages from `node_modules/@types/*` itself
 * (Deno 2 `nodeModulesDir`), so the triple-slash `@nextrush/types` reference is
 * only emitted for Node/Bun — under `deno check` the reference would be an
 * unresolvable specifier error, since `@nextrush/types` is not a Deno module.
 */
export function generateEnvDts(options: ProjectOptions): string {
  // capability-exempt: scaffolder emits runtime-specific project files from user choice,
  // not the executing runtime. `options.runtime` is a scaffold-time decision.
  if (options.runtime === 'deno') {
    return '';
  }
  return `/// <reference types="@nextrush/types" />
`;
}

/** Returns import lines for the selected runtime and server function.
 *
 * For Node/Bun, `import 'dotenv/config'` is emitted as the FIRST line so `.env` is
 * loaded before any module reads configuration (the generated application owns env-file
 * loading — it must work in dev AND production, where `@nextrush/dev` is absent). Deno
 * uses native `Deno.env`, so it gets no `dotenv` import.
 *
 * `extraNextrushImports` lets a template pull additional named exports from the
 * `nextrush` meta-package (e.g. `errorHandler`) without a second import line. */
export function getRuntimeEntrypointImports(
  runtime: Runtime,
  serverFn: 'listen' | 'serve',
  extraNextrushImports: readonly string[] = []
): string[] {
  const imports: string[] = [];
  // capability-exempt: scaffolder emits a runtime-specific template snippet for the
  // GENERATED project; not a capability decision in this CLI's own request path.
  if (runtime !== 'deno') {
    imports.push("import 'dotenv/config';");
  }

  /* eslint-disable nextrush/no-runtime-identity-capability -- scaffolder emits runtime-specific template snippets for the GENERATED project; not a capability decision in this CLI's own request path */
  if (runtime === 'node') {
    const names = ['createApp', 'createRouter', ...extraNextrushImports, serverFn];
    imports.push(`import { ${names.join(', ')} } from 'nextrush';`);
    return imports;
  }

  const adapterPackage = runtime === 'bun' ? '@nextrush/adapter-bun' : '@nextrush/adapter-deno';
  /* eslint-enable nextrush/no-runtime-identity-capability */

  const names = ['createApp', 'createRouter', ...extraNextrushImports];
  imports.push(`import { ${names.join(', ')} } from 'nextrush';`);
  imports.push(`import { ${serverFn} } from '${adapterPackage}';`);
  return imports;
}

/** Returns the server-start line for the given runtime, forwarding `config.host`.
 *
 * All adapters expose a canonical `host` option, so the generated entrypoint passes
 * both `config.port` and `config.host` — a configured `HOST` is honored rather than
 * silently ignored. The `listen` helper (port-only) is replaced by `serve`-with-options
 * for host forwarding; the caller imports `serve` via `getRuntimeEntrypointImports`. */
export function getServerStartLine(): string {
  return `await serve(app, { port: config.port, host: config.host });`;
}
