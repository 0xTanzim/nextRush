/**
 * @nextrush/dev - Deno Permissions Tests
 *
 * Tests for configurable Deno permissions in `buildDevArgs`.
 *
 * Per spec `dev-deno-permissions` (D1): configured permissions are merged into the
 * default `--allow-net --allow-read --allow-env` set, deduplicated, and NEVER replace
 * it. The default set is unchanged when nothing is configured.
 *
 */

import { describe, expect, it } from 'vitest';
import { buildDevArgs, validateDenoPermissions } from '../runtime/spawn.js';

describe('buildDevArgs - Deno Permissions', () => {
  describe('default permissions', () => {
    it('should include default permissions when none provided', () => {
      const result = buildDevArgs('deno', 'src/index.ts', []);

      expect(result.command).toBe('deno');
      expect(result.args).toContain('--allow-net');
      expect(result.args).toContain('--allow-read');
      expect(result.args).toContain('--allow-env');
    });

    it('should include default permissions with watch paths', () => {
      const result = buildDevArgs('deno', 'src/index.ts', ['./src', './config']);

      expect(result.args).toContain('--allow-net');
      expect(result.args).toContain('--allow-read');
      expect(result.args).toContain('--allow-env');
    });

    it('should spawn with exactly the default set when unconfigured', () => {
      const result = buildDevArgs('deno', 'src/index.ts', []);
      const allowArgs = result.args.filter((arg) => arg.startsWith('--allow'));

      expect(allowArgs.sort()).toEqual(['--allow-env', '--allow-net', '--allow-read'].sort());
    });
  });

  describe('extending permissions (D1: extend, never replace)', () => {
    it('should merge a configured extra permission with the defaults', () => {
      const result = buildDevArgs('deno', 'src/index.ts', [], false, undefined, ['--allow-write']);

      // Defaults must still be present — extend, not replace.
      expect(result.args).toContain('--allow-net');
      expect(result.args).toContain('--allow-read');
      expect(result.args).toContain('--allow-env');
      // Plus the configured extra permission.
      expect(result.args).toContain('--allow-write');
    });

    it('should preserve watch with extended permissions', () => {
      const result = buildDevArgs('deno', 'src/index.ts', ['./src'], false, undefined, [
        '--allow-sys',
        '--allow-write',
      ]);

      expect(result.args).toContain('--allow-sys');
      expect(result.args).toContain('--allow-write');
      expect(result.args).toContain('--allow-net');
      expect(result.args.some((arg) => arg.startsWith('--watch'))).toBe(true);
    });

    it('should not duplicate a configured permission that duplicates a default', () => {
      const result = buildDevArgs('deno', 'src/index.ts', [], false, undefined, ['--allow-net']);

      const netCount = result.args.filter((arg) => arg === '--allow-net').length;
      expect(netCount).toBe(1);
    });

    it('should treat an empty configured permissions array as "no extras" — defaults only', () => {
      const result = buildDevArgs('deno', 'src/index.ts', [], false, undefined, []);
      const allowArgs = result.args.filter((arg) => arg.startsWith('--allow'));

      expect(allowArgs.sort()).toEqual(['--allow-env', '--allow-net', '--allow-read'].sort());
    });

    it('should maintain arg order: run, watch, permissions, inspect, entry', () => {
      const result = buildDevArgs('deno', 'src/index.ts', [], false, undefined, [
        '--allow-write',
      ]);

      const runIdx = result.args.indexOf('run');
      const watchIdx = result.args.indexOf('--watch');
      const permIdx = result.args.findIndex((arg) => arg.startsWith('--allow'));
      const entryIdx = result.args.indexOf('src/index.ts');

      expect(runIdx).toBeLessThan(watchIdx);
      expect(watchIdx).toBeLessThan(permIdx);
      expect(permIdx).toBeLessThan(entryIdx);
    });

    it('should support scoped permission forms', () => {
      const result = buildDevArgs('deno', 'src/index.ts', [], false, undefined, [
        '--allow-ffi',
        '--allow-write=./dist',
      ]);

      expect(result.args).toContain('--allow-ffi');
      expect(result.args).toContain('--allow-write=./dist');
      // Defaults are still present.
      expect(result.args).toContain('--allow-net');
    });

    it('should support deny- permission forms alongside defaults', () => {
      const result = buildDevArgs('deno', 'src/index.ts', [], false, undefined, [
        '--deny-read=./secrets',
      ]);

      expect(result.args).toContain('--deny-read=./secrets');
      expect(result.args).toContain('--allow-net');
    });
  });

  describe('integration with inspect', () => {
    it('should include inspect with extended permissions', () => {
      const result = buildDevArgs('deno', 'src/index.ts', [], true, 9230, ['--allow-write']);

      expect(result.args).toContain('--allow-write');
      expect(result.args).toContain('--allow-net');
      expect(result.args.some((arg) => arg.includes('9230'))).toBe(true);
    });
  });
});

describe('validateDenoPermissions', () => {
  it('accepts permissions beginning with --allow-', () => {
    expect(() => validateDenoPermissions(['--allow-write', '--allow-ffi'])).not.toThrow();
  });

  it('accepts permissions beginning with --deny-', () => {
    expect(() => validateDenoPermissions(['--deny-read=./secrets'])).not.toThrow();
  });

  it('accepts an empty array', () => {
    expect(() => validateDenoPermissions([])).not.toThrow();
  });

  it('rejects a permission not beginning with --allow- or --deny-', () => {
    expect(() => validateDenoPermissions(['--net'])).toThrow(/--net/);
  });

  it('rejects a plain garbage value and names it in the error', () => {
    expect(() => validateDenoPermissions(['not-a-flag'])).toThrow(/not-a-flag/);
  });

  it('reports the first invalid value when multiple are configured', () => {
    expect(() => validateDenoPermissions(['--allow-write', 'bogus'])).toThrow(/bogus/);
  });
});
