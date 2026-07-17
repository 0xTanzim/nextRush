/**
 * @nextrush/dev - Workspace-aware build scan boundary tests (T044)
 *
 * `findTypeScriptFiles` must constrain its recursive scan to the boundary of the
 * package being built: resolve the scan root to the nearest enclosing `package.json`
 * directory, exclude any nested subdirectory that carries its own `package.json`, and
 * never ascend above the resolved boundary. See
 * `openspec/changes/dev-cli-deno-perms-and-build-scoping/specs/dev-workspace-build-scoping/spec.md`.
 *
 * Uses real temporary directories (a true external boundary — the filesystem) rather
 * than mocking `fs`, per the project's "prefer real objects" testing standard.
 *
 * @packageDocumentation
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { findTypeScriptFiles } from '../commands/build/file-scanner.js';
import { initFsSync } from '../runtime/index.js';

let root: string;

function writeFile(relPath: string, content = '// fixture\n'): void {
  const fullPath = join(root, relPath);
  mkdirSync(join(fullPath, '..'), { recursive: true });
  writeFileSync(fullPath, content);
}

function writePackageJson(relDir: string, name: string): void {
  writeFile(join(relDir, 'package.json'), JSON.stringify({ name }));
}

beforeAll(async () => {
  // findTypeScriptFiles's path resolution requires sync fs init in Node ESM — mirrors
  // the real call order in commands/build.ts, which calls initFsSync() before build().
  await initFsSync();
});

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'nextrush-build-scan-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('findTypeScriptFiles — workspace package boundary (T044)', () => {
  it('scans only the current package when the entry sits at the package root, with a sibling package one level up', async () => {
    // workspace/
    //   pkg-a/ (package.json, index.ts)      <- building this one, entry at package root
    //   pkg-b/ (package.json, other.ts)      <- sibling, must be excluded
    writePackageJson('workspace/pkg-a', 'pkg-a');
    writeFile('workspace/pkg-a/index.ts');
    writePackageJson('workspace/pkg-b', 'pkg-b');
    writeFile('workspace/pkg-b/other.ts');

    const cwd = join(root, 'workspace/pkg-a');
    const files = await findTypeScriptFiles(cwd, 'index.ts');
    const paths = files.map((f) => f.path);

    expect(paths.some((p) => p.endsWith('index.ts') && p.includes('pkg-a'))).toBe(true);
    expect(paths.some((p) => p.includes('pkg-b'))).toBe(false);
  });

  it('excludes a nested subdirectory (inside the scanned tree) that has its own package.json', async () => {
    // pkg-a/ (package.json, src/index.ts, src/vendor/ (own package.json, file.ts))
    writePackageJson('pkg-a', 'pkg-a');
    writeFile('pkg-a/src/index.ts');
    writePackageJson('pkg-a/src/vendor', 'vendored-thing');
    writeFile('pkg-a/src/vendor/file.ts');

    const cwd = join(root, 'pkg-a');
    const files = await findTypeScriptFiles(cwd, 'src/index.ts');
    const paths = files.map((f) => f.path);

    expect(paths.some((p) => p.endsWith(join('src', 'index.ts')))).toBe(true);
    expect(paths.some((p) => p.includes('vendor'))).toBe(false);
  });

  it('scans the whole project for a single-package (non-workspace) layout, unaffected', async () => {
    writePackageJson('solo-app', 'solo-app');
    writeFile('solo-app/src/index.ts');
    writeFile('solo-app/src/util.ts');

    const cwd = join(root, 'solo-app');
    const files = await findTypeScriptFiles(cwd, 'src/index.ts');
    const paths = files.map((f) => f.path);

    expect(paths.some((p) => p.endsWith(join('src', 'index.ts')))).toBe(true);
    expect(paths.some((p) => p.endsWith(join('src', 'util.ts')))).toBe(true);
  });

  it('falls back to the prior cwd-rooted scan when no enclosing package.json is found', async () => {
    // No package.json anywhere under root — boundary detection can't resolve one.
    writeFile('no-pkg-json/src/index.ts');
    writeFile('no-pkg-json/src/util.ts');

    const cwd = join(root, 'no-pkg-json');
    const files = await findTypeScriptFiles(cwd, 'src/index.ts');
    const paths = files.map((f) => f.path);

    // Fallback behavior: identical to pre-change scan (scans from entry's directory
    // downward), so both files under src/ are found.
    expect(paths.some((p) => p.endsWith(join('src', 'index.ts')))).toBe(true);
    expect(paths.some((p) => p.endsWith(join('src', 'util.ts')))).toBe(true);
  });

  it('never ascends above the resolved package boundary even when entry is nested deep', async () => {
    writePackageJson('pkg-c', 'pkg-c');
    writeFile('pkg-c/src/deep/nested/index.ts');
    // A sibling of pkg-c must never be reachable via boundary resolution.
    writePackageJson('pkg-d', 'pkg-d');
    writeFile('pkg-d/src/leak.ts');

    const cwd = join(root, 'pkg-c');
    const files = await findTypeScriptFiles(cwd, 'src/deep/nested/index.ts');
    const paths = files.map((f) => f.path);

    expect(paths.some((p) => p.includes('pkg-d'))).toBe(false);
    expect(paths.some((p) => p.endsWith(join('deep', 'nested', 'index.ts')))).toBe(true);
  });

  it('resolves the scan root to the package.json directory, not just the entry directory — a root-level .ts file is included', async () => {
    // This is the test that actually distinguishes "scan root ascends to the package
    // boundary" from "scan root stays at dirname(entry)": a .ts file living at the
    // package root (a sibling of src/, not inside it) is only found if the scan root
    // genuinely moved up to resolve the package.json boundary.
    writePackageJson('pkg-e', 'pkg-e');
    writeFile('pkg-e/src/index.ts');
    writeFile('pkg-e/root-level.ts'); // sibling of src/, at the package.json's own level

    const cwd = join(root, 'pkg-e');
    const files = await findTypeScriptFiles(cwd, 'src/index.ts');
    const paths = files.map((f) => f.path);

    expect(paths.some((p) => p.endsWith(join('src', 'index.ts')))).toBe(true);
    expect(paths.some((p) => p.endsWith('root-level.ts'))).toBe(true);
  });
});
