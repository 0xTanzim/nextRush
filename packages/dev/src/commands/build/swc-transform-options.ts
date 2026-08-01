/**
 * Shared SWC transform options — the single source of truth for how `.ts`/`.tsx` source
 * is transformed, used by BOTH the Node builder (`swc-builder.ts`) and the Deno builder
 * (`deno-builder.ts`).
 *
 * Before this file existed, each builder constructed its own near-identical SWC options
 * object inline. They drifted once already (F-01's root cause was partly that the two
 * paths had silently diverged) — this module is the fix: a single pure function neither
 * builder can bypass, so a future option addition/change can only land in one place
 * (RFC-019 D7, task 3.2).
 *
 * @packageDocumentation
 */

import type { BuildOptions } from './types.js';

/**
 * Build the SWC `transform()` options object for one source file.
 *
 * Pure and framework-agnostic — takes only the values needed to decide the transform,
 * not the SWC module itself, so it has no runtime dependency on which `@swc/core`
 * import path (Node's `@swc/core` vs Deno's `npm:@swc/core@…`) the caller used.
 *
 * @param filename - The source file's path (used by SWC for error messages/sourcemap `sources`).
 * @param isTsx - Whether this file is `.tsx` (enables JSX parsing).
 * @param options - The build's resolved options (target/decoratorMetadata/minify/sourcemap).
 */
export function buildSwcTransformOptions(
  filename: string,
  isTsx: boolean,
  options: Pick<BuildOptions, 'target' | 'decoratorMetadata' | 'minify' | 'sourcemap'>
): {
  filename: string;
  jsc: {
    parser: { syntax: 'typescript'; tsx: boolean; decorators: boolean };
    target: BuildOptions['target'];
    transform: { legacyDecorator: boolean; decoratorMetadata: boolean | undefined };
    keepClassNames: boolean;
    minify: { compress: boolean; mangle: boolean } | undefined;
  };
  module: { type: 'es6' };
  sourceMaps: boolean | undefined;
} {
  return {
    filename,
    jsc: {
      parser: {
        syntax: 'typescript',
        tsx: isTsx,
        decorators: true,
      },
      target: options.target,
      transform: {
        legacyDecorator: true,
        decoratorMetadata: options.decoratorMetadata,
      },
      keepClassNames: true,
      minify: options.minify
        ? {
            compress: true,
            mangle: true,
          }
        : undefined,
    },
    module: {
      type: 'es6',
    },
    sourceMaps: options.sourcemap,
  };
}
