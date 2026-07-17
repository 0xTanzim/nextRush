/**
 * Bun-based build with native TypeScript support
 */

import { getCwd, resolvePath } from '../../runtime/index.js';
import { error, log, success } from '../../utils/logger.js';
import type { BuildOptions } from './types.js';

export async function buildWithBun(entry: string, outDir: string, options: BuildOptions): Promise<void> {
  log('Building with Bun...');

  try {
    // @ts-expect-error Bun global exists in Bun runtime
    const Bun = globalThis.Bun;

    const cwd = getCwd();
    const sourcemap = options.sourcemap ?? true;
    const minify = options.minify ?? false;

    const result = await Bun.build({
      entrypoints: [resolvePath(cwd, entry)],
      outdir: resolvePath(cwd, outDir),
      target: 'bun',
      sourcemap: sourcemap ? 'external' : 'none',
      minify: minify,
    });

    if (!result.success) {
      for (const log of result.logs) {
        error(log.message);
      }
      throw new Error('Build failed');
    }

    success(`Built to ${outDir}/`);
  } catch (err) {
    error(`Build failed: ${(err as Error).message}`);
    throw err;
  }
}
