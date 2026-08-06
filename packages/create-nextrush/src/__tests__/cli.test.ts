import { describe, expect, it } from 'vitest';

import { CliInputError, parseArgs } from '../cli.js';

describe('parseArgs', () => {
  it('parses directory as positional argument', () => {
    const result = parseArgs(['node', 'create-nextrush', 'my-app']);
    expect(result.directory).toBe('my-app');
  });

  it('accepts the `--` end-of-options separator passed by npm/pnpm create wrappers', () => {
    // The canonical `npm create nextrush my-app -- --yes` form may forward a bare `--`.
    // It is a separator, not an unknown option (task 5.4 matrix finding).
    const result = parseArgs(['node', 'create-nextrush', 'my-app', '--', '--yes']);
    expect(result.directory).toBe('my-app');
    expect(result.yes).toBe(true);
  });

  it('parses --style flag', () => {
    const result = parseArgs(['node', 'create-nextrush', '--style', 'class-based']);
    expect(result.style).toBe('class-based');
  });

  it('parses -s short style flag', () => {
    const result = parseArgs(['node', 'create-nextrush', '-s', 'full']);
    expect(result.style).toBe('full');
  });

  it('parses --runtime flag', () => {
    const result = parseArgs(['node', 'create-nextrush', '--runtime', 'bun']);
    expect(result.runtime).toBe('bun');
  });

  it('parses -r short runtime flag', () => {
    const result = parseArgs(['node', 'create-nextrush', '-r', 'deno']);
    expect(result.runtime).toBe('deno');
  });

  it('parses --middleware flag', () => {
    const result = parseArgs(['node', 'create-nextrush', '--middleware', 'full']);
    expect(result.middleware).toBe('full');
  });

  it('parses -m short middleware flag', () => {
    const result = parseArgs(['node', 'create-nextrush', '-m', 'api']);
    expect(result.middleware).toBe('api');
  });

  it('parses --pm flag', () => {
    const result = parseArgs(['node', 'create-nextrush', '--pm', 'pnpm']);
    expect(result.packageManager).toBe('pnpm');
  });

  it('parses --no-install flag', () => {
    const result = parseArgs(['node', 'create-nextrush', '--no-install']);
    expect(result.install).toBe(false);
  });

  it('parses --install and -i flags', () => {
    const longResult = parseArgs(['node', 'create-nextrush', '--no-install', '--install']);
    const shortResult = parseArgs(['node', 'create-nextrush', '--no-install', '-i']);

    expect(longResult.install).toBe(true);
    expect(shortResult.install).toBe(true);
  });

  it('parses --no-git flag', () => {
    const result = parseArgs(['node', 'create-nextrush', '--no-git']);
    expect(result.git).toBe(false);
  });

  it('parses --git flag', () => {
    const result = parseArgs(['node', 'create-nextrush', '--no-git', '--git']);
    expect(result.git).toBe(true);
  });

  it('parses -y / --yes flag', () => {
    const result = parseArgs(['node', 'create-nextrush', '-y']);
    expect(result.yes).toBe(true);
  });

  it('parses --help flag', () => {
    const result = parseArgs(['node', 'create-nextrush', '--help']);
    expect(result.help).toBe(true);
  });

  it('parses -h flag', () => {
    const result = parseArgs(['node', 'create-nextrush', '-h']);
    expect(result.help).toBe(true);
  });

  it('parses --version flag', () => {
    const result = parseArgs(['node', 'create-nextrush', '--version']);
    expect(result.version).toBe(true);
  });

  it('parses -v flag', () => {
    const result = parseArgs(['node', 'create-nextrush', '-v']);
    expect(result.version).toBe(true);
  });

  it('parses combined flags', () => {
    const result = parseArgs([
      'node',
      'create-nextrush',
      'my-project',
      '--style',
      'full',
      '--runtime',
      'node',
      '--middleware',
      'api',
      '--pm',
      'pnpm',
      '--no-git',
      '-y',
    ]);

    expect(result.directory).toBe('my-project');
    expect(result.style).toBe('full');
    expect(result.runtime).toBe('node');
    expect(result.middleware).toBe('api');
    expect(result.packageManager).toBe('pnpm');
    expect(result.git).toBe(false);
    expect(result.yes).toBe(true);
  });

  it('returns defaults for empty args', () => {
    const result = parseArgs(['node', 'create-nextrush']);

    expect(result.directory).toBeUndefined();
    expect(result.style).toBeUndefined();
    expect(result.runtime).toBeUndefined();
    expect(result.middleware).toBeUndefined();
    expect(result.packageManager).toBeUndefined();
    expect(result.install).toBe(true);
    expect(result.git).toBe(true);
    expect(result.yes).toBe(false);
    expect(result.help).toBe(false);
    expect(result.version).toBe(false);
  });

  it.each([
    ['--style', 'invalid', 'INVALID_STYLE'],
    ['--runtime', 'invalid', 'INVALID_RUNTIME'],
    ['--middleware', 'invalid', 'INVALID_MIDDLEWARE'],
    ['--pm', 'invalid', 'INVALID_PACKAGE_MANAGER'],
  ])('rejects an invalid %s value', (flag, value, code) => {
    expect(() => parseArgs(['node', 'create-nextrush', flag, value])).toThrowError(CliInputError);
    try {
      parseArgs(['node', 'create-nextrush', flag, value]);
    } catch (error) {
      expect(error).toMatchObject({ code });
    }
  });

  it.each(['--style', '--runtime', '--middleware', '--pm'])('rejects a missing %s value', (flag) => {
    expect(() => parseArgs(['node', 'create-nextrush', flag])).toThrowError(CliInputError);
  });

  it('rejects unknown flags instead of silently continuing', () => {
    expect(() => parseArgs(['node', 'create-nextrush', '--unknown'])).toThrowError(
      expect.objectContaining({ code: 'UNKNOWN_OPTION' })
    );
  });

  it('parses automation flags', () => {
    const result = parseArgs(['node', 'create-nextrush', 'my-app', '--yes', '--json', '--dry-run']);
    expect(result).toMatchObject({ directory: 'my-app', yes: true, json: true, dryRun: true });
  });

  it('parses the overwrite and offline flags', () => {
    const result = parseArgs(['node', 'create-nextrush', '--overwrite', '--offline']);
    expect(result).toMatchObject({ overwrite: true, offline: true });
  });

  it('parses --preset production', () => {
    const result = parseArgs(['node', 'create-nextrush', '--preset', 'production']);
    expect(result.preset).toBe('production');
  });

  it('rejects an invalid --preset value', () => {
    expect(() => parseArgs(['node', 'create-nextrush', '--preset', 'staging'])).toThrowError(
      expect.objectContaining({ code: 'INVALID_PRESET' })
    );
  });

  it('parses --example secure-api', () => {
    const result = parseArgs(['node', 'create-nextrush', '--example', 'secure-api']);
    expect(result.example).toBe('secure-api');
  });

  it('rejects an invalid --example value', () => {
    expect(() => parseArgs(['node', 'create-nextrush', '--example', 'todo'])).toThrowError(
      expect.objectContaining({ code: 'INVALID_EXAMPLE' })
    );
  });

  it('parses --workspace', () => {
    const result = parseArgs(['node', 'create-nextrush', '--workspace']);
    expect(result.workspace).toBe(true);
  });

  it('parses --skip-runtime-check', () => {
    const result = parseArgs(['node', 'create-nextrush', '--skip-runtime-check']);
    expect(result.skipRuntimeCheck).toBe(true);
  });

  it('rejects an option value that looks like a flag', () => {
    expect(() => parseArgs(['node', 'create-nextrush', '--style', '--json'])).toThrowError(
      expect.objectContaining({ code: 'MISSING_OPTION_VALUE' })
    );
  });

  it('rejects a second positional argument', () => {
    expect(() => parseArgs(['node', 'create-nextrush', 'a', 'b'])).toThrowError(
      expect.objectContaining({ code: 'UNEXPECTED_POSITIONAL' })
    );
  });

  it('CliInputError exposes a stable payload for automation output', () => {
    const error = new CliInputError({ code: 'E_X', message: 'm', remediation: 'r' });
    expect(error.toPayload()).toEqual({ code: 'E_X', message: 'm', remediation: 'r' });
  });
});
