import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveFromArgs, runPrompts } from '../prompts.js';
import type { ParsedArgs } from '../types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clackState: { selectResult: unknown; textResult: string } = {
  selectResult: undefined,
  textResult: 'interactive-app',
};

vi.mock('@clack/prompts', () => ({
  cancel: vi.fn(),
  confirm: vi.fn(() => Promise.resolve(true)),
  group: vi.fn((fields: Record<string, () => Promise<unknown>>) => {
    const out: Record<string, unknown> = {};
    const keys = Object.keys(fields);
    return keys
      .reduce(
        (acc, key) =>
          acc.then(async () => {
            out[key] = await fields[key]();
          }),
        Promise.resolve()
      )
      .then(() => out);
  }),
  intro: vi.fn(),
  isCancel: vi.fn(() => false),
  note: vi.fn(),
  outro: vi.fn(),
  select: vi.fn((opts: { message?: string; initialValue?: unknown; options?: { value: unknown }[] }) => {
    // Resolve each field from its own initial value (or first option), so the
    // customize group yields distinct style/runtime/middleware/package-manager values.
    if (opts.message?.includes('recommended')) return Promise.resolve(clackState.selectResult);
    const value = opts.initialValue ?? opts.options?.[0]?.value;
    return Promise.resolve(value);
  }),
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
  text: vi.fn(() => Promise.resolve(clackState.textResult)),
}));

/**
 * Unit coverage for the non-interactive arg-resolution path in prompts.ts
 * (Wave 2 / task 7.1). The interactive clack flow is exercised via the
 * CLI-process suite; the pure flag-resolution and short-circuit logic is
 * covered here.
 */
const baseArgs = (overrides: Partial<ParsedArgs> = {}): ParsedArgs => ({
  install: true,
  installExplicit: false,
  git: true,
  gitExplicit: false,
  yes: false,
  help: false,
  version: false,
  json: false,
  dryRun: false,
  overwrite: false,
  offline: false,
  skipRuntimeCheck: false,
  workspace: false,
  ...overrides,
});

describe('resolveFromArgs (non-interactive resolution)', () => {
  it('applies CLI-provided style/runtime/middleware/package-manager values', () => {
    const options = resolveFromArgs(
      baseArgs({
        directory: 'my-api',
        style: 'class-based',
        runtime: 'bun',
        middleware: 'full',
        packageManager: 'pnpm',
      })
    );
    expect(options).toMatchObject({
      name: 'my-api',
      directory: 'my-api',
      style: 'class-based',
      runtime: 'bun',
      middleware: 'full',
      packageManager: 'pnpm',
    });
  });

  it('falls back to defaults when no architecture flags are passed', () => {
    const options = resolveFromArgs(baseArgs({}));
    expect(options).toMatchObject({
      style: 'functional',
      runtime: 'node',
      middleware: 'api',
    });
  });

  it('threads --preset and --example into the resolved options', () => {
    const options = resolveFromArgs(baseArgs({ preset: 'production', example: 'secure-api' }));
    expect(options.preset).toBe('production');
    expect(options.example).toBe('secure-api');
  });

  it('uses the default directory when none is supplied', () => {
    const options = resolveFromArgs(baseArgs({}));
    expect(options.directory).toBe('my-nextrush-app');
    expect(options.name).toBe('my-nextrush-app');
  });

  it('honors git/install flags', () => {
    const options = resolveFromArgs(baseArgs({ git: false, install: false }));
    expect(options.git).toBe(false);
    expect(options.install).toBe(false);
  });
});

describe('runPrompts short-circuits (task 3.2)', () => {
  it('returns resolved options without prompting when --yes is passed', async () => {
    const options = await runPrompts(baseArgs({ yes: true, directory: 'short-app' }));
    expect(options).toMatchObject({
      name: 'short-app',
      directory: 'short-app',
      style: 'functional',
      runtime: 'node',
    });
  });

  it('returns resolved options without prompting when --json is passed', async () => {
    const options = await runPrompts(baseArgs({ json: true, directory: 'json-app' }));
    expect(options).toMatchObject({ name: 'json-app', directory: 'json-app' });
  });

  it('returns resolved options without prompting when all architecture flags are provided', async () => {
    const options = await runPrompts(
      baseArgs({
        directory: 'full-app',
        style: 'full',
        runtime: 'deno',
        middleware: 'api',
      })
    );
    expect(options).toMatchObject({
      name: 'full-app',
      style: 'full',
      runtime: 'deno',
      middleware: 'api',
    });
  });
});

describe('runPrompts interactive paths (progressive disclosure, task 3.2)', () => {
  beforeEach(() => {
    clackState.selectResult = 'recommended';
    clackState.textResult = 'interactive-app';
  });

  it('accepting the recommended starter skips the customize group', async () => {
    clackState.selectResult = 'recommended';
    const options = await runPrompts(baseArgs({}));
    expect(options).toMatchObject({
      name: 'interactive-app',
      style: 'functional',
      runtime: 'node',
      middleware: 'api',
    });
  });

  it('choosing customize runs the full prompt group with defaults', async () => {
    clackState.selectResult = 'customize';
    const options = await runPrompts(baseArgs({}));
    expect(options).toMatchObject({
      name: 'interactive-app',
      style: 'functional',
      runtime: 'node',
      middleware: 'api',
    });
  });

  it('explicit style/runtime/middleware flags skip the starter gate', async () => {
    clackState.selectResult = 'customize';
    const options = await runPrompts(
      baseArgs({ style: 'full', runtime: 'bun', middleware: 'minimal' })
    );
    expect(options).toMatchObject({
      style: 'full',
      runtime: 'bun',
      middleware: 'minimal',
    });
  });

  it('--preset and --example survive the interactive path', async () => {
    clackState.selectResult = 'customize';
    const options = await runPrompts(baseArgs({ preset: 'production', example: 'secure-api' }));
    expect(options.preset).toBe('production');
    expect(options.example).toBe('secure-api');
  });
});
