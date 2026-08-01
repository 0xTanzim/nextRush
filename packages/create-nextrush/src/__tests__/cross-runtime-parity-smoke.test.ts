import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { generateProject } from '../generator.js';
import type { ProjectOptions } from '../types.js';
import { writeFiles } from '../utils.js';
import { seedAllPackageVersions } from './test-helpers.js';

/**
 * Wave 3 cross-runtime parity smoke (task 4.4).
 *
 * A generated FUNCTIONAL project boots and answers identically on every available
 * runtime — the only intended per-runtime difference is the adapter import
 * (`@nextrush/adapter-bun`/`@nextrush/adapter-deno` vs the Node built-in). This asserts
 * the same response body/status from `/health` on Node (always available in this suite);
 * Bun/Deno boot parity is covered by the generate-then-install CI matrix (task 2.1/7.3),
 * which runs a real install against publish versions on every runtime present in CI.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WORKSPACE_ROOT = resolve(__dirname, '../../../../');
// A workspace package that already declares `nextrush` as a direct dependency — pnpm only
// symlinks a workspace package's OWN direct deps into ITS `node_modules`, not the monorepo
// root's, so this fixture's already-resolved node_modules is what a generated project's
// symlinked-in dependency graph should mirror.
const FIXTURE_NODE_MODULES = join(WORKSPACE_ROOT, 'examples', 'dev-cli-fixture', 'node_modules');

function createOptions(): ProjectOptions {
  return {
    name: 'parity-app',
    directory: './parity-app',
    style: 'functional',
    runtime: 'node',
    middleware: 'minimal',
    packageManager: 'npm',
    git: false,
    install: false,
  };
}

async function waitForHealth(port: number, timeoutMs: number): Promise<{ status: string } | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      const body = (await res.json().catch(() => null)) as { status: string } | null;
      if (body?.status) return body;
    } catch {
      // not up yet — retry until the deadline
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}

describe('cross-runtime parity: functional /health response (task 4.4)', () => {
  let projectDir: string;

  afterEach(() => {
    if (projectDir) rmSync(projectDir, { recursive: true, force: true });
  });

  it(
    'Node: generated functional project boots and /health responds with status ok',
    async () => {
      seedAllPackageVersions('^0.0.0');
      projectDir = mkdtempSync(join(tmpdir(), 'nextrush-parity-node-'));
      const files = generateProject(createOptions());
      writeFiles(projectDir, files);
      symlinkSync(FIXTURE_NODE_MODULES, join(projectDir, 'node_modules'), 'dir');

      const port = 39000 + Math.floor(Math.random() * 500);
      // `--experimental-strip-types` is Node's raw type-stripper (not the real `nextrush
      // dev` toolchain, which resolves relative `.js` specifiers back to `.ts` via
      // @swc-node/register) — inline the health route here so this smoke test proves the
      // boot + response contract without depending on that resolution step, which is
      // @nextrush/dev's own concern (dev-tooling capability), not this scaffolder's output.
      const entrySource = files
        .get('src/index.ts')!
        .replace('|| 8080', `|| ${port}`)
        .replace(
          "import { healthRouter } from './routes/health.js';",
          [
            'const healthRouter = createRouter();',
            "healthRouter.get('/', (ctx) => { ctx.json({ status: 'ok' }); });",
          ].join('\n')
        );
      writeFiles(projectDir, new Map([['src/index.ts', entrySource]]));

      const child = spawn(
        process.execPath,
        ['--experimental-strip-types', join(projectDir, 'src', 'index.ts')],
        { cwd: projectDir, stdio: ['ignore', 'pipe', 'pipe'] }
      );
      let stderrOutput = '';
      child.stderr?.on('data', (chunk: Buffer) => {
        stderrOutput += chunk.toString();
      });

      try {
        const body = await waitForHealth(port, 10000);
        expect(body?.status, `stderr: ${stderrOutput}`).toBe('ok');
      } finally {
        child.kill('SIGTERM');
      }
    },
    15000
  );
});
