/**
 * @nextrush/dev - Generate Command
 *
 * Code generator for NextRush projects.
 * Creates controllers, services, middleware, guards, and routes.
 *
 * Usage:
 *   nextrush generate <type> <name>
 *   nextrush g <type> <name>
 *
 * @packageDocumentation
 */

import { exists, exitProcess, getCwd, joinPath, mkdir, writeFile } from '../runtime/index.js';
import { error, success } from '../utils/logger.js';
import { adapterFiles } from './adapter-templates.js';
import { GENERATOR_ALIASES, GENERATOR_TYPES, GENERATORS, type GeneratorType } from './templates.js';

/** Valid name pattern: lowercase letters, numbers, hyphens */
const NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

/**
 * Resolve a type string (or alias) to a GeneratorType.
 * Returns undefined if unrecognized.
 */
export function resolveGeneratorType(input: string): GeneratorType | undefined {
  const lower = input.toLowerCase();
  if (GENERATOR_TYPES.includes(lower as GeneratorType)) {
    return lower as GeneratorType;
  }
  return GENERATOR_ALIASES[lower];
}

/**
 * Validate the generator name.
 */
export function validateName(name: string): string | undefined {
  if (!name) return 'Name is required.';
  if (!NAME_PATTERN.test(name)) {
    return `Invalid name "${name}". Use lowercase letters, numbers, and hyphens (e.g., "user-profile").`;
  }
  return undefined;
}

/**
 * Build the output file path for a generator using its default (flat) directory.
 * Module-aware placement is resolved separately by {@link resolveOutputDirectory}.
 */
export function buildFilePath(cwd: string, type: GeneratorType, name: string): string {
  const config = GENERATORS[type];
  return joinPath(cwd, config.directory, `${name}${config.suffix}`);
}

/** Types that co-locate into a feature directory when the project uses modules. */
const FEATURE_DIRECTORY_TYPES: readonly GeneratorType[] = ['controller', 'service'];

/**
 * Resolve the output directory for a generator, matching the scaffolded project
 * structure:
 *
 * - `module` always lands in its own feature directory (`src/modules/<name>/`),
 *   the shape `create-nextrush`'s class-based template emits.
 * - `controller`/`service` in a class-based module project (a `src/modules/`
 *   directory exists) land in `src/modules/<name>/` so they co-locate with the
 *   feature's other files (module, tests).
 * - Everything else (including module-less/full-style projects) uses the
 *   generator's default flat directory (`src/controllers/`, `src/services/`, ...).
 *
 * @param cwd - Project root.
 * @param type - Generator type.
 * @param name - Scaffold name (kebab-case).
 * @returns The output directory relative to `cwd`.
 */
export async function resolveOutputDirectory(cwd: string, type: GeneratorType, name: string): Promise<string> {
  if (type === 'module' || (FEATURE_DIRECTORY_TYPES.includes(type) && (await exists(joinPath(cwd, 'src', 'modules'))))) {
    return joinPath('src', 'modules', name);
  }
  return GENERATORS[type].directory;
}

/**
 * Run a single generator: validate, generate content, write to disk.
 */
export async function generate(type: GeneratorType, name: string, cwd?: string): Promise<string> {
  const root = cwd ?? getCwd();
  const config = GENERATORS[type];
  const directory = await resolveOutputDirectory(root, type, name);
  const filePath = joinPath(root, directory, `${name}${config.suffix}`);
  const dirPath = joinPath(root, directory);

  // Check if file already exists
  if (await exists(filePath)) {
    throw new Error(`File already exists: ${filePath}`);
  }

  // Create directory if needed
  if (!(await exists(dirPath))) {
    await mkdir(dirPath);
  }

  // Generate and write
  const content = config.template(name);
  await writeFile(filePath, content);

  return filePath;
}

/**
 * Scaffold a contract-conformant adapter (Adapter Development Kit, group 11.2).
 *
 * Emits a directory `<cwd>/<name>/` with `src/adapter.ts` (the `FetchAdapter`
 * guard + context-factory TODO), `src/__tests__/conformance.test.ts` (wired to
 * the shared conformance suite), `fixtures/`, `README.md`, and a CI snippet — so
 * a new runtime adapter is certifiable from day one.
 *
 * @param name - The adapter name (kebab-case).
 * @param cwd - Base directory (defaults to the process cwd).
 * @returns The absolute paths of the files written.
 */
