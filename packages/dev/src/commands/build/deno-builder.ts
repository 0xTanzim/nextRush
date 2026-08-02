/**
 * Deno-based build with SWC decorator metadata emission support.
 *
 * Consumes the `TypeScriptFile[]` produced by {@link findTypeScriptFiles} by its
 * `path`/`ext` fields (never treating the record as a bare path string) and maps
 * extensions with the shared {@link mapExtension} — the same as the Node builder —
 * so the two paths cannot drift (RFC-019 D7, F-01).
 */

import { getCwd, resolvePath } from '../../runtime/index.js';
import { getNodeFsPromises, getNodePath } from '../../runtime/node-modules.js';
import { error, info, log, success, warn, formatSize } from '../../utils/logger.js';
import type { BuildOptions } from './types.js';
import { findTypeScriptFiles, mapExtension, type TypeScriptFile } from './file-scanner.js';
import { writeDeclarationTsconfig, resolveTscPath } from './declaration-builder.js';
import { buildSwcTransformOptions } from './swc-transform-options.js';

/** SWC version pulled via Deno's `npm:` specifier — kept in sync with package.json. */
const SWC_NPM_SPECIFIER = 'npm:@swc/core@1.15.43';

/**
 * The subset of the Deno global this file actually calls — no static Deno types are
 * available in this Node-typed package, so a minimal local interface removes the
 * `any` cascade from `globalThis.Deno` without needing a blanket eslint-disable.
 */
interface DenoCommandCtor {
  Command: new (
    cmd: string,
    opts: Record<string, unknown>
  ) => { output: () => Promise<{ code: number }> };
}

/** The subset of `@swc/core`'s API this file calls, resolved via Deno's `npm:` specifier. */
interface SwcCoreLike {
  transform: (
    source: string,
    options: ReturnType<typeof buildSwcTransformOptions>
  ) => Promise<{ code: string; map?: string }>;
}

export async function buildWithDeno(entry: string, outDir: string, options: BuildOptions): Promise<void> {
  log('Building with Deno + SWC...');

  try {
    // Deno has no static types available in this Node-typed package; a minimal local
    // interface for just the members this function calls removes the `any` cascade
    // without needing a blanket eslint-disable.
    const globalWithDeno = globalThis as unknown as {
      Deno: DenoCommandCtor;
    };
    const Deno = globalWithDeno.Deno;

    const cwd = getCwd();
    const target = options.target ?? 'es2022';
    const sourcemap = options.sourcemap ?? true;
    const minify = options.minify ?? false;
    const decoratorMetadata = options.decoratorMetadata ?? true;

    // Find all TypeScript files
    const files = await findTypeScriptFiles(cwd, entry);
    log(`Found ${String(files.length)} TypeScript file(s)`);

    // Ensure output directory exists
    const fs = await getNodeFsPromises();
    const path = await getNodePath();
    const outPath = resolvePath(cwd, outDir);
    await fs.mkdir(outPath, { recursive: true });

    // Get source directory from entry to strip from output paths
    const srcDir = path.dirname(resolvePath(cwd, entry));

    // Try to use @swc/core via npm: specifier
    try {
      // The npm: specifier is Deno-specific; the variable specifier keeps it opaque
      // to the bundler (so it's never prefix-stripped), and `SwcCoreLike` gives the
      // result a real type instead of the `any` the variable-specifier import yields.
      const swc = (await import(SWC_NPM_SPECIFIER)) as SwcCoreLike;

      info('Using', `@swc/core via ${SWC_NPM_SPECIFIER}`);

      // Transform each file — operate on file.path/file.ext (TypeScriptFile), map
      // extensions the same way the Node builder does.
      for (const file of files) {
        const relativePath = path.relative(srcDir, file.path);
        const outExt = mapExtension(file.ext);
        const outFile = path.join(outPath, relativePath).replace(/\.\w+$/, outExt);

        // Ensure output directory exists
        await fs.mkdir(path.dirname(outFile), { recursive: true });

        // Read source
        const source = await fs.readFile(file.path, 'utf-8');

        // Transform with SWC — options come from the shared helper (task 3.2) so this
        // path and swc-builder.ts's cannot silently diverge again.
        const result = await swc.transform(
          source,
          buildSwcTransformOptions(file.path, file.ext === '.tsx', {
            target,
            decoratorMetadata,
            minify,
            sourcemap,
          })
        );

        // Write output
        await fs.writeFile(outFile, result.code);

        // Write sourcemap
        if (sourcemap && result.map) {
          await fs.writeFile(`${outFile}.map`, result.map);
        }

        if (options.verbose) {
          const stats = await fs.stat(outFile);
          log(`  ${relativePath} → ${formatSize(stats.size)}`);
        }
      }

      success(`Built ${String(files.length)} file(s) to ${outDir}/`);

      // Generate declaration files
      await generateDeclarationsWithDeno(cwd, outDir, srcDir, files, Deno);

      return;
    } catch (swcError) {
      // SWC via npm: failed, fall back to native compilation
      warn(`SWC import failed: ${(swcError as Error).message}`);
      warn('Falling back to Deno native compilation...');
      await buildWithDenoNative(entry, outDir, options);
    }
  } catch (err) {
    error(`Deno build failed: ${(err as Error).message}`);
    throw err;
  }
}

