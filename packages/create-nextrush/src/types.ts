/** Project style — determines the paradigm of the generated code. */
export type Style = 'functional' | 'class-based' | 'full';

/** Target runtime for the project. */
export type Runtime = 'node' | 'bun' | 'deno';

/** Middleware preset — controls which middleware packages are included. */
export type MiddlewarePreset = 'minimal' | 'api' | 'full';

/** Supported package managers. */
export type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun';

/** Opt-in production-service preset (design decision 6). */
export type Preset = 'production';

/** Task-oriented example offered by the CLI (design decision 6). */
export type Example = 'secure-api';

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
  /** When set, adds the production-service preset files to the generated output. */
  readonly preset?: Preset;
  /** When set, scaffolds the governed task-oriented example. */
  readonly example?: Example;
  /** When set, the project is placed in a detected pnpm workspace (apps/<name>). */
  readonly workspace?: boolean;
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
  /** True when `--install`/`-i`/`--no-install` was explicitly passed (vs. left at its default). */
  readonly installExplicit: boolean;
  readonly git: boolean;
  /** True when `--git`/`--no-git` was explicitly passed (vs. left at its default). */
  readonly gitExplicit: boolean;
  readonly yes: boolean;
  readonly help: boolean;
  readonly version: boolean;
  /** Emit a single schema-versioned JSON document instead of terminal UI. */
  readonly json: boolean;
  /** Validate and render the scaffold plan without writing or running commands. */
  readonly dryRun: boolean;
  /** Permit replacing generated file paths in an existing target. */
  readonly overwrite: boolean;
  /** Skip registry probes and use the embedded per-package fallback version map. */
  readonly offline: boolean;
  /** Skip the local runtime-binary preflight (remote/container targets). */
  readonly skipRuntimeCheck: boolean;
  /** Emit the opt-in production-service preset files. */
  readonly preset?: Preset;
  /** Scaffold the governed task-oriented example. */
  readonly example?: Example;
  /** Place the project in a detected pnpm workspace (apps/<name>). */
  readonly workspace?: boolean;
}

/** Stable machine-facing representation of an input validation failure. */
export interface CliErrorPayload {
  readonly code: string;
  readonly message: string;
  readonly remediation: string;
}

/** Dependency entry for package.json generation. */
export interface DependencySet {
  readonly dependencies: Record<string, string>;
  readonly devDependencies: Record<string, string>;
}
