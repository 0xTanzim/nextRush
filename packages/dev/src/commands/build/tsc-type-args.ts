/**
 * @nextrush/dev - Declaration-pass type argument resolution
 *
 * TypeScript >= 6 no longer auto-includes `@types/*` packages when the project
 * tsconfig omits `compilerOptions.types` (TS 5.x auto-included them), so a
 * scaffolded NextRush project's local `.d.ts` pass fails with TS2591 ("Cannot
 * find name 'process'"). This helper decides whether to add `--types <pkg>` to
 * that tsc invocation (issue #40).
 */

import { detectProjectRuntime } from '../dev-helpers.js';
import {
  exists,
  getCwd,
  initFsSync,
  readFile,
  resolvePath,
  type Runtime,
} from '../../runtime/index.js';

const TYPE_PACKAGE_BY_RUNTIME: Partial<Record<Runtime, string>> = {
  node: 'node',
  bun: 'bun-types',
  // deno: Deno ships its own ambient types; no @types package to inject.
};

/**
 * True when the ambient type package for a runtime is installed in the project.
 * `bun-types` is a first-class package; every other runtime's lives under
 * `node_modules/@types/`.
 */
async function isTypePackageInstalled(cwd: string, typePackage: string): Promise<boolean> {
  const packagePath =
    typePackage === 'bun-types'
      ? resolvePath(cwd, 'node_modules', typePackage)
      : resolvePath(cwd, 'node_modules', '@types', typePackage);
  return exists(packagePath);
}

/**
 * Resolve the `--types` argument for the local tsc declaration pass.
 *
 * Returns the runtime's ambient type package (`node` / `bun-types`) when the
 * project does NOT pin `compilerOptions.types` in tsconfig.json and that package
 * is installed; returns `undefined` when the project pins its own types list
 * (respected — including an explicit empty list), when the package is absent,
 * or when the runtime needs no injection (Deno).
 *
 * Only the project's own tsconfig.json is consulted (no `extends` chain) — the
 * scaffolded projects this guards have none. A missing or unparseable tsconfig
 * is treated as "no explicit types": tsc reports config errors itself.
 */
export async function resolveDeclarationTypePackage(cwd: string = getCwd()): Promise<string | undefined> {
  await initFsSync();

  const tsconfigPath = resolvePath(cwd, 'tsconfig.json');
  if (await exists(tsconfigPath)) {
    try {
      const raw = await readFile(tsconfigPath);
      const tsconfig = JSON.parse(raw) as { compilerOptions?: { types?: unknown } };
      if (Array.isArray(tsconfig.compilerOptions?.types)) {
        return undefined;
      }
    } catch {
      // Unparseable tsconfig → fall through and inject permissively; tsc will
      // surface the malformed config as its own error.
    }
  }

  const typePackage = TYPE_PACKAGE_BY_RUNTIME[detectProjectRuntime(cwd)];
  if (!typePackage) {
    return undefined;
  }
  return (await isTypePackageInstalled(cwd, typePackage)) ? typePackage : undefined;
}
