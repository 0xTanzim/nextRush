import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

import { execSync } from 'node:child_process';
import {
  shouldSkip,
  isDevInstalled,
  detectPackageManager,
  getInstallCommand,
  installDevPackage,
} from '../../scripts/postinstall.js';

describe('postinstall', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.CI;
    delete process.env.NEXTRUSH_SKIP_POSTINSTALL;
    delete process.env.npm_config_user_agent;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('shouldSkip', () => {
    it('returns false by default', () => {
      expect(shouldSkip()).toBe(false);
    });

    it('returns true when CI is set', () => {
      process.env.CI = 'true';
      expect(shouldSkip()).toBe(true);
    });

    it('returns true when CI is set to any value', () => {
      process.env.CI = '1';
      expect(shouldSkip()).toBe(true);
    });

    it('returns true when NEXTRUSH_SKIP_POSTINSTALL=1', () => {
      process.env.NEXTRUSH_SKIP_POSTINSTALL = '1';
      expect(shouldSkip()).toBe(true);
    });

    it('returns false when NEXTRUSH_SKIP_POSTINSTALL is not 1', () => {
      process.env.NEXTRUSH_SKIP_POSTINSTALL = '0';
      expect(shouldSkip()).toBe(false);
    });

    it('returns true when both CI and SKIP are set', () => {
      process.env.CI = 'true';
      process.env.NEXTRUSH_SKIP_POSTINSTALL = '1';
      expect(shouldSkip()).toBe(true);
    });
  });

  describe('detectPackageManager', () => {
    it('returns npm by default', () => {
      expect(detectPackageManager()).toBe('npm');
    });

    it('returns pnpm for pnpm user agent', () => {
      process.env.npm_config_user_agent = 'pnpm/9.0.0 npm/? node/v22.0.0 linux x64';
      expect(detectPackageManager()).toBe('pnpm');
    });

    it('returns yarn for yarn user agent', () => {
      process.env.npm_config_user_agent = 'yarn/1.22.19 npm/? node/v22.0.0 linux x64';
      expect(detectPackageManager()).toBe('yarn');
    });

    it('returns bun for bun user agent', () => {
      process.env.npm_config_user_agent = 'bun/1.1.0 npm/? node/v22.0.0 linux x64';
      expect(detectPackageManager()).toBe('bun');
    });

    it('returns npm for empty user agent', () => {
      process.env.npm_config_user_agent = '';
      expect(detectPackageManager()).toBe('npm');
    });
  });

  describe('getInstallCommand', () => {
    it('returns correct command for pnpm', () => {
      expect(getInstallCommand('pnpm')).toBe('pnpm add -D @nextrush/dev@latest');
    });

    it('returns correct command for yarn', () => {
      expect(getInstallCommand('yarn')).toBe('yarn add -D @nextrush/dev@latest');
    });

    it('returns correct command for bun', () => {
      expect(getInstallCommand('bun')).toBe('bun add -D @nextrush/dev@latest');
    });

    it('returns correct command for npm', () => {
      expect(getInstallCommand('npm')).toBe('npm install -D @nextrush/dev@latest');
    });
  });

  describe('installDevPackage', () => {
    it('calls execSync with pnpm command', () => {
      vi.mocked(execSync).mockImplementation(() => Buffer.from(''));

      installDevPackage('pnpm');

      expect(execSync).toHaveBeenCalledWith(
        'pnpm add -D @nextrush/dev@latest',
        { stdio: 'inherit' },
      );
    });

    it('returns true on success', () => {
      vi.mocked(execSync).mockImplementation(() => Buffer.from(''));

      expect(installDevPackage('npm')).toBe(true);
    });

    it('returns false on failure', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('install failed');
      });

      expect(installDevPackage('npm')).toBe(false);
    });

    it('does not throw on failure', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('install failed');
      });

      expect(() => installDevPackage('npm')).not.toThrow();
    });
  });

  describe('isDevInstalled', () => {
    it('returns a boolean', () => {
      const result = isDevInstalled();
      expect(typeof result).toBe('boolean');
    });

    it('returns false when @nextrush/dev is not resolvable from scripts dir', () => {
      expect(isDevInstalled()).toBe(false);
    });
  });

  describe('package.json configuration', () => {
    it('has postinstall script', async () => {
      const { readFile } = await import('node:fs/promises');
      const pkgJsonUrl = new URL('../../package.json', import.meta.url);
      const pkg = JSON.parse(await readFile(pkgJsonUrl, 'utf8')) as {
        scripts?: { postinstall?: string };
      };

      expect(pkg.scripts?.postinstall).toBe('node scripts/postinstall.js');
    });

    it('includes scripts in files array', async () => {
      const { readFile } = await import('node:fs/promises');
      const pkgJsonUrl = new URL('../../package.json', import.meta.url);
      const pkg = JSON.parse(await readFile(pkgJsonUrl, 'utf8')) as {
        files?: string[];
      };

      expect(pkg.files).toContain('scripts');
    });

    it('does not declare a bin entry', async () => {
      const { readFile } = await import('node:fs/promises');
      const pkgJsonUrl = new URL('../../package.json', import.meta.url);
      const pkg = JSON.parse(await readFile(pkgJsonUrl, 'utf8')) as {
        bin?: unknown;
      };

      expect(pkg.bin).toBeUndefined();
    });
  });
});
