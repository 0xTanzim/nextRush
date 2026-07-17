/**
 * Deno-based build with SWC decorator metadata emission support
 */

import { getCwd, resolvePath } from '../../runtime/index.js';
import { NODE_FS_PROMISES, NODE_PATH } from '../../runtime/node-modules.js';
import { error, info, log, success, warn, formatSize } from '../../utils/logger.js';
import type { BuildOptions } from './types.js';
import { findTypeScriptFiles } from './file-scanner.js';

export async function buildWithDeno(entry: string, outDir: string, options: BuildOptions): Promise<void> {
  log('Building with Deno + SWC...');

  try {
    // @ts-expect-error Deno global exists in Deno runtime
    const Deno = globalThis.Deno;

    const cwd = getCwd();
    const target = options.target ?? 'es2022';
    const sourcemap = options.sourcemap ?? true;
    const minify = options.minify ?? false;
    const decoratorMetadata = options.decoratorMetadata ?? true;

    // Find all TypeScript files
    const files = await findTypeScriptFiles(cwd, entry);
    log(`Found ${files.length} TypeScript file(s)`);

    // Ensure output directory exists
    const fs = await import(/* @vite-ignore */ NODE_FS_PROMISES);
    const path = await import(/* @vite-ignore */ NODE_PATH);
    const outPath = resolvePath(cwd, outDir);
    await fs.mkdir(outPath, { recursive: true });

    // Get source directory from entry to strip from output paths
    const srcDir = path.dirname(resolvePath(cwd, entry));

    // Try to use @swc/core via npm: specifier
    try {
      // @ts-expect-error npm: specifier is Deno-specific
      const swc = await import('npm:@swc/core@1.11.1');

      info('Using', '@swc/core via npm: specifier');

      // Transform each file
      for (const file of files) {
        const relativePath = path.relative(srcDir, file);
        const outFile = path.join(outPath, relativePath).replace(/\.ts$/, '.js');

        // Ensure output directory exists
        await fs.mkdir(path.dirname(outFile), { recursive: true });

        // Read source
        const source = await fs.readFile(file, 'utf-8');

        // Transform with SWC
        const result = await swc.transform(source, {
          filename: file,
          jsc: {
            parser: {
              syntax: 'typescript',
              decorators: true,
            },
            target: target,
            transform: {
              legacyDecorator: true,
              decoratorMetadata: decoratorMetadata,
            },
            keepClassNames: true,
            minify: minify
              ? {
                  compress: true,
                  mangle: true,
                }
              : undefined,
          },
          module: {
            type: 'es6',
          },
          sourceMaps: sourcemap,
        });

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

      success(`Built ${files.length} file(s) to ${outDir}/`);

      // Generate declaration files
      await generateDeclarationsWithDeno(cwd, outDir, Deno);

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
    // @ts-expect-error Deno global exists in Deno runtime
    const Deno = globalThis.Deno;

    const cwd = getCwd();
    const entryPath = resolvePath(cwd, entry);
    const outPath = resolvePath(cwd, outDir);

    // Ensure output directory exists
    await Deno.mkdir(outPath, { recursive: true });

    warn('Copying TypeScript source directly (Deno runs TS natively)');

    const fs = await import(/* @vite-ignore */ NODE_FS_PROMISES);
    const path = await import(/* @vite-ignore */ NODE_PATH);

    const srcDir = path.dirname(entryPath);
    const files = await findTypeScriptFiles(cwd, entry);

    for (const file of files) {
      const relativePath = path.relative(srcDir, file);
      const outFile = path.join(outPath, relativePath);
      await fs.mkdir(path.dirname(outFile), { recursive: true });
      await fs.copyFile(file, outFile);
    }

    success(`Copied ${files.length} TypeScript file(s) to ${outDir}/`);
    log('Run with: deno run -A dist/index.ts');
  } catch (err) {
    error(`Deno build failed: ${(err as Error).message}`);
    throw err;
  }
}

export async function generateDeclarationsWithDeno(
  cwd: string,
  outDir: string,
  Deno: {
    Command: new (
      cmd: string,
      opts: Record<string, unknown>
    ) => { output: () => Promise<{ code: number }> };
  }
): Promise<void> {
  log('Generating type declarations...');

  try {
    const command = new Deno.Command('npx', {
      args: ['tsc', '--declaration', '--emitDeclarationOnly', '--outDir', outDir],
      cwd,
      stderr: 'piped',
      stdout: 'piped',
    });

    const result = await command.output();

    if (result.code !== 0) {
      warn('Type declaration generation failed (non-critical)');
    }
  } catch {
    warn('Could not generate type declarations');
  }
}
