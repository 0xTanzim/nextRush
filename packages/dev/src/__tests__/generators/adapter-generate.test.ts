import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateAdapter } from '../../generators/generate.js';
import {
  adapterConformanceTestTemplate,
  adapterFiles,
  adapterSourceTemplate,
} from '../../generators/adapter-templates.js';

describe('adapter templates', () => {
  it('source carries the FetchAdapter contract guard and a context-factory TODO', () => {
    const src = adapterSourceTemplate('my-runtime');
    expect(src).toContain("import type { FetchAdapter } from '@nextrush/types'");
    expect(src).toContain('FetchAdapter<Application, EdgeExecutionContext> = { createFetchHandler }');
    expect(src).toContain('AdapterContextFactory'); // context-factory stub TODO
    expect(src).toContain('MyRuntimeContext'); // PascalCase applied
  });

  it('conformance test wires the shared suite via the testing-tier entrypoint', () => {
    const test = adapterConformanceTestTemplate('my-runtime');
    expect(test).toContain("from '@nextrush/adapter-conformance'");
    expect(test).toContain('defineConformanceSuite(');
    expect(test).toContain('ConformanceDriver');
    // Driver var name strips hyphens to stay a valid identifier.
    expect(test).toContain('const myruntimeDriver: ConformanceDriver');
    // Regression: the handler return is `Response | Promise<Response>`, so the
    // abort path must wrap in Promise.resolve before `.catch` (type-safe).
    expect(test).toContain('Promise.resolve(createFetchHandler(app)(buildRequest');
  });

  it('emits the full file set', () => {
    const files = adapterFiles('edge2');
    expect(Object.keys(files).sort()).toEqual([
      'README.md',
      'ci-snippet.yml',
      'fixtures/hello.json',
      'src/__tests__/conformance.test.ts',
      'src/adapter.ts',
    ]);
  });
});

describe('generateAdapter', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'nr-adapter-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('scaffolds the nested directory tree with all files', async () => {
    const written = await generateAdapter('my-runtime', dir);
    expect(written).toHaveLength(5);

    const src = await readFile(join(dir, 'my-runtime', 'src', 'adapter.ts'), 'utf8');
    expect(src).toContain('export function createFetchHandler');

    const test = await readFile(
      join(dir, 'my-runtime', 'src', '__tests__', 'conformance.test.ts'),
      'utf8',
    );
    expect(test).toContain('defineConformanceSuite');

    const fixture = await readFile(join(dir, 'my-runtime', 'fixtures', 'hello.json'), 'utf8');
    expect(JSON.parse(fixture)).toMatchObject({ name: 'hello' });

    const readme = await readFile(join(dir, 'my-runtime', 'README.md'), 'utf8');
    expect(readme).toContain('@nextrush/adapter-my-runtime');
  });

  it('refuses to overwrite an existing directory', async () => {
    await generateAdapter('dup', dir);
    await expect(generateAdapter('dup', dir)).rejects.toThrow(/already exists/);
  });
});
