/**
 * @nextrush/dev - Deno Permissions Tests
 *
 * Tests for configurable Deno permissions in buildDevArgs.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';
import { buildDevArgs } from '../runtime/spawn.js';

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
  });

  describe('custom permissions', () => {
    it('should use custom permissions when provided', () => {
      const customPerms = ['--allow-all'];
      const result = buildDevArgs('deno', 'src/index.ts', [], false, undefined, customPerms);

      expect(result.args).toContain('--allow-all');
      expect(result.args).not.toContain('--allow-net');
      expect(result.args).not.toContain('--allow-read');
      expect(result.args).not.toContain('--allow-env');
    });

    it('should preserve watch with custom permissions', () => {
      const customPerms = ['--allow-sys', '--allow-write'];
      const result = buildDevArgs('deno', 'src/index.ts', ['./src'], false, undefined, customPerms);

      expect(result.args).toContain('--allow-sys');
      expect(result.args).toContain('--allow-write');
      expect(result.args.some((arg) => arg.startsWith('--watch'))).toBe(true);
    });

    it('should handle empty custom permissions array', () => {
      const customPerms: string[] = [];
      const result = buildDevArgs('deno', 'src/index.ts', [], false, undefined, customPerms);

      // Should have: run, --watch, entry + no permissions
      const allowArgs = result.args.filter((arg) => arg.startsWith('--allow'));
      expect(allowArgs).toHaveLength(0);
      expect(result.args).toContain('run');
      expect(result.args).toContain('--watch');
      expect(result.args).toContain('src/index.ts');
    });

    it('should maintain arg order with custom permissions', () => {
      const customPerms = ['--allow-net', '--allow-write'];
      const result = buildDevArgs('deno', 'src/index.ts', [], false, undefined, customPerms);

      const runIdx = result.args.indexOf('run');
      const watchIdx = result.args.indexOf('--watch');
      const permIdx = result.args.findIndex((arg) => arg.startsWith('--allow'));
      const entryIdx = result.args.indexOf('src/index.ts');

      expect(runIdx).toBeLessThan(watchIdx);
      expect(watchIdx).toBeLessThan(permIdx);
      expect(permIdx).toBeLessThan(entryIdx);
    });

    it('should add custom permissions to options for future extension', () => {
      const customPerms = ['--allow-ffi', '--allow-write=./dist'];
      const result = buildDevArgs('deno', 'src/index.ts', [], false, undefined, customPerms);

      expect(result.args).toContain('--allow-ffi');
      expect(result.args).toContain('--allow-write=./dist');
    });
  });

  describe('integration with inspect', () => {
    it('should include inspect with custom permissions', () => {
      const customPerms = ['--allow-all'];
      const result = buildDevArgs('deno', 'src/index.ts', [], true, 9230, customPerms);

      expect(result.args).toContain('--allow-all');
      expect(result.args.some((arg) => arg.includes('9230'))).toBe(true);
    });
  });
});
