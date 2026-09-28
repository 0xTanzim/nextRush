/**
 * @nextrush/dev - In-repo SWC hooks loader unit tests (tasks 4.2 RED / 5.1-5.3 GREEN).
 *
 * Exercises the hooks module (`src/loaders/swc-hooks.mjs`) directly through Node's
 * `load` hook signature — no hook registration machinery needed: `load(url, context)`
 * reads the file, transforms it with `@swc/core`, and returns the runnable source.
 *
 * The load-bearing assertion in every case is `design:paramtypes`: the exact metadata
 * constructor-injection DI resolves at runtime. If a transform drops it, DI breaks —
 * which is why this file, not an output-shape snapshot, is the drift guard for the
 * shared SWC-options seam (see design.md D5).
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const HOOKS_URL = new URL('../loaders/swc-hooks.mjs', import.meta.url).href;

async function loadHooks(): Promise<typeof import('../loaders/swc-hooks.mjs')> {
  return import(HOOKS_URL);
}

const DECORATED_SOURCE = `function Injectable(): ClassDecorator {
  return () => {};
}

class Dependency {}

@Injectable()
export class Widget {
  constructor(private dep: Dependency) {}
}
`;

let workDir: string | undefined;

/** Owned files must be transformed in-hook — delegation is a test failure. */
const failOnDelegate = async (): Promise<never> => {
  throw new Error('load delegated to the next loader for an owned file');
};

afterEach(() => {
  if (workDir) {
    rmSync(workDir, { recursive: true, force: true });
    workDir = undefined;
  }
});

function writeSnippet(filename: string, code: string): string {
  workDir = mkdtempSync(join(tmpdir(), 'nextrush-swc-hooks-'));
  const file = join(workDir, filename);
  writeFileSync(file, code);
  return pathToFileURL(file).href;
}

describe('swc-hooks — TypeScript transform (task 4.2)', () => {
  it('emits design:paramtypes for a decorated .ts class', async () => {
    const { load } = await loadHooks();
    const url = writeSnippet('widget.ts', DECORATED_SOURCE);

    const result = await load(url, {}, failOnDelegate);
    expect(result).toMatchObject({ format: 'module', shortCircuit: true });
    expect(String(result.source)).toContain('design:paramtypes');
  });

  it('emits design:paramtypes for .tsx with JSX parsing', async () => {
    const { load } = await loadHooks();
    const url = writeSnippet(
      'widget.tsx',
      `${DECORATED_SOURCE}\nexport const el = <div/>;\n`
    );

    const result = await load(url, {}, failOnDelegate);
    expect(result.format).toBe('module');
    expect(String(result.source)).toContain('design:paramtypes');
  });

  it('emits design:paramtypes for .mts (ESM-typed module)', async () => {
    const { load } = await loadHooks();
    const url = writeSnippet('widget.mts', DECORATED_SOURCE);

    const result = await load(url, {}, failOnDelegate);
    expect(result.format).toBe('module');
    expect(String(result.source)).toContain('design:paramtypes');
  });

  it('maps .cts to CommonJS with decorator metadata', async () => {
    const { load } = await loadHooks();
    const url = writeSnippet('widget.cts', DECORATED_SOURCE);

    const result = await load(url, {}, failOnDelegate);
    expect(result.format).toBe('commonjs');
    expect(String(result.source)).toContain('design:paramtypes');
  });

  it('emits an inline source map', async () => {
    const { load } = await loadHooks();
    const url = writeSnippet('widget.ts', DECORATED_SOURCE);

    const result = await load(url, {}, failOnDelegate);
    expect(String(result.source)).toContain('sourceMappingURL=data:');
  });

  it('passes node_modules files through to the next loader untouched', async () => {
    const { load } = await loadHooks();
    const nextLoad = async () => ({ format: 'module' as const, source: 'passthrough', shortCircuit: true });

    const result = await load(
      'file:///repo/node_modules/some-pkg/index.ts',
      {},
      nextLoad as never
    );
    expect(result).toMatchObject({ source: 'passthrough' });
  });

  it('passes declaration files through to the next loader untouched', async () => {
    const { load } = await loadHooks();
    const url = writeSnippet('widget.d.ts', 'export declare class Widget {}\n');
    let nextCalled = false;
    const nextLoad = async () => {
      nextCalled = true;
      return { format: 'module' as const, source: '', shortCircuit: true };
    };

    await load(url, {}, nextLoad as never);
    expect(nextCalled).toBe(true);
  });

  it("resolve maps a '.js' relative specifier back to its '.ts' counterpart", async () => {
    const hooks = await loadHooks();
    const target = writeSnippet('mapped.ts', 'export const x = 1;\n');
    const targetUrl = new URL(target);
    const parentURL = new URL('./entry.ts', targetUrl).href;
    // Mimic Node: the '.js' file does not exist (MODULE_NOT_FOUND), the '.ts'
    // file resolves to a path Node has no format for (UNKNOWN_EXTENSION).
    const nextResolve = async (specifier: string) => {
      if (specifier.endsWith('.ts')) {
        const err = new Error('unknown extension') as Error & { code: string };
        err.code = 'ERR_UNKNOWN_FILE_EXTENSION';
        throw err;
      }
      const err = new Error('not found') as Error & { code: string };
      err.code = 'ERR_MODULE_NOT_FOUND';
      throw err;
    };

    const result = await hooks.resolve('./mapped.js', { parentURL }, nextResolve as never);
    expect(result).toMatchObject({ url: target, format: 'module', shortCircuit: true });
  });
});
