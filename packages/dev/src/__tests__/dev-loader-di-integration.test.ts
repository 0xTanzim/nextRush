/**
 * @nextrush/dev - Dev-loader DI independence integration test (tasks 4.1 RED / 5.2 GREEN).
 *
 * The requirement: `nextrush dev` serves a decorated, constructor-injected app on the
 * workspace TypeScript 7 with `@swc-node/register` treated as absent. The test proves it
 * in two layers:
 *
 * 1. Loader independence — the resolved production loader (`dist/loaders/swc-loader.mjs`,
 *    the exact `--import` entry `dev` spawns) must not reference `@swc-node/register`.
 *    While the old delegation stands, this fails: the RED state.
 * 2. DI serving — the built CLI's `dev` starts `examples/dev-di-fixture` (type-only
 *    constructor injection, resolvable solely via `design:paramtypes`) and `/di`
 *    returns the injected marker over HTTP.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../..');
const DEV_BIN = resolve(REPO_ROOT, 'packages/dev/bin/nextrush.js');
// `examples/` is gitignored, so this fixture is generated here rather than committed.
// The dependencies come from the tracked dev-cli-fixture's installed workspace links.
const FIXTURE_DIR = resolve(REPO_ROOT, 'examples/dev-di-fixture');
const FIXTURE_NODE_MODULES = resolve(REPO_ROOT, 'examples/dev-cli-fixture/node_modules');

const STARTUP_TIMEOUT_MS = 20_000;
const FIXTURE_PORT = '58081';

const FIXTURE_SOURCE = `import { createApp, createRouter, listen } from 'nextrush';
import { Controller, Get, Service, registerControllers } from 'nextrush/class';

@Service()
class GreeterService {
  greet(): string {
    return 'injected-greeter-marker';
  }
}

@Controller('/di')
class DiController {
  constructor(private readonly greeter: GreeterService) {}

  @Get()
  get(): string {
    return this.greeter.greet();
  }
}

const router = createRouter();
const app = createApp({ router });
await registerControllers(app, { controllers: [DiController] });
listen(app, Number(process.env.PORT ?? 8080));
`;

function writeFixture(): void {
  rmSync(FIXTURE_DIR, { recursive: true, force: true });
  mkdirSync(resolve(FIXTURE_DIR, 'src'), { recursive: true });
  symlinkSync(FIXTURE_NODE_MODULES, resolve(FIXTURE_DIR, 'node_modules'), 'dir');
  writeFileSync(
    resolve(FIXTURE_DIR, 'package.json'),
    JSON.stringify({ name: 'dev-di-fixture', version: '1.0.0', private: true, type: 'module' })
  );
  writeFileSync(resolve(FIXTURE_DIR, 'src/index.ts'), FIXTURE_SOURCE);
}

let child: ChildProcess | undefined;

afterAll(() => {
  rmSync(FIXTURE_DIR, { recursive: true, force: true });
});

afterEach(() => {
  if (child && !child.killed) {
    child.kill('SIGTERM');
  }
  child = undefined;
});

async function waitForHttp(url: string, timeoutMs: number): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.text();
    } catch (e) {
      lastError = e;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server never came up at ${url}: ${String(lastError)}`);
}

describe('nextrush dev — loader independent of @swc-node/register, DI resolves (task 4.1)', () => {
  it('the production loader carries no @swc-node/register reference', () => {
    // The exact `--import` entry `dev` spawns in production (dist, not the
    // src-context fallback `getSwcNodeRegisterPath()` returns under vitest).
    const loaderFile = resolve(REPO_ROOT, 'packages/dev/dist/loaders/swc-loader.mjs');
    expect(existsSync(loaderFile)).toBe(true);
    const source = readFileSync(loaderFile, 'utf-8');
    expect(source).not.toContain('@swc-node/register');
    const hooksFile = resolve(REPO_ROOT, 'packages/dev/dist/loaders/swc-hooks.mjs');
    expect(existsSync(hooksFile)).toBe(true);
  });

  it(
    'serves a type-injected controller over HTTP',
    async () => {
      writeFixture();
      expect(existsSync(DEV_BIN)).toBe(true);
      expect(existsSync(resolve(FIXTURE_DIR, 'src/index.ts'))).toBe(true);

      child = spawn(process.execPath, [DEV_BIN, 'dev', '--port', FIXTURE_PORT], {
        cwd: FIXTURE_DIR,
        env: { ...process.env, PORT: FIXTURE_PORT, NODE_ENV: 'development' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let output = '';
      child.stdout?.on('data', (d) => {
        output += String(d);
      });
      child.stderr?.on('data', (d) => {
        output += String(d);
      });

      const body = await waitForHttp(`http://127.0.0.1:${FIXTURE_PORT}/di`, STARTUP_TIMEOUT_MS);
      expect(body).toContain('injected-greeter-marker');
      expect(output).not.toMatch(/Cannot find package|ERR_MODULE_NOT_FOUND/);
    },
    STARTUP_TIMEOUT_MS + 10_000
  );
});
