import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { generateProject } from '../generator.js';
import type { ProjectOptions } from '../types.js';
import { writeFiles } from '../utils.js';

function createOptions(overrides: Partial<ProjectOptions> = {}): ProjectOptions {
  return {
    name: 'integration-test',
    directory: './integration-test',
    style: 'functional',
    runtime: 'node',
    middleware: 'api',
    packageManager: 'pnpm',
    git: true,
    install: false,
    ...overrides,
  };
}

describe('integration: file writing', () => {
  const tmpBase = join(import.meta.dirname, '../../.test-tmp');
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpBase, `test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpBase, { recursive: true, force: true });
  });

  it('writes all generated files to disk', () => {
    const options = createOptions({ style: 'functional', middleware: 'minimal' });
    const files = generateProject(options);

    writeFiles(testDir, files);

    expect(existsSync(join(testDir, 'tsconfig.json'))).toBe(true);
    expect(existsSync(join(testDir, 'package.json'))).toBe(true);
    expect(existsSync(join(testDir, 'README.md'))).toBe(true);
    expect(existsSync(join(testDir, '.gitignore'))).toBe(true);
    expect(existsSync(join(testDir, 'src/index.ts'))).toBe(true);
    expect(existsSync(join(testDir, 'src/routes/health.ts'))).toBe(true);
    expect(existsSync(join(testDir, 'src/env.d.ts'))).toBe(true);
  });

  it('writes valid JSON for package.json', () => {
    const options = createOptions();
    const files = generateProject(options);

    writeFiles(testDir, files);

    const content = readFileSync(join(testDir, 'package.json'), 'utf-8');
    const pkg = JSON.parse(content);
    expect(pkg.name).toBe('integration-test');
    expect(pkg.type).toBe('module');
  });

  it('writes valid JSON for tsconfig.json', () => {
    const options = createOptions();
    const files = generateProject(options);

    writeFiles(testDir, files);

    const content = readFileSync(join(testDir, 'tsconfig.json'), 'utf-8');
    const tsconfig = JSON.parse(content);
    expect(tsconfig.compilerOptions.strict).toBe(true);
  });

  it('creates nested directories for class-based style', () => {
    const options = createOptions({ style: 'class-based' });
    const files = generateProject(options);

    writeFiles(testDir, files);

    expect(existsSync(join(testDir, 'src/controllers/health.controller.ts'))).toBe(true);
    expect(existsSync(join(testDir, 'src/services/app.service.ts'))).toBe(true);
  });

  it('creates all directories for full style', () => {
    const options = createOptions({ style: 'full' });
    const files = generateProject(options);

    writeFiles(testDir, files);

    expect(existsSync(join(testDir, 'src/routes/health.ts'))).toBe(true);
    expect(existsSync(join(testDir, 'src/controllers/hello.controller.ts'))).toBe(true);
    expect(existsSync(join(testDir, 'src/services/hello.service.ts'))).toBe(true);
    expect(existsSync(join(testDir, 'src/middleware/error-handler.ts'))).toBe(true);
    expect(existsSync(join(testDir, 'src/middleware/not-found.ts'))).toBe(true);
  });

  it('file content matches generated content', () => {
    const options = createOptions({ style: 'functional', middleware: 'minimal' });
    const files = generateProject(options);

    writeFiles(testDir, files);

    for (const [relativePath, expectedContent] of files) {
      const actual = readFileSync(join(testDir, relativePath), 'utf-8');
      expect(actual).toBe(expectedContent);
    }
  });
});
