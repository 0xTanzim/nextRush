/**
 * Local TypeScript declaration emission for `nextrush build`.
 *
 * Runs the project's own `tsc` (resolved deterministically, no npx/network) through a
 * generated temp tsconfig that EXTENDS the project's real tsconfig and pins an explicit
 * `files` list — the same test-filtered, srcDir-scoped source set the SWC transform
 * compiled. Two TS-6 facts force this shape:
 *
 * - Passing positional files on the CLI while a tsconfig exists is a hard error (TS5112),
 *   so the file list must live INSIDE a config (`files`), never on the command line.
 * - Extending the project config preserves every compilerOption the project owns (`types`,
 *   decorators, strictness, jsx…) while our temp `files` REPLACES the inherited
 *   `include`/`exclude` glob — so test/spec files can never leak into `dist/` as empty
 *   `export {}` modules the way the old bare-tsc glob did (issue2).
 */

import { resolvePath } from '../../runtime/index.js';
import {
  getNodeChildProcess,
  getNodeFsPromises,
  getNodeModule,
  getNodePath,
} from '../../runtime/node-modules.js';
import { error, log, success } from '../../utils/logger.js';
import type { TypeScriptFile } from './file-scanner.js';
import { resolveDeclarationTypePackage } from './tsc-type-args.js';

/** Temp config lives with the build cache, outside srcDir/outDir — survives `--clean`. */
const DECLARATION_CONFIG_DIR = 'node_modules/.cache/nextrush';

/**
 * Write a temp tsconfig for a declaration-only tsc run.
 *
 * Extends the project's tsconfig when one exists (inheriting its compilerOptions), and
 * always pins `files` to the given source set. Returns the absolute path of the written
 * config, or `null` when the caller should fall back to flag-only invocation (no project
 * tsconfig, no TS5112 hazard).
 */
export async function writeDeclarationTsconfig(cwd: string, files: TypeScriptFile[]): Promise<string | null> {
  const fs = await getNodeFsPromises();
  const path = await getNodePath();

  const projectConfig = resolvePath(cwd, 'tsconfig.json');
  let extendsConfig: string | undefined;
  try {
    await fs.access(projectConfig);
    extendsConfig = projectConfig;
  } catch {
    // No project tsconfig → plain flag invocation is safe (no TS5112).
    return null;
  }

  const config = extendsConfig
    ? {
        extends: extendsConfig,
        // Override the inherited include/exclude globs with an explicit pin: `files` is
        // the ONLY input source, so a base `include: ["src/**/*"]` can never pull test
        // files back into the declaration program (TS extends deep-merges configs).
        include: [],
        files: files.map((file) => file.path),
      }
    : { files: files.map((file) => file.path) };

  const configDir = resolvePath(cwd, DECLARATION_CONFIG_DIR);
  await fs.mkdir(configDir, { recursive: true });
  const configPath = path.join(configDir, 'tsconfig.declarations.json');
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  return configPath;
}

/**
 * Resolve the project's local `tsc` binary path deterministically (no npx, no network).
 *
 * `createRequire(import.meta.url)` resolves against this package's own dependency tree,
 * so the typescript version bundled with `@nextrush/dev` is used — not whatever happens
 * to be on PATH or in the project's node_modules.
 */
export async function resolveTscPath(): Promise<string> {
  const nodeModule = await getNodeModule();
  const requireFromThis = nodeModule.createRequire(import.meta.url);

  try {
    const tsPkgPath = requireFromThis.resolve('typescript/package.json');
    const fs = await getNodeFsPromises();
    const path = await getNodePath();

    const tsPkgContent = await fs.readFile(tsPkgPath, 'utf-8');
    const tsPkg = JSON.parse(tsPkgContent) as { bin?: { tsc?: string } };

    if (!tsPkg.bin?.tsc) {
      throw new Error('TypeScript bin/tsc not found in package.json');
    }

    return path.resolve(path.dirname(tsPkgPath), tsPkg.bin.tsc);
  } catch (err) {
    throw new Error(
      `Cannot find local TypeScript compiler. Please install TypeScript: npm install --save-dev typescript\n` +
      `Original error: ${(err as Error).message}`,
      { cause: err }
    );
  }
}

/**
 * Generate TypeScript declarations using the project's local tsc.
 *
 * Resolves the locally installed typescript package deterministically (no npx, no
 * network), and pins `--rootDir` to the SWC source dir so emitted `.d.ts` files mirror
 * the `.js` output layout for nested sources (RFC-019 D6).
 *
 * The input file list is the SAME test-filtered set the SWC transform used, scoped to
 * `srcDir` (tsc rejects files outside `--rootDir` with TS6059, and the package-boundary
 * scan can legitimately include root-level configs like `vitest.config.ts` that must not
 * be declaration-emitted). This keeps the two build steps agreeing on "what is project
 * source": test/spec files never leak into `dist/` as empty `export {}` modules (issue2).
 */
export async function generateDeclarations(
  cwd: string,
  outDir: string,
  srcDir: string,
  files: TypeScriptFile[]
): Promise<void> {
  log('Generating type declarations...');

  try {
    const tscPath = await resolveTscPath();
    const path = await getNodePath();
    const srcPrefix = srcDir.endsWith(path.sep) ? srcDir : `${srcDir}${path.sep}`;
    const sourceFiles = files.filter((file) => file.path.startsWith(srcPrefix));

    const configPath = await writeDeclarationTsconfig(cwd, sourceFiles);

    // TS >= 6 no longer auto-includes @types/* when tsconfig omits `types`
    // (issue #40): inject the runtime's ambient type package so declaration emit
    // still resolves `process` etc. without the project pinning its own list.
    const declarationArgs = [tscPath, '--declaration', '--emitDeclarationOnly', '--rootDir', srcDir, '--outDir', outDir];
    if (configPath) {
      declarationArgs.push('--project', configPath);
    } else {
      // No project tsconfig → pass the files directly (no TS5112 hazard).
      declarationArgs.push(...sourceFiles.map((file) => file.path));
    }
    const typePackage = await resolveDeclarationTypePackage(cwd);
    if (typePackage !== undefined) {
      declarationArgs.push('--types', typePackage);
    }

    // Run tsc via node:child_process
    const { spawn: nodeSpawn } = await getNodeChildProcess();

    await new Promise<void>((resolve, reject) => {
      // Run via process.execPath (node binary) to avoid relying on PATH
      const tsc = nodeSpawn(process.execPath, declarationArgs, {
        cwd,
        stdio: 'pipe',
      });

      let stdout = '';
      let stderr = '';

      tsc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      tsc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      tsc.on('close', (code: number | null) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(
              `Type declaration generation failed (code ${String(code)})\n` +
              (stderr || stdout || 'No output from tsc')
            )
          );
        }
      });

      tsc.on('error', (err: Error) => {
        reject(new Error(`Failed to spawn tsc: ${err.message}`, { cause: err }));
      });
    });

    success('Type declarations generated');
  } catch (err) {
    error(`Declaration generation failed: ${(err as Error).message}`);
    throw err;
  }
}
