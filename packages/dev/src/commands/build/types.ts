/**
 * Shared types for build command
 */

export const VALID_TARGETS = new Set(['es2020', 'es2021', 'es2022', 'esnext']);

export interface BuildOptions {
  /** Entry file path */
  entry?: string;
  /** Output directory */
  outDir?: string;
  /** Target ES version */
  target?: 'es2020' | 'es2021' | 'es2022' | 'esnext';
  /** Generate sourcemaps */
  sourcemap?: boolean;
  /** Minify output */
  minify?: boolean;
  /** Emit decorator metadata (required for DI) */
  decoratorMetadata?: boolean;
  /** Generate .d.ts declaration files */
  dts?: boolean;
  /** Clean output directory before build */
  clean?: boolean;
  /** Use incremental build cache */
  cache?: boolean;
  /** Verbose output */
  verbose?: boolean;
}
