/**
 * @nextrush/dev - Minimal Cross-Runtime Global Surfaces (Bun, Deno)
 *
 * TypeScript has no ambient `Bun`/`Deno` globals outside their own respective type
 * packages (not installed here, since this package targets Node.js/Bun/Deno from one
 * build — pulling in either would collide with `@types/node`'s own globals or each
 * other). `globalThis.Bun`/`globalThis.Deno` are therefore genuinely untyped at the
 * source; every access resolves to `any`, which is what the `no-unsafe-*` ESLint rules
 * were correctly flagging (239 errors, most from this exact cause) — `@ts-expect-error`
 * alone silences `tsc`'s missing-property complaint but does nothing for ESLint's
 * separate unsafe-access rules, since the accessed value's TYPE is still `any` either way.
 *
 * These interfaces cover only the exact surface this package's runtime shims actually
 * call (`fs.ts`, `detect.ts`, `spawn.ts`) — not a full port of either runtime's real
 * type declarations. Extend them if a new call site needs another API; never widen
 * speculatively.
 *
 * @packageDocumentation
 */

/** The subset of the `Bun` global this package's runtime detection and spawn shim read. */
export interface BunGlobal {
  readonly version: string;
  spawn(
    cmd: readonly string[],
    options: {
      readonly cwd?: string;
      readonly env?: Readonly<Record<string, string | undefined>>;
      readonly stdio?: readonly ('inherit' | 'pipe' | 'ignore')[];
    }
  ): {
    readonly exited: Promise<number>;
    kill(signal?: number): void;
  };
  build(options: {
    readonly entrypoints: readonly string[];
    readonly outdir: string;
    readonly target: 'bun' | 'node' | 'browser';
    readonly sourcemap: 'external' | 'none' | 'inline';
    readonly minify: boolean;
  }): Promise<{
    readonly success: boolean;
    readonly logs: readonly { readonly message: string }[];
  }>;
}

/**
 * Reads `globalThis.Bun` with a real type instead of `any`. Callers must already have
 * confirmed they are running under Bun (via `detectRuntime() === 'bun'`) — this
 * function does not check; it only types the access.
 */
export function getBunGlobal(): BunGlobal {
  return (globalThis as unknown as { Bun: BunGlobal }).Bun;
}

/** The subset of `Deno.FileInfo` this package inspects. Deno's real type is much larger. */
export interface DenoFileInfo {
  readonly isFile: boolean;
  readonly isDirectory: boolean;
}

/** The subset of the `Deno` global this package's cross-runtime shims call. */
export interface DenoGlobal {
  readonly version: { readonly deno: string };
  readonly args: readonly string[];
  readonly env: { readonly get: (name: string) => string | undefined; readonly toObject: () => Record<string, string> };
  stat(path: string): Promise<DenoFileInfo>;
  statSync(path: string): DenoFileInfo;
  readTextFile(path: string): Promise<string>;
  readTextFileSync(path: string): string;
  writeTextFile(path: string, content: string): Promise<void>;
  mkdir(path: string, options?: { readonly recursive?: boolean }): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  remove(path: string): Promise<void>;
  cwd(): string;
  exit(code: number): never;
  addSignalListener(signal: string, handler: () => void): void;
  Command: new (
    command: string,
    options: {
      readonly args?: readonly string[];
      readonly cwd?: string;
      readonly env?: Readonly<Record<string, string>>;
      readonly stdin?: 'inherit' | 'piped' | 'null';
      readonly stdout?: 'inherit' | 'piped' | 'null';
      readonly stderr?: 'inherit' | 'piped' | 'null';
    }
  ) => {
    spawn(): {
      readonly status: Promise<{ readonly success: boolean; readonly code: number }>;
      kill(signal?: string): void;
    };
  };
}

/**
 * Reads `globalThis.Deno` with a real type instead of `any`. Callers must already have
 * confirmed they are running under Deno (via `detectRuntime() === 'deno'`) — this
 * function does not check; it only types the access.
 */
export function getDenoGlobal(): DenoGlobal {
  return (globalThis as unknown as { Deno: DenoGlobal }).Deno;
}
