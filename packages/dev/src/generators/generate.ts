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
 * Build the output file path for a generator.
 */
export function buildFilePath(cwd: string, type: GeneratorType, name: string): string {
  const config = GENERATORS[type];
  return joinPath(cwd, config.directory, `${name}${config.suffix}`);
}

/**
 * Run a single generator: validate, generate content, write to disk.
 */
export async function generate(type: GeneratorType, name: string, cwd?: string): Promise<string> {
  const root = cwd ?? getCwd();
  const config = GENERATORS[type];
  const filePath = buildFilePath(root, type, name);
  const dirPath = joinPath(root, config.directory);

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

  const type = resolveGeneratorType(typeArg);
  if (!type) {
    error(`Unknown generator type: "${typeArg}"`);
    error(`Available types: ${GENERATOR_TYPES.join(', ')}`);
    error(`Aliases: c (controller), s (service), mw (middleware), g (guard), r (route)`);
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
  middleware, mw   Create a middleware fn     (src/middleware/<name>.ts)
  guard, g         Create a guard fn          (src/guards/<name>.guard.ts)
  route, r         Create a route module      (src/routes/<name>.ts)

Examples:
  nextrush g controller user       Create src/controllers/user.controller.ts
  nextrush g s user                Create src/services/user.service.ts
  nextrush g mw logger             Create src/middleware/logger.ts
  nextrush g guard auth            Create src/guards/auth.guard.ts
  nextrush g r products            Create src/routes/products.ts
`);
}
