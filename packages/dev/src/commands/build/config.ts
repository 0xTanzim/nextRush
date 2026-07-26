/**
 * Build command configuration and target parsing
 */

import { exitProcess } from '../../runtime/index.js';
import { error } from '../../utils/logger.js';
import type { BuildOptions } from './types.js';
import { VALID_TARGETS } from './types.js';

export function parseBuildTarget(value: string | undefined): BuildOptions['target'] {
  if (!value || !VALID_TARGETS.has(value)) {
    error('--target expects one of: es2020, es2021, es2022, esnext');
    exitProcess(1);
  }

  return value as BuildOptions['target'];
}

export function resolveBuildOptions(options: BuildOptions): {
  outDir: string;
  target: 'es2020' | 'es2021' | 'es2022' | 'esnext';
  sourcemap: boolean;
  minify: boolean;
  decoratorMetadata: boolean;
  dts: boolean;
  clean: boolean;
  cache: boolean;
  verbose: boolean;
} {
  return {
    outDir: options.outDir ?? 'dist',
    target: options.target ?? 'es2022',
    sourcemap: options.sourcemap ?? true,
    minify: options.minify ?? false,
    decoratorMetadata: options.decoratorMetadata ?? true,
    dts: options.dts ?? true,
    clean: options.clean ?? true,
    cache: options.cache ?? true,
    verbose: options.verbose ?? false,
  };
}
