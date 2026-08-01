import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { generateProject } from '../generator.js';
import type { ProjectOptions, Style } from '../types.js';
import { writeFiles } from '../utils.js';
import { seedAllPackageVersions } from './test-helpers.js';

/**
 * Wave 5 conventions (task 6.2 — F-16).
 *
 * Asserts every generated project ships a `test` script AND at least one example test that
 * PASSES against the generated code — proving the framework's own test-first constitution
 * (AGENTS.md §14 / `tdd-workflow.md`) is modeled in what it hands new developers, not just
 * documented.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WORKSPACE_ROOT = resolve(__dirname, '../../../../');
const FIXTURE_NODE_MODULES = join(WORKSPACE_ROOT, 'examples', 'dev-cli-fixture', 'node_modules');
const CREATE_NEXTRUSH_NODE_MODULES = join(WORKSPACE_ROOT, 'packages', 'create-nextrush', 'node_modules');

/** Links every entry from BOTH source node_modules dirs into `targetNodeModules` (fixture
 * has `nextrush`/`@nextrush/class`; create-nextrush has `vitest`) — a generated project
 * needs the union to run its example test. */
function linkCombinedNodeModules(targetNodeModules: string): void {
  mkdirSync(targetNodeModules, { recursive: true });
  for (const source of [FIXTURE_NODE_MODULES, CREATE_NEXTRUSH_NODE_MODULES]) {
    for (const entry of readdirSync(source)) {
      const linkPath = join(targetNodeModules, entry);
      try {
        symlinkSync(join(source, entry), linkPath, 'dir');
      } catch {
        // already linked from the other source — first writer wins, which is fine since
        // the two sources don't conflict on the packages this test actually needs.
      }
    }
  }
}

function createOptions(overrides: Partial<ProjectOptions>): ProjectOptions {
  return {
    name: 'test-scaffolding-app',
    directory: './test-scaffolding-app',
    style: 'functional',
    runtime: 'node',
    middleware: 'minimal',
    packageManager: 'npm',
    git: false,
    install: false,
    ...overrides,
  };
}

const STYLES: readonly Style[] = ['functional', 'class-based', 'full'];

describe('generated project ships a test script and a passing example test (task 6.2)', () => {
  let projectDir: string;

  afterEach(() => {
    if (projectDir) rmSync(projectDir, { recursive: true, force: true });
  });

  for (const style of STYLES) {
    it(`${style}: package.json has a test script and at least one __tests__ file`, () => {
      seedAllPackageVersions('^0.0.0');
      const files = generateProject(createOptions({ style }));
      const pkg = JSON.parse(files.get('package.json')!) as { scripts: Record<string, string> };

      expect(pkg.scripts.test).toBeDefined();
      const testFiles = [...files.keys()].filter((p) => p.includes('__tests__'));
      expect(testFiles.length).toBeGreaterThan(0);
    });

    it(
      `${style}: the generated example test actually passes under vitest`,
      () => {
        seedAllPackageVersions('^0.0.0');
        projectDir = mkdtempSync(join(tmpdir(), `nextrush-example-test-${style}-`));
        const files = generateProject(createOptions({ style }));
        writeFiles(projectDir, files);
        linkCombinedNodeModules(join(projectDir, 'node_modules'));

        const output = execFileSync('npx', ['vitest', 'run', '--dir', '.'], {
          cwd: projectDir,
          stdio: ['ignore', 'pipe', 'pipe'],
        }).toString();

        expect(output).toMatch(/passed|Tests\s+\d+\s+passed/i);
        expect(output).not.toMatch(/\bfailed\b/i);
      },
      20000
    );
  }
});
