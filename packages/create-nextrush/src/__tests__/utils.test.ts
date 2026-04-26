import { afterEach, describe, expect, it } from 'vitest';

import {
  deriveProjectName,
  detectPackageManager,
  getInstallCommand,
  getRunCommand,
  isDirectoryEmpty,
  toPackageName,
  validateProjectName,
} from '../utils.js';

describe('validateProjectName', () => {
  it('returns undefined for valid names', () => {
    expect(validateProjectName('my-app')).toBeUndefined();
    expect(validateProjectName('my-app-2')).toBeUndefined();
    expect(validateProjectName('app')).toBeUndefined();
    expect(validateProjectName('my.app')).toBeUndefined();
    expect(validateProjectName('my_app')).toBeUndefined();
  });

  it('returns error for empty name', () => {
    expect(validateProjectName('')).toBe('Project name is required');
  });

  it('returns error for invalid characters', () => {
    expect(validateProjectName('My-App')).toBeDefined();
    expect(validateProjectName('my app')).toBeDefined();
  });

  it('returns undefined for scoped names', () => {
    expect(validateProjectName('@scope/my-app')).toBeUndefined();
  });
});

describe('deriveProjectName', () => {
  it('derives name from cwd when directory is .', () => {
    expect(deriveProjectName('.', '/tmp/My App')).toBe('my-app');
    expect(deriveProjectName('./', '/tmp/my_service')).toBe('my_service');
  });

  it('derives name from provided directory for non-dot paths', () => {
    expect(deriveProjectName('./my-api')).toBe('my-api');
    expect(deriveProjectName('My API')).toBe('my-api');
  });
});

describe('toPackageName', () => {
  it('converts directory names to valid package names', () => {
    expect(toPackageName('my-app')).toBe('my-app');
    expect(toPackageName('My App')).toBe('my-app');
    expect(toPackageName('MY_APP')).toBe('my_app');
    expect(toPackageName('./my-app')).toBe('my-app');
  });

  it('removes leading dots and underscores', () => {
    expect(toPackageName('.hidden')).toBe('hidden');
    expect(toPackageName('_private')).toBe('private');
  });

  it('collapses multiple hyphens', () => {
    expect(toPackageName('my--app')).toBe('my-app');
  });

  it('removes leading/trailing hyphens', () => {
    expect(toPackageName('-my-app-')).toBe('my-app');
  });
});

describe('getInstallCommand', () => {
  it('returns correct install commands', () => {
    expect(getInstallCommand('npm')).toBe('npm install');
    expect(getInstallCommand('pnpm')).toBe('pnpm install');
    expect(getInstallCommand('yarn')).toBe('yarn');
    expect(getInstallCommand('bun')).toBe('bun install');
  });
});

describe('getRunCommand', () => {
  it('returns correct run command prefixes', () => {
    expect(getRunCommand('npm')).toBe('npm run');
    expect(getRunCommand('pnpm')).toBe('pnpm');
    expect(getRunCommand('yarn')).toBe('yarn');
    expect(getRunCommand('bun')).toBe('bun run');
  });
});

describe('detectPackageManager', () => {
  const originalEnv = process.env['npm_config_user_agent'];

  it('detects pnpm', () => {
    process.env['npm_config_user_agent'] = 'pnpm/8.0.0 npm/? node/v22.0.0';
    expect(detectPackageManager()).toBe('pnpm');
  });

  it('detects yarn', () => {
    process.env['npm_config_user_agent'] = 'yarn/4.0.0 npm/? node/v22.0.0';
    expect(detectPackageManager()).toBe('yarn');
  });

  it('detects bun', () => {
    process.env['npm_config_user_agent'] = 'bun/1.0.0 npm/? node/v22.0.0';
    expect(detectPackageManager()).toBe('bun');
  });

  it('defaults to npm', () => {
    process.env['npm_config_user_agent'] = '';
    expect(detectPackageManager()).toBe('npm');
  });

  it('defaults to npm when env is unset', () => {
    delete process.env['npm_config_user_agent'];
    expect(detectPackageManager()).toBe('npm');
  });

  // Cleanup
  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env['npm_config_user_agent'];
    } else {
      process.env['npm_config_user_agent'] = originalEnv;
    }
  });
});

describe('isDirectoryEmpty', () => {
  it('returns true for non-existent directory', () => {
    expect(isDirectoryEmpty('/tmp/nonexistent-dir-' + Date.now())).toBe(true);
  });
});
