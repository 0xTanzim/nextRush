/** Generates tsconfig.json content for a new project. */
export function generateTsconfig(needsDecorators: boolean): string {
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
      // scaffolded app would lose `process` et al. even though `@types/node` is a
      // generated devDependency. Pin it explicitly (issue #40).
      types: ['node'],
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
