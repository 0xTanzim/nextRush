import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resolveScaffoldPlan } from '../plan.js';
import { setVersions } from '../version-store.js';

const requiredVersions = {
  nextrush: '^3.1.0',
  '@nextrush/dev': '^1.0.0',
  '@nextrush/types': '^3.1.0',
  '@nextrush/class': '^3.1.0',
  '@nextrush/cors': '^3.1.0',
  '@nextrush/body-parser': '^3.1.0',
  '@nextrush/helmet': '^3.1.0',
  '@nextrush/rate-limit': '^1.0.0',
  '@nextrush/compression': '^3.1.0',
  '@nextrush/request-id': '^1.0.0',
  '@nextrush/adapter-bun': '^1.0.0',
  '@nextrush/adapter-deno': '^1.0.0',
};

describe('scaffold plans', () => {
  let root = '';

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'create-nextrush-plan-'));
    setVersions(requiredVersions);
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('is a pure, complete plan that does not create its target', () => {
    const target = join(root, 'planned-app');
    const plan = resolveScaffoldPlan({
      name: 'planned-app',
      directory: target,
      style: 'functional',
      runtime: 'node',
      middleware: 'minimal',
      packageManager: 'npm',
      git: true,
      install: true,
    });

    expect(plan.targetDir).toBe(target);
    expect(plan.files.has('package.json')).toBe(true);
    expect(plan.verificationUrl).toBe('http://localhost:8080/health');
    expect(existsSync(target)).toBe(false);
  });

  it('uses the /api/health verification URL for the class-based style', () => {
    const plan = resolveScaffoldPlan({
      name: 'class-plan',
      directory: './class-plan',
      style: 'class-based',
      runtime: 'node',
      middleware: 'minimal',
      packageManager: 'npm',
      git: false,
      install: false,
    });
    expect(plan.verificationUrl).toBe('http://localhost:8080/api/health');
  });
});
