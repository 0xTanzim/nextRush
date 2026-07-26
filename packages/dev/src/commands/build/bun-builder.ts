/**
 * Bun-based build with native TypeScript support
 */

import { getCwd, resolvePath } from '../../runtime/index.js';
import { getBunGlobal } from '../../runtime/runtime-globals.js';
import { error, log, success } from '../../utils/logger.js';
import type { BuildOptions } from './types.js';

export async function buildWithBun(entry: string, outDir: string, options: BuildOptions): Promise<void> {
  log('Building with Bun...');

  try {
    const Bun = getBunGlobal();

    const cwd = getCwd();
    const sourcemap = options.sourcemap ?? true;
    const minify = options.minify ?? false;

    const result = await Bun.build({
      entrypoints: [resolvePath(cwd, entry)],
      outdir: resolvePath(cwd, outDir),
      target: 'bun',
      sourcemap: sourcemap ? 'external' : 'none',
      minify,
    });

    if (!result.success) {
      for (const buildLog of result.logs) {
        error(buildLog.message);
      }
      throw new Error('Build failed');
    }

    success(`Built to ${outDir}/`);
  } catch (err) {
    error(`Build failed: ${(err as Error).message}`);
    throw err;
  }
}
