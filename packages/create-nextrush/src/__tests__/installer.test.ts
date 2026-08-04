import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { validatePackageManager } from '../installer.js';

// `validatePackageManager` shells out to `yarn --version` / `npm config get
// allow-scripts`; these tests stub the external boundaries so the logic is
// deterministic and fast.
vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

const mockedExec = vi.mocked(execFileSync);

afterEach(() => {
  mockedExec.mockReset();
});

describe('validatePackageManager', () => {
  it('passes pnpm without any subprocess call', () => {
    expect(validatePackageManager('pnpm')).toEqual({ ok: true });
    expect(mockedExec).not.toHaveBeenCalled();
  });

  it('passes bun without any subprocess call', () => {
    expect(validatePackageManager('bun')).toEqual({ ok: true });
    expect(mockedExec).not.toHaveBeenCalled();
  });

  it('warns (ok + guidance) for Yarn Classic 1.x and continues', () => {
    mockedExec.mockReturnValue(Buffer.from('1.22.22\n'));
    const result = validatePackageManager('yarn');
    expect(result.ok).toBe(true);
    expect(result.guidance).toContain('Yarn Classic detected');
    expect(result.guidance).toContain('corepack enable');
  });

  it('accepts Yarn Berry 4.x', () => {
    mockedExec.mockReturnValue(Buffer.from('4.0.0\n'));
    expect(validatePackageManager('yarn')).toEqual({ ok: true });
  });

  it('accepts Yarn when the version cannot be determined (falls back to plain install)', () => {
    mockedExec.mockImplementation(() => {
      throw new Error('yarn not found');
    });
    expect(validatePackageManager('yarn')).toEqual({ ok: true });
  });

  it('passes npm with no allow-scripts configured', () => {
    mockedExec.mockReturnValue(Buffer.from('undefined\n'));
    expect(validatePackageManager('npm')).toEqual({ ok: true });
  });

  it('passes npm with a null allow-scripts value', () => {
    mockedExec.mockReturnValue(Buffer.from('null\n'));
    expect(validatePackageManager('npm')).toEqual({ ok: true });
  });

  it('skips install (ok + skipInstall + guidance) when npm allow-scripts is configured globally', () => {
    mockedExec.mockReturnValue(Buffer.from('protobufjs\n'));
    const result = validatePackageManager('npm');
    expect(result.ok).toBe(true);
    expect(result.skipInstall).toBe(true);
    expect(result.guidance).toContain('allow-scripts=protobufjs');
    expect(result.guidance).toContain('npm install');
    expect(result.guidance).toContain('~/.npmrc');
  });

  it('passes npm when the config read fails', () => {
    mockedExec.mockImplementation(() => {
      throw new Error('npm not found');
    });
    expect(validatePackageManager('npm')).toEqual({ ok: true });
  });
});
