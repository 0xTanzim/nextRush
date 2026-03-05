import { describe, expect, it } from 'vitest';

import { parseArgs } from '../cli.js';

describe('parseArgs', () => {
  it('parses directory as positional argument', () => {
    const result = parseArgs(['node', 'create-nextrush', 'my-app']);
    expect(result.directory).toBe('my-app');
  });

  it('parses --style flag', () => {
    const result = parseArgs(['node', 'create-nextrush', '--style', 'class-based']);
    expect(result.style).toBe('class-based');
  });

  it('parses --runtime flag', () => {
    const result = parseArgs(['node', 'create-nextrush', '--runtime', 'bun']);
    expect(result.runtime).toBe('bun');
  });

  it('parses --middleware flag', () => {
    const result = parseArgs(['node', 'create-nextrush', '--middleware', 'full']);
    expect(result.middleware).toBe('full');
  });

  it('parses --pm flag', () => {
    const result = parseArgs(['node', 'create-nextrush', '--pm', 'pnpm']);
    expect(result.packageManager).toBe('pnpm');
  });

  it('parses --no-install flag', () => {
    const result = parseArgs(['node', 'create-nextrush', '--no-install']);
    expect(result.install).toBe(false);
  });

  it('parses --no-git flag', () => {
    const result = parseArgs(['node', 'create-nextrush', '--no-git']);
    expect(result.git).toBe(false);
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

  it('ignores invalid style values', () => {
    const result = parseArgs(['node', 'create-nextrush', '--style', 'invalid']);
    expect(result.style).toBeUndefined();
  });

  it('ignores invalid runtime values', () => {
    const result = parseArgs(['node', 'create-nextrush', '--runtime', 'invalid']);
    expect(result.runtime).toBeUndefined();
  });

  it('ignores invalid middleware values', () => {
    const result = parseArgs(['node', 'create-nextrush', '--middleware', 'invalid']);
    expect(result.middleware).toBeUndefined();
  });

  it('ignores invalid pm values', () => {
    const result = parseArgs(['node', 'create-nextrush', '--pm', 'invalid']);
    expect(result.packageManager).toBeUndefined();
  });

  it('ignores unknown flags', () => {
    const result = parseArgs(['node', 'create-nextrush', '--unknown']);
    expect(result.directory).toBeUndefined();
    expect(result.style).toBeUndefined();
  });

  it('does not treat unknown flag values as directory when directory is set', () => {
    const result = parseArgs(['node', 'create-nextrush', 'my-app', '--unknown', 'value']);
    expect(result.directory).toBe('my-app');
  });
});
