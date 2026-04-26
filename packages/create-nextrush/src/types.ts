/** Project style — determines the paradigm of the generated code. */
export type Style = 'functional' | 'class-based' | 'full';

/** Target runtime for the project. */
export type Runtime = 'node' | 'bun' | 'deno';

/** Middleware preset — controls which middleware packages are included. */
export type MiddlewarePreset = 'minimal' | 'api' | 'full';

/** Supported package managers. */
export type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun';

/** Fully resolved project configuration. */
export interface ProjectOptions {
  readonly name: string;
  readonly directory: string;
  readonly style: Style;
  readonly runtime: Runtime;
  readonly middleware: MiddlewarePreset;
  readonly packageManager: PackageManager;
  readonly git: boolean;
  readonly install: boolean;
}

/** Map of relative file paths to their content. */
export type FileMap = Map<string, string>;

/** Parsed CLI arguments before resolution. */
export interface ParsedArgs {
  readonly directory?: string;
  readonly style?: Style;
  readonly runtime?: Runtime;
  readonly middleware?: MiddlewarePreset;
  readonly packageManager?: PackageManager;
  readonly install: boolean;
  readonly git: boolean;
  readonly yes: boolean;
  readonly help: boolean;
  readonly version: boolean;
}

/** Dependency entry for package.json generation. */
export interface DependencySet {
  readonly dependencies: Record<string, string>;
  readonly devDependencies: Record<string, string>;
}