export async function generateAdapter(name: string, cwd?: string): Promise<string[]> {
  const root = cwd ?? getCwd();
  const base = joinPath(root, name);
  if (await exists(base)) {
    throw new Error(`Directory already exists: ${base}`);
  }

  const files = adapterFiles(name);

  // Collect every directory needed, shallowest first, so parents exist before
  // children even if mkdir is not recursive.
  const dirs = new Set<string>([base]);
  for (const rel of Object.keys(files)) {
    const segments = rel.split('/');
    segments.pop(); // drop the filename
    let acc = base;
    for (const segment of segments) {
      acc = joinPath(acc, segment);
      dirs.add(acc);
    }
  }
  for (const dir of [...dirs].sort((a, b) => a.length - b.length)) {
    if (!(await exists(dir))) await mkdir(dir);
  }

  const written: string[] = [];
  for (const [rel, content] of Object.entries(files)) {
    const full = joinPath(base, ...rel.split('/'));
    await writeFile(full, content);
    written.push(full);
  }
  return written;
}

/**
 * CLI entry point for `nextrush generate`.
 * Parses args, validates, runs generator, reports.
 */
export async function generateCli(args: string[]): Promise<void> {
  const typeArg = args[0];
  const nameArg = args[1];

  if (!typeArg) {
    error('Missing generator type.');
    generateHelp();
    exitProcess(1);
  }

  // Adapter Development Kit — a multi-file scaffold, distinct from the
  // single-file generators (group 11.2).
  if (typeArg.toLowerCase() === 'adapter' || typeArg.toLowerCase() === 'ad') {
    if (!nameArg) {
      error('Missing name. Usage: nextrush generate adapter <name>');
      exitProcess(1);
    }
    const adapterNameError = validateName(nameArg);
    if (adapterNameError) {
      error(adapterNameError);
      exitProcess(1);
    }
    try {
      const written = await generateAdapter(nameArg);
      success(`Scaffolded adapter "${nameArg}" (${String(written.length)} files):`);
      for (const file of written) success(`  ${file}`);
    } catch (err) {
      error((err as Error).message);
      exitProcess(1);
    }
    return;
  }

  const type = resolveGeneratorType(typeArg);
  if (!type) {
    error(`Unknown generator type: "${typeArg}"`);
    error(`Available types: ${GENERATOR_TYPES.join(', ')}`);
    error(`Aliases: c (controller), s (service), m (module), mw (middleware), g (guard), r (route)`);
    exitProcess(1);
  }

  if (!nameArg) {
    error(`Missing name. Usage: nextrush generate ${type} <name>`);
    exitProcess(1);
  }

  const nameError = validateName(nameArg);
  if (nameError) {
    error(nameError);
    exitProcess(1);
  }

  try {
    const filePath = await generate(type, nameArg);
    success(`Created ${type}: ${filePath}`);
  } catch (err) {
    error((err as Error).message);
    exitProcess(1);
  }
}

/**
 * Print generate command help.
 */
export function generateHelp(): void {
  console.log(`
\x1b[36m⚡ NextRush Generate\x1b[0m

Usage: nextrush generate <type> <name>
       nextrush g <type> <name>

Types:
  controller, c    Create a controller class (src/controllers/<name>.controller.ts)
  service, s       Create a service class    (src/services/<name>.service.ts)
  module, m        Create a feature module    (src/modules/<name>/<name>.module.ts)
  middleware, mw   Create a middleware fn     (src/middleware/<name>.ts)
  guard, g         Create a guard fn          (src/guards/<name>.guard.ts)
  route, r         Create a route module      (src/routes/<name>.ts)
  adapter, ad      Scaffold a runtime adapter (<name>/ — contract guard + conformance suite + CI)

Examples:
  nextrush g controller user       Create src/controllers/user.controller.ts
  nextrush g s user                Create src/services/user.service.ts
  nextrush g m todos               Create src/modules/todos/todos.module.ts
  nextrush g mw logger             Create src/middleware/logger.ts
  nextrush g guard auth            Create src/guards/auth.guard.ts
  nextrush g r products            Create src/routes/products.ts
  nextrush g adapter my-runtime    Scaffold my-runtime/ (certifiable adapter package)
`);
}
