import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Launcher tests (capability: framework-composition, requirement "The nextrush launcher delegates
 * transparently or explains absence actionably"; RFC-020 §21 addendum; ADR-0013).
 *
 * The launcher's one true boundary is module resolution (`import('@nextrush/dev')`), so it is
 * injected — the same "test the pure logic, don't fight the package manager" approach
 * `class-peer-guard.test.ts` uses. The real `@nextrush/dev` `cli()` reads `process.argv` and
 * self-exits, so it is never invoked here; a spy stands in for it.
 */

describe('runDevCliLauncher — delegation (toolkit installed)', () => {
  it('invokes @nextrush/dev cli with the passed argv and returns 0 when cli returns', async () => {
    const { runDevCliLauncher } = await import('../dev-cli-launcher.js');
    const cli = vi.fn();
    const argv = ['dev', '--port', '4000'];

    const code = await runDevCliLauncher(argv, {
      importDevCli: () => Promise.resolve({ cli }),
    });

    expect(cli).toHaveBeenCalledOnce();
    expect(cli).toHaveBeenCalledWith(argv);
    expect(code).toBe(0);
  });
});

describe('runDevCliLauncher — actionable message (toolkit absent)', () => {
  function missingError(): NodeJS.ErrnoException {
    const err: NodeJS.ErrnoException = new Error(
      "Cannot find package '@nextrush/dev' imported from /app/node_modules/.bin/nextrush"
    );
    err.code = 'ERR_MODULE_NOT_FOUND';
    return err;
  }

  it('prints a message naming the package, an install command, and a toolkit description, then returns non-zero', async () => {
    const { runDevCliLauncher } = await import('../dev-cli-launcher.js');
    const messages: string[] = [];

    const code = await runDevCliLauncher(['dev', '--port', '4000'], {
      importDevCli: () => Promise.reject(missingError()),
      detectPackageManager: () => 'pnpm',
      writeError: (m) => messages.push(m),
    });

    const output = messages.join('\n');
    expect(code).not.toBe(0);
    expect(output).toContain('@nextrush/dev');
    // branded as the Development Toolkit (fed.md wording)
    expect(output).toMatch(/development toolkit/i);
    expect(output).toContain('pnpm add -D @nextrush/dev');
    // one-line description of what the toolkit provides
    expect(output).toMatch(/dev server|build|generat/i);
    // a "then run" hint that reflects the command the user actually attempted (fed.md Option 1)
    expect(output).toContain('pnpm nextrush dev --port 4000');
  });
});

describe('runDevCliLauncher — resolves relative to the consuming app, not this package', () => {
  it('resolves @nextrush/dev from the caller-provided base directory where it IS installed, even though `nextrush` itself never depends on it', async () => {
    // Reproduces the real bug found running `nextrush build` from apps/playground on
    // 2026-07-24: @nextrush/dev was genuinely installed and built for the CONSUMING app, but
    // the launcher's bare `import('@nextrush/dev')` resolves relative to dev-cli-launcher.js's
    // OWN location inside packages/nextrush/dist/ — which deliberately has no @nextrush/dev
    // dependency (ADR-0013) — so it always reports "not installed" regardless of what the
    // actual invoking app has. The fix resolves from an explicit base directory (the real bin
    // entry point passes `process.cwd()`) via `createRequire(baseDir).resolve(...)`, then
    // dynamically imports the resolved absolute path — never a bare specifier resolved from
    // this package's own location. This exercises the REAL default resolver (no `importDevCli`
    // override), only `baseDir` is supplied, proving resolution itself is fixed.
    const { runDevCliLauncher } = await import('../dev-cli-launcher.js');
    const playgroundDir = new URL('../../../../apps/playground/', import.meta.url).pathname;

    const code = await runDevCliLauncher(['--help'], { baseDir: playgroundDir });

    // `@nextrush/dev`'s real cli() handles `--help` and returns without exiting the process
    // (per its own CLI contract) — reaching code 0 here proves the module was FOUND and its
    // real cli() ran, not that resolution was mocked away.
    expect(code).toBe(0);
  });

  it('reports "not installed" when resolving from a directory that genuinely lacks @nextrush/dev', async () => {
    const { runDevCliLauncher } = await import('../dev-cli-launcher.js');
    const messages: string[] = [];
    // packages/errors has no @nextrush/dev dependency and never will — a real "absent" case,
    // proving the fix doesn't just make every directory look installed.
    const errorsPackageDir = new URL('../../../errors/', import.meta.url).pathname;

    const code = await runDevCliLauncher(['build'], {
      baseDir: errorsPackageDir,
      writeError: (m) => messages.push(m),
    });

    expect(code).toBe(1);
    expect(messages.join('\n')).toContain('@nextrush/dev');
  });
});

describe('buildMissingToolkitMessage — package-manager-aware install command (design D4)', () => {
  it.each([
    ['pnpm', 'pnpm add -D @nextrush/dev'],
    ['yarn', 'yarn add -D @nextrush/dev'],
    ['bun', 'bun add -d @nextrush/dev'],
    ['npm', 'npm install -D @nextrush/dev'],
  ] as const)('uses the %s install command', async (pm, expected) => {
    const { buildMissingToolkitMessage } = await import('../dev-cli-launcher.js');
    expect(buildMissingToolkitMessage(pm)).toContain(expected);
  });

  it('falls back to package-manager-agnostic phrasing when detection is inconclusive', async () => {
    const { buildMissingToolkitMessage } = await import('../dev-cli-launcher.js');
    const message = buildMissingToolkitMessage(null);

    expect(message).toContain('@nextrush/dev');
    // no PM-specific command is asserted as THE command; still actionable
    expect(message).toMatch(/dev dependency/i);
  });
});

describe('runDevCliLauncher — unrelated error passthrough', () => {
  it('rethrows an unrelated resolution/execution error unchanged and never prints the missing-package message', async () => {
    const { runDevCliLauncher } = await import('../dev-cli-launcher.js');
    const messages: string[] = [];
    const unrelated = new Error('a totally unrelated failure');

    await expect(
      runDevCliLauncher(['dev'], {
        importDevCli: () => Promise.reject(unrelated),
        writeError: (m) => messages.push(m),
      })
    ).rejects.toThrow('a totally unrelated failure');

    expect(messages).toEqual([]);
  });

  it('does not mistake a missing transitive dependency of @nextrush/dev for a missing toolkit', async () => {
    const { runDevCliLauncher } = await import('../dev-cli-launcher.js');
    const messages: string[] = [];
    // @nextrush/dev is present, but IT fails to resolve @swc/core — the message contains the
    // "@nextrush/dev" path but the MISSING specifier is @swc/core. Must pass through, not rewrite.
    const transitive: NodeJS.ErrnoException = new Error(
      "Cannot find package '@swc/core' imported from /app/node_modules/@nextrush/dev/dist/cli.js"
    );
    transitive.code = 'ERR_MODULE_NOT_FOUND';

    await expect(
      runDevCliLauncher(['dev'], {
        importDevCli: () => Promise.reject(transitive),
        writeError: (m) => messages.push(m),
      })
    ).rejects.toThrow('@swc/core');

    expect(messages).toEqual([]);
  });
});

describe('dev-cli-launcher — no side effect at import time (never runs at install)', () => {
  it('importing the module performs no console output and no resolution attempt', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const mod = await import('../dev-cli-launcher.js');

    expect(typeof mod.runDevCliLauncher).toBe('function');
    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
    expect(stderrSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
    logSpy.mockRestore();
    stderrSpy.mockRestore();
  });
});

describe('runDevCliLauncher — default (non-injected) seams', () => {
  const ORIGINAL_UA = process.env.npm_config_user_agent;

  afterEach(() => {
    if (ORIGINAL_UA === undefined) {
      delete process.env.npm_config_user_agent;
    } else {
      process.env.npm_config_user_agent = ORIGINAL_UA;
    }
  });

  function missingError(): NodeJS.ErrnoException {
    const err: NodeJS.ErrnoException = new Error("Cannot find package '@nextrush/dev' imported from x");
    err.code = 'ERR_MODULE_NOT_FOUND';
    return err;
  }

  it('detects the package manager from npm_config_user_agent and writes to stderr by default', async () => {
    const { runDevCliLauncher } = await import('../dev-cli-launcher.js');
    process.env.npm_config_user_agent = 'pnpm/8.15.0 npm/? node/v22.0.0 linux x64';
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    // No detectPackageManager and no writeError injected → exercises the real defaults.
    const code = await runDevCliLauncher(['dev'], { importDevCli: () => Promise.reject(missingError()) });

    expect(code).toBe(1);
    const written = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(written).toContain('pnpm add -D @nextrush/dev');
    stderrSpy.mockRestore();
  });

  it('falls back to agnostic phrasing when npm_config_user_agent is absent', async () => {
    const { runDevCliLauncher } = await import('../dev-cli-launcher.js');
    delete process.env.npm_config_user_agent;
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const code = await runDevCliLauncher(['dev'], { importDevCli: () => Promise.reject(missingError()) });

    expect(code).toBe(1);
    const written = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(written).toMatch(/dev dependency/i);
    stderrSpy.mockRestore();
  });

  it('resolves @nextrush/dev via the real default importer (absent here → actionable message)', async () => {
    // `@nextrush/dev` is deliberately not a dependency of `nextrush`, so the real dynamic import
    // throws ERR_MODULE_NOT_FOUND — exercising the default importer path end-to-end and proving the
    // regex matches Node's real error shape (task 6.4's assumption, verified in-suite).
    const { runDevCliLauncher } = await import('../dev-cli-launcher.js');
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const code = await runDevCliLauncher(['dev']);

    expect(code).toBe(1);
    const written = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(written).toContain('@nextrush/dev');
    stderrSpy.mockRestore();
  });
});
