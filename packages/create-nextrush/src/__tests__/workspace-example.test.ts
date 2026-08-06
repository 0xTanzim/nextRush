import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resolveWorkspaceDestination } from '../workspace.js';
import { generateProject } from '../generator.js';
import type { ProjectOptions } from '../types.js';
import { seedAllPackageVersions } from './test-helpers.js';

/**
 * Wave 2 verifier backstop (task 4.3 / 4.5 — design decision 6).
 *
 * Workspace mode: detect a supported workspace layout and report the resolved
 * destination (path + package name + policy) before writing; unsupported layouts
 * fail with actionable guidance. Examples: a governed `--example` composes through
 * the same template path and adds task-oriented files + docs.
 *
 * RED against the current code — no workspace or example support exists.
 */
function createOptions(overrides: Partial<ProjectOptions> = {}): ProjectOptions {
  return {
    name: 'ws-app',
    directory: './ws-app',
    style: 'functional',
    runtime: 'node',
    middleware: 'minimal',
    packageManager: 'npm',
    git: false,
    install: false,
    ...overrides,
  };
}

describe('workspace destination policy (task 4.3 / 4.4)', () => {
  let root = '';
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'create-nextrush-ws-'));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('detects a pnpm workspace and reports the resolved apps/<name> destination', () => {
    writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*\n');
    const result = resolveWorkspaceDestination('my-api', root);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.destination).toBe(join(root, 'apps', 'my-api'));
      expect(result.packageName).toBe('my-api');
      expect(result.policy).toContain('pnpm');
    }
  });

  it('fails with actionable guidance for an unsupported layout (no workspace manifest)', () => {
    const result = resolveWorkspaceDestination('my-api', root);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.guidance).toMatch(/workspace|pnpm-workspace/i);
    }
  });
});

describe('governed task-oriented example (task 4.5 / 4.6)', () => {
  it('example files compose through the same template path', () => {
    seedAllPackageVersions('^0.0.0');
    const files = generateProject(createOptions({ example: 'secure-api' }));

    // The example adds a task-oriented secure API route and README section.
    expect(files.has('src/routes/secure.routes.ts')).toBe(true);
    expect(files.get('README.md')!).toContain('secure-api');
  });

  it('the base starter has no example files when no example is selected', () => {
    seedAllPackageVersions('^0.0.0');
    const files = generateProject(createOptions({}));
    expect(files.has('src/routes/secure.routes.ts')).toBe(false);
  });
});
