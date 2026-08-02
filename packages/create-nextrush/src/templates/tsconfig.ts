import type { ProjectOptions } from '../types.js';

/** Generates tsconfig.json content for a new project. */
export function generateTsconfig(options: ProjectOptions): string {
  const needsDecorators = options.style === 'class-based' || options.style === 'full';
  // Deno ships its own global types (configured in deno.json) — forcing `types: ['node']`
  // would inject Node's `process`/`Buffer` globals into a Deno project and exclude Deno's.
  // capability-exempt: scaffolding tool emits runtime-specific project files from user choice,
  // not the executing runtime. `options.runtime` is a scaffold-time decision.
  const isDeno = options.runtime === 'deno';

  const config: Record<string, unknown> = {
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      // Guards required by a per-file transpiler (SWC has no cross-file type view — see
      // report/scaffolding/scaffolding-cli-review.md F-06). Both `nextrush dev`
      // (@swc-node/register) and `nextrush build` (SWC) transpile file-by-file, so a
      // type-only re-export written without `export type` compiles clean under `tsc` but
      // mistranspiles under SWC. `isolatedModules` catches that class of mistake at
      // type-check time, matching the framework's own standard (typescript.instructions.md).
      isolatedModules: true,
      verbatimModuleSyntax: true,
      // TS >= 6 no longer auto-includes `@types/*` when `types` is omitted, so a
      // Node/Bun scaffolded app would lose `process` et al. even though `@types/node` is a
      // generated devDependency. Pin it explicitly (issue #40). Deno omits it.
      ...(isDeno ? {} : { types: ['node'] }),
      sourceMap: true,
      outDir: './dist',
      rootDir: './src',
      // A generated app is `private: true` and never publishes types — library-shaped
      // declaration output is wasted build work for it (fixes F-17).
      declaration: false,
      declarationMap: false,
      ...(needsDecorators
        ? {
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
          }
        : {}),
    },
    include: ['src'],
    exclude: ['dist', 'node_modules'],
  };

  return JSON.stringify(config, null, 2) + '\n';
}

/** Generates a Deno-native `deno.json` for `deno` runtime projects.
 *
 * Deno reads this config for its own type-checking and editor integration. The `lib`
 * entries expose Deno's global types (`Deno`, `Deno.env`, ...) without any Node
 * typings, so a Deno project is genuinely Deno-first rather than a Node clone.
 */
export function generateDenoJson(options: ProjectOptions): string {
  const needsDecorators = options.style === 'class-based' || options.style === 'full';
  const compilerOptions: Record<string, unknown> = {
    strict: true,
    isolatedModules: true,
    verbatimModuleSyntax: true,
    lib: ['deno.window', 'deno.ns', 'deno.unstable'],
    ...(needsDecorators
      ? {
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
        }
      : {}),
  };
  const config: Record<string, unknown> = { compilerOptions };
  return JSON.stringify(config, null, 2) + '\n';
}

