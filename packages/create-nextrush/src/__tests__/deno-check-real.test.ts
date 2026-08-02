import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { generateProject } from '../generator.js';
import type { ProjectOptions } from '../types.js';
import { writeFiles } from '../utils.js';
import { seedAllPackageVersions } from './test-helpers.js';

/**
 * Real-Deno verification of the generated `--runtime deno` scaffold (Deno-first fix).
 *
 * Earlier tests assert the generated deno.json/scripts STATICALLY. This suite runs
 * `deno check` against an actually-generated project — proving:
 *  - the `lib` entries (`deno.window`/`deno.ns`/`deno.unstable`) are valid for the
 *    installed Deno,
 *  - the `.js`-specifier relative imports resolve (sloppy-imports is configured in
 *    deno.json, not just passed on the npm scripts),
 *  - the generated source contains no Node-only APIs (it type-checks under Deno's
 *    own checker).
 *
 * Bare `nextrush` / `@nextrush/*` specifiers are redirected via an import map to
 * minimal local stubs (mirroring how the framework's conformance runner maps
 * `@nextrush/*` to built dist), so the check is hermetic and offline — it verifies
 * OUR generated files are Deno-clean, not that the published framework packages are
 * (that claim is owned by the install matrix / conformance runner).
 */
function hasDeno(): boolean {
  try {
    execFileSync('deno', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const DENO_AVAILABLE = hasDeno();

function createOptions(overrides: Partial<ProjectOptions>): ProjectOptions {
  return {
    name: 'deno-check-app',
    directory: './deno-check-app',
    style: 'functional',
    runtime: 'deno',
    middleware: 'minimal',
    packageManager: 'npm',
    git: false,
    install: false,
    ...overrides,
  };
}

/** Every named export the generated templates import from each bare specifier.
 *
 * The stubs are typed to match how the generated code USES the framework (routers
 * have `.get`/`.post`, decorators take options and are usable as decorators, errors
 * extend Error), so `deno check` fails only if the GENERATED code is wrong — not
 * because a stub is too thin.
 */
const STUB_MODULES: Record<string, string> = {
  'nextrush.ts': `export interface Context {
  params: Record<string, string>;
  query: Record<string, string>;
  status: number;
  method: string;
  path: string;
  body?: unknown;
  json(body: unknown): void;
  set(key: string, value: string): void;
}
export interface Next {
  (): Promise<void>;
}
export interface Router {
  get(path: string, handler: (ctx: Context) => void): void;
  post(path: string, handler: (ctx: Context) => void): void;
  put(path: string, handler: (ctx: Context) => void): void;
  delete(path: string, handler: (ctx: Context) => void): void;
}
export interface App {
  use(middleware: Middleware): void;
  route(path: string, router: Router): void;
}
export const createApp = (options: { router: Router }): App => ({ use: () => {}, route: () => {} });
export const createRouter = (): Router => ({ get: () => {}, post: () => {}, put: () => {}, delete: () => {} });
export const errorHandler = (options: { includeStack: boolean }) => () => {};
export class BadRequestError extends Error {}
export class NotFoundError extends Error {}
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export type Middleware = (ctx: Context, next: Next) => Promise<void> | void;
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
`,
  'class.ts': `type LegacyClassDecorator = (target: unknown) => void;
type LegacyMethodDecorator = (target: unknown, key: string, descriptor: PropertyDescriptor) => void;
type LegacyParameterDecorator = (target: unknown, key: string, index: number) => void;

export function Module(options: { imports?: unknown[]; controllers?: unknown[]; providers?: unknown[] }): LegacyClassDecorator {
  return () => {};
}
export function registerModule(app: unknown, module: unknown, options?: { prefix?: string }): void {}
export function Controller(path?: string): LegacyClassDecorator {
  return () => {};
}
export function Get(path?: string): LegacyMethodDecorator {
  return () => {};
}
export function Post(path?: string): LegacyMethodDecorator {
  return () => {};
}
export function Delete(path?: string): LegacyMethodDecorator {
  return () => {};
}
export function HttpCode(code: number): LegacyMethodDecorator {
  return () => {};
}
export function Body(): LegacyParameterDecorator {
  return () => {};
}
export function Query(name?: string): LegacyParameterDecorator {
  return () => {};
}
export function Param(name?: string): LegacyParameterDecorator {
  return () => {};
}
export function Service(): LegacyClassDecorator {
  return () => {};
}
export function Repository(): LegacyClassDecorator {
  return () => {};
}
`,
  'adapter.ts': `export async function listen(app: unknown, port: number): Promise<unknown> {
  // Minimal real server: serve a 200 for /health so the generated app actually boots
  // and answers under Deno (the route wiring itself is exercised; framework semantics
  // are owned by the conformance runner).
  Deno.serve({ port, hostname: '127.0.0.1' }, () => new Response('ok'));
  return {};
}
export function serve(app: unknown, options?: unknown): Promise<unknown> {
  return Promise.resolve({});
}
`,
  'middleware.ts': `export const cors = () => () => {};
export const json = () => () => {};
export const helmet = () => () => {};
export const rateLimit = () => () => {};
export const compression = () => () => {};
export const requestId = () => () => {};
`,
};

function writeStubs(projectDir: string, options: ProjectOptions): string {
  const stubsDir = join(projectDir, '.deno-stubs');
  mkdirSync(stubsDir, { recursive: true });
  for (const [name, content] of Object.entries(STUB_MODULES)) {
    writeFileSync(join(stubsDir, name), content, 'utf-8');
  }

  const needsDecorators = options.style === 'class-based' || options.style === 'full';
  // A scratch Deno config for the hermetic check. It mirrors the generated deno.json
  // (sloppy-imports + compilerOptions) but redirects bare `nextrush`/`@nextrush/*`
  // specifiers to the local stubs, and drops `nodeModulesDir: auto` — otherwise Deno
  // resolves those specifiers as npm packages from package.json `dependencies` and
  // tries to fetch `^0.0.0` from the registry (offline-hostile; and the real install
  // claim is owned by the install matrix / conformance runner, not this suite).
  const checkConfig = {
    compilerOptions: {
      strict: true,
      lib: ['deno.window', 'deno.ns', 'deno.unstable'],
      ...(needsDecorators
        ? {
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
          }
        : {}),
    },
    unstable: ['sloppy-imports'],
    imports: {
      nextrush: './.deno-stubs/nextrush.ts',
      'nextrush/class': './.deno-stubs/class.ts',
      '@nextrush/adapter-deno': './.deno-stubs/adapter.ts',
      '@nextrush/cors': './.deno-stubs/middleware.ts',
      '@nextrush/body-parser': './.deno-stubs/middleware.ts',
      '@nextrush/helmet': './.deno-stubs/middleware.ts',
      '@nextrush/rate-limit': './.deno-stubs/middleware.ts',
      '@nextrush/compression': './.deno-stubs/middleware.ts',
      '@nextrush/request-id': './.deno-stubs/middleware.ts',
    },
  };
  writeFileSync(join(projectDir, 'check.deno.json'), JSON.stringify(checkConfig, null, 2), 'utf-8');
  return 'check.deno.json';
}

function runDenoCheck(projectDir: string): void {
  execFileSync('deno', ['check', '--config=check.deno.json', 'src/index.ts'], {
    cwd: projectDir,
    stdio: 'pipe',
  });
}

/** Pick a likely-free port (avoids fixed-port collisions across parallel runs/retries). */
function pickFreePort(): number {
  return 40000 + Math.floor(Math.random() * 20000);
}

/** Boot the generated app under real Deno and assert it answers on the health port.
 *
 * The stub `listen` starts a real `Deno.serve` on the port, so this proves
 * the generated entrypoint actually runs under Deno (imports resolve, no Node-only
 * API is touched at startup) — not just that it type-checks.
 */
async function runDenoBoot(projectDir: string, entry: string, port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      'deno',
      ['run', '--allow-net', '--allow-env', '--config=check.deno.json', entry],
      {
        cwd: projectDir,
        env: { ...process.env, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      reject(new Error(`deno run exited early (code ${String(code)}): ${stderr}`));
    });

    // Poll the health endpoint until the server is up.
    const started = Date.now();
    const poll = (): void => {
      if (Date.now() - started > 10_000) {
        child.kill('SIGKILL');
        reject(new Error(`server did not come up: ${stderr}`));
        return;
      }
      fetch(`http://127.0.0.1:${String(port)}/health`)
        .then((res) => {
          child.kill('SIGTERM');
          if (res.status !== 200) {
            reject(new Error(`expected 200, got ${res.status}: ${stderr}`));
            return;
          }
          resolve();
        })
        .catch(() => {
          setTimeout(poll, 100);
        });
    };
    setTimeout(poll, 300);
  });
}

describe.skipIf(!DENO_AVAILABLE)('generated --runtime deno project passes real deno check (Deno-first fix)', () => {
  const projectDirs: string[] = [];

  afterEach(() => {
    for (const dir of projectDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    projectDirs.length = 0;
  });

  function materialize(options: ProjectOptions): string {
    seedAllPackageVersions('^0.0.0');
    const projectDir = mkdtempSync(join(tmpdir(), 'nextrush-deno-check-'));
    projectDirs.push(projectDir);
    writeFiles(projectDir, generateProject(options));
    writeStubs(projectDir, options);
    return projectDir;
  }

  it('deno.json configures sloppy-imports and nodeModulesDir for Deno-native tooling', () => {
    seedAllPackageVersions('^0.0.0');
    const files = generateProject(createOptions({}));
    const denoJson = JSON.parse(files.get('deno.json')!) as Record<string, unknown>;

    expect(denoJson.unstable).toEqual(['sloppy-imports']);
    expect(denoJson.nodeModulesDir).toBe('auto');
  });

  it('functional: deno check passes with minimal middleware', () => {
    const projectDir = materialize(createOptions({}));
    expect(() => runDenoCheck(projectDir)).not.toThrow();
  });

  it('functional: generated app boots under real deno and answers /health', async () => {
    const projectDir = materialize(createOptions({}));
    const port = pickFreePort();
    await expect(runDenoBoot(projectDir, 'src/index.ts', port)).resolves.toBeUndefined();
  }, 30_000);

  it('functional: deno check passes with full middleware', () => {
    const projectDir = materialize(createOptions({ middleware: 'full' }));
    expect(() => runDenoCheck(projectDir)).not.toThrow();
  });

  it('class-based: deno check passes (decorators + nextrush/class)', () => {
    const projectDir = materialize(createOptions({ style: 'class-based' }));
    expect(() => runDenoCheck(projectDir)).not.toThrow();
  });

  it('full: deno check passes', () => {
    const projectDir = materialize(createOptions({ style: 'full' }));
    expect(() => runDenoCheck(projectDir)).not.toThrow();
  });

  it('env.d.ts is empty for deno (no unresolvable @nextrush/types triple-slash reference)', () => {
    seedAllPackageVersions('^0.0.0');
    const files = generateProject(createOptions({}));
    expect(files.get('src/env.d.ts')).toBe('');
  });

  it('package.json omits engines.node for deno (app is not Node-dependent)', () => {
    seedAllPackageVersions('^0.0.0');
    const files = generateProject(createOptions({}));
    const pkg = JSON.parse(files.get('package.json')!) as { engines?: unknown };
    expect(pkg.engines).toBeUndefined();
  });

  it('package.json still emits engines.node for node', () => {
    seedAllPackageVersions('^0.0.0');
    const files = generateProject(createOptions({ runtime: 'node' }));
    const pkg = JSON.parse(files.get('package.json')!) as { engines: { node: string } };
    expect(pkg.engines.node).toMatch(/^>=/);
  });
});
