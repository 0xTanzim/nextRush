/**
 * @nextrush/dev - `swc-builder.ts` in-process integration tests
 *
 * Calls `buildWithSwc` directly (same vitest process) against the real
 * `examples/dev-cli-fixture` fixture — real SWC transform, real fs writes, real cache file,
 * real `tsc` subprocess for `.d.ts`. No mocking: SWC/fs/tsc are exactly the things under
 * test, not external boundaries to fake (tdd-workflow.md). `build-e2e-integration.test.ts`
 * already proves the shipped CLI binary works, but it spawns a separate process, so v8
 * coverage never credits `swc-builder.ts` for it (the 7.1 gap this test closes).
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as runtime from '../runtime/index.js';
import { initFsSync } from '../runtime/index.js';
import { buildWithSwc } from '../commands/build/swc-builder.js';
import { generateDeclarations } from '../commands/build/declaration-builder.js';
import { findTypeScriptFiles } from '../commands/build/file-scanner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../..');
const FIXTURE_DIR = resolve(REPO_ROOT, 'examples/dev-cli-fixture');
const FIXTURE_ENTRY = 'src/index.ts';

describe('buildWithSwc (in-process, real fixture)', () => {
  let outDir: string;

  beforeEach(async () => {
    outDir = mkdtempSync(join(tmpdir(), 'nextrush-swc-out-'));
    // `resolvePath`'s fast path requires `initFsSync()` to have cached `node:path` — without
    // it, `resolvePath` falls back to a manual join that reads its OWN internal `getCwd()`
    // call (a same-module self-call `vi.spyOn` cannot intercept), silently ignoring the
    // mock below and doubling the path. `dev()`/the real CLI always call this first.
    await initFsSync();
    // `process.chdir` is unavailable under vitest's worker-thread pool, so the fixture
    // cwd is injected via `getCwd()` instead (same pattern as build-decorator-preflight.test.ts).
    vi.spyOn(runtime, 'getCwd').mockReturnValue(FIXTURE_DIR);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(outDir, { recursive: true, force: true });
    rmSync(join(FIXTURE_DIR, 'node_modules', '.cache', 'nextrush'), {
      recursive: true,
      force: true,
    });
  });

  it('transforms the fixture entry to JS with a sourcemap, no cache, no dts', async () => {
    await buildWithSwc(FIXTURE_ENTRY, outDir, {
      cache: false,
      dts: false,
      sourcemap: true,
    });

    const outFile = join(outDir, 'index.js');
    expect(existsSync(outFile)).toBe(true);
    const content = readFileSync(outFile, 'utf-8');
    expect(content.length).toBeGreaterThan(0);
    expect(existsSync(`${outFile}.map`)).toBe(true);
    // Never emits an untransformed .ts copy in the output dir.
    expect(existsSync(join(outDir, 'index.ts'))).toBe(false);
  });

  it('reuses the cache on a second build with unchanged source (cache hit)', async () => {
    await buildWithSwc(FIXTURE_ENTRY, outDir, { cache: true, dts: false });
    const firstOutput = readFileSync(join(outDir, 'index.js'), 'utf-8');

    // Second build against the same unmodified source should hit the cache and still
    // produce a correct, identical output file.
    await buildWithSwc(FIXTURE_ENTRY, outDir, { cache: true, dts: false });
    const secondOutput = readFileSync(join(outDir, 'index.js'), 'utf-8');

    expect(secondOutput).toBe(firstOutput);
  });

  it('reports the file as cached/skipped on the second of two consecutive builds (task 3.3, F-02)', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await buildWithSwc(FIXTURE_ENTRY, outDir, { cache: true, dts: false });
    await buildWithSwc(FIXTURE_ENTRY, outDir, { cache: true, dts: false });

    // The success() log line reads "Built N file(s) (M cached) to ..." once any file was
    // skipped via the cache — the literal, user-visible proof that F-02's cache actually
    // survived between the two builds (not just that outputs happen to match).
    const allLogLines = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(allLogLines).toMatch(/\(\d+ cached\)/);

    logSpy.mockRestore();
  });

  it('emits .d.ts beside its .js for a nested source file (task 3.5, D6 --rootDir parity)', async () => {
    // Add a nested source file alongside the fixture's top-level entry so this build
    // exercises path parity for a subdirectory, not just the flat entry file.
    const fs = await import('node:fs');
    const nestedDir = join(FIXTURE_DIR, 'src', 'nested-3-5');
    fs.mkdirSync(nestedDir, { recursive: true });
    fs.writeFileSync(join(nestedDir, 'util.ts'), 'export const nestedValue = 42;\n');

    try {
      await buildWithSwc(FIXTURE_ENTRY, outDir, { cache: false, dts: true });

      const nestedJs = join(outDir, 'nested-3-5', 'util.js');
      const nestedDts = join(outDir, 'nested-3-5', 'util.d.ts');
      expect(existsSync(nestedJs)).toBe(true);
      expect(existsSync(nestedDts)).toBe(true);
      expect(readFileSync(nestedDts, 'utf-8')).toContain('nestedValue');
    } finally {
      fs.rmSync(nestedDir, { recursive: true, force: true });
    }
  }, 30_000);

  it(
    'generates a .d.ts declaration file with dts enabled (real tsc subprocess)',
    async () => {
      await buildWithSwc(FIXTURE_ENTRY, outDir, { cache: false, dts: true });

      const dtsFile = join(outDir, 'index.d.ts');
      expect(existsSync(dtsFile)).toBe(true);
      const dtsContent = readFileSync(dtsFile, 'utf-8');
      expect(dtsContent).toContain('HealthStatus');
    },
    30_000
  );

  it('respects decoratorMetadata: false without skipping dts generation (F-03)', async () => {
    await buildWithSwc(FIXTURE_ENTRY, outDir, {
      cache: false,
      dts: true,
      decoratorMetadata: false,
    });

    expect(existsSync(join(outDir, 'index.js'))).toBe(true);
    expect(existsSync(join(outDir, 'index.d.ts'))).toBe(true);
  }, 30_000);

  it('never emits .d.ts for test/spec files (declaration pass matches SWC exclusion)', async () => {
    // The issue-2 repro: a test file under the source root must not leak a declaration
    // into the build output. SWC already skips it; the bare-tsc declaration pass used to
    // compile it anyway and emit an empty `export {}` module.
    const fs = await import('node:fs');
    const testsDir = join(FIXTURE_DIR, 'src', 'routes', '__tests__');
    const testFile = join(testsDir, 'health-status.test.ts');
    fs.mkdirSync(testsDir, { recursive: true });
    fs.writeFileSync(testFile, "import { describe, expect, it } from 'vitest';\n\ndescribe('health-status', () => {\n  it('works', () => {\n    expect(1).toBe(1);\n  });\n});\n");

    try {
      await buildWithSwc(FIXTURE_ENTRY, outDir, { cache: false, dts: true });

      expect(existsSync(join(outDir, 'index.d.ts'))).toBe(true);
      expect(existsSync(join(outDir, 'routes', '__tests__', 'health-status.test.d.ts'))).toBe(false);
      expect(existsSync(join(outDir, 'routes', '__tests__', 'health-status.test.js'))).toBe(false);
    } finally {
      fs.rmSync(join(FIXTURE_DIR, 'src', 'routes'), { recursive: true, force: true });
    }
  }, 30_000);
});

describe('generateDeclarations (in-process, real tsc)', () => {
  let outDir: string;

  beforeEach(() => {
    outDir = mkdtempSync(join(tmpdir(), 'nextrush-dts-out-'));
  });

  afterEach(() => {
    rmSync(outDir, { recursive: true, force: true });
  });

  it(
    'emits .d.ts mirroring the source directory layout via --rootDir',
    async () => {
      const srcDir = join(FIXTURE_DIR, 'src');
      // Same test-filtered source set the SWC transform feeds in — generateDeclarations
      // no longer globs the tree itself (issue2: test files must not leak as .d.ts).
      const files = await findTypeScriptFiles(FIXTURE_DIR, FIXTURE_ENTRY);
      await generateDeclarations(FIXTURE_DIR, outDir, srcDir, files);

      expect(existsSync(join(outDir, 'index.d.ts'))).toBe(true);
    },
    30_000
  );
});