export async function buildWithDenoNative(
  entry: string,
  outDir: string,
  _options: BuildOptions
): Promise<void> {
  warn('Deno native build does NOT emit decorator metadata');
  warn('DI systems may not work correctly. Consider using Node.js or Bun for production builds.');

  try {
    // Deno has no static types available in this Node-typed package; a minimal local
    // interface for just the members this function calls removes the `any` cascade
    // without needing a blanket eslint-disable.
    const globalWithDeno = globalThis as unknown as {
      Deno: { mkdir: (path: string, opts: { recursive: boolean }) => Promise<void> };
    };

    const cwd = getCwd();
    const entryPath = resolvePath(cwd, entry);
    const outPath = resolvePath(cwd, outDir);

    // Ensure output directory exists
    await globalWithDeno.Deno.mkdir(outPath, { recursive: true });

    warn('Copying TypeScript source directly (Deno runs TS natively)');

    const fs = await getNodeFsPromises();
    const path = await getNodePath();

    const srcDir = path.dirname(entryPath);
    const files = await findTypeScriptFiles(cwd, entry);

    for (const file of files) {
      const relativePath = path.relative(srcDir, file.path);
      const outFile = path.join(outPath, relativePath);
      await fs.mkdir(path.dirname(outFile), { recursive: true });
      await fs.copyFile(file.path, outFile);
    }

    success(`Copied ${String(files.length)} TypeScript file(s) to ${outDir}/`);
    log('Run with: deno run -A dist/index.ts');
  } catch (err) {
    error(`Deno build failed: ${(err as Error).message}`);
    throw err;
  }
}

export async function generateDeclarationsWithDeno(
  cwd: string,
  outDir: string,
  srcDir: string,
  files: TypeScriptFile[],
  Deno: DenoCommandCtor
): Promise<void> {
  log('Generating type declarations...');

  try {
    const path = await getNodePath();
    const srcPrefix = srcDir.endsWith(path.sep) ? srcDir : `${srcDir}${path.sep}`;
    const sourceFiles = files.filter((file) => file.path.startsWith(srcPrefix));

    // Same test-filtered, srcDir-scoped source set as the Node builder (issue2): the
    // declaration pass must agree with the SWC transform on "what is project source".
    const configPath = await writeDeclarationTsconfig(cwd, sourceFiles);
    const tscPath = await resolveTscPath();

    const args = [
      'run',
      '-A',
      tscPath,
      '--declaration',
      '--emitDeclarationOnly',
      '--rootDir',
      srcDir,
      '--outDir',
      outDir,
    ];
    if (configPath) {
      args.push('--project', configPath);
    } else {
      // No project tsconfig → pass the files directly (no TS5112 hazard).
      args.push(...sourceFiles.map((file) => file.path));
    }

    // The Deno binary is guaranteed present (we ARE running under it); `deno run -A`
    // executes the locally resolved tsc directly — no npx, no node_modules requirement.
    const command = new Deno.Command('deno', { args, cwd, stderr: 'piped', stdout: 'piped' });

    const result = await command.output();

    if (result.code !== 0) {
      warn('Type declaration generation failed (non-critical)');
    }
  } catch {
    warn('Could not generate type declarations');
  }
}
