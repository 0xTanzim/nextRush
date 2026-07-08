/**
 * @nextrush/dev - Watch Paths Tests
 *
 * Tests for runtime-specific watch path handling in buildDevArgs.
 *
 * @packageDocumentation
 */

import { describe, expect, it, vi } from 'vitest';
import { buildDevArgs } from '../runtime/spawn.js';

describe('buildDevArgs - Watch Paths', () => {
  describe('node runtime', () => {
    it('should use --watch-path for each explicit path', () => {
      const result = buildDevArgs('node', 'src/index.ts', ['./src', './config']);

      expect(result.command).toBe('node');
      expect(result.args).toContain('--watch-path=./src');
      expect(result.args).toContain('--watch-path=./config');
      expect(result.args).not.toContain('--watch');
    });

    it('should use bare --watch when no paths given', () => {
      const result = buildDevArgs('node', 'src/index.ts', []);

      expect(result.command).toBe('node');
      expect(result.args).toContain('--watch');
      expect(result.args.some((arg) => arg.startsWith('--watch-path'))).toBe(false);
    });

    it('should include entry file with watch paths', () => {
      const result = buildDevArgs('node', 'src/app.ts', ['./src', './lib']);

      expect(result.args).toContain('src/app.ts');
      expect(result.args).toContain('--watch-path=./src');
      expect(result.args).toContain('--watch-path=./lib');
    });

    it('should maintain order: --import, --watch-path(s), entry', () => {
      const result = buildDevArgs('node', 'src/index.ts', ['./src']);

      const importIdx = result.args.indexOf('--import');
      const watchIdx = result.args.findIndex((arg) => arg.startsWith('--watch-path'));
      const entryIdx = result.args.indexOf('src/index.ts');

      expect(importIdx).toBeGreaterThanOrEqual(0);
      expect(watchIdx).toBeGreaterThan(importIdx);
      expect(entryIdx).toBeGreaterThan(watchIdx);
    });

    it('should handle single watch path', () => {
      const result = buildDevArgs('node', 'src/index.ts', ['./src']);

      expect(result.args).toContain('--watch-path=./src');
      expect(result.args.filter((arg) => arg.startsWith('--watch-path')).length).toBe(1);
    });

    it('should preserve inspect flag with watch paths', () => {
      const result = buildDevArgs('node', 'src/index.ts', ['./src', './config'], true, 9230);

      expect(result.args).toContain('--inspect=9230');
      expect(result.args).toContain('--watch-path=./src');
      expect(result.args).toContain('--watch-path=./config');
    });
  });

  describe('deno runtime', () => {
    it('should use --watch=comma-separated when paths given', () => {
      const result = buildDevArgs('deno', 'src/index.ts', ['./src', './config']);

      expect(result.command).toBe('deno');
      const watchArg = result.args.find((arg) => arg.startsWith('--watch'));
      expect(watchArg).toBe('--watch=./src,./config');
    });

    it('should use bare --watch when no paths given', () => {
      const result = buildDevArgs('deno', 'src/index.ts', []);

      expect(result.command).toBe('deno');
      expect(result.args).toContain('--watch');
      expect(result.args.filter((arg) => arg.startsWith('--watch')).length).toBe(1);
    });

    it('should include entry file with watch argument', () => {
      const result = buildDevArgs('deno', 'src/app.ts', ['./src', './lib']);

      const watchArg = result.args.find((arg) => arg.startsWith('--watch'));
      expect(watchArg).toBe('--watch=./src,./lib');
      expect(result.args).toContain('src/app.ts');
    });

    it('should maintain permissions in args', () => {
      const result = buildDevArgs('deno', 'src/index.ts', ['./src']);

      expect(result.args).toContain('--allow-net');
      expect(result.args).toContain('--allow-read');
      expect(result.args).toContain('--allow-env');
    });

    it('should handle single watch path', () => {
      const result = buildDevArgs('deno', 'src/index.ts', ['./src']);

      const watchArg = result.args.find((arg) => arg.startsWith('--watch'));
      expect(watchArg).toBe('--watch=./src');
    });

    it('should preserve inspect with watch paths', () => {
      const result = buildDevArgs('deno', 'src/index.ts', ['./src'], true, 9230);

      const watchArg = result.args.find((arg) => arg.startsWith('--watch'));
      expect(watchArg).toBe('--watch=./src');
      expect(result.args.some((arg) => arg.includes('9230'))).toBe(true);
    });
  });

  describe('bun runtime', () => {
    it('should call onWarnUnsupported callback when paths given', () => {
      const warnCallback = vi.fn();

      const result = buildDevArgs('bun', 'src/index.ts', ['./src', './config'], false, undefined, undefined, warnCallback);

      expect(result.command).toBe('bun');
      expect(result.args).toContain('--watch');
      expect(result.args.filter((arg) => arg.startsWith('--watch')).length).toBe(1);
      expect(warnCallback).toHaveBeenCalledOnce();
    });

    it('should not call onWarnUnsupported callback when no paths given', () => {
      const warnCallback = vi.fn();

      const result = buildDevArgs('bun', 'src/index.ts', [], false, undefined, undefined, warnCallback);

      expect(result.command).toBe('bun');
      expect(result.args).toContain('--watch');
      expect(warnCallback).not.toHaveBeenCalled();
    });

    it('should include entry file', () => {
      const result = buildDevArgs('bun', 'src/app.ts', ['./src']);

      expect(result.args).toContain('src/app.ts');
    });

    it('should preserve inspect flag with bun', () => {
      const result = buildDevArgs('bun', 'src/index.ts', ['./src'], true, 9230);

      expect(result.args).toContain('--watch');
      expect(result.args.some((arg) => arg.includes('9230'))).toBe(true);
    });
  });

  describe('watch argument format validation', () => {
    it('node: paths should be prefixed with --watch-path=', () => {
      const result = buildDevArgs('node', 'src/index.ts', ['./src', './lib', './config']);

      const watchArgs = result.args.filter((arg) => arg.startsWith('--watch-path'));
      expect(watchArgs).toHaveLength(3);
      expect(watchArgs).toEqual(['--watch-path=./src', '--watch-path=./lib', '--watch-path=./config']);
    });

    it('deno: paths should be comma-separated in single --watch arg', () => {
      const result = buildDevArgs('deno', 'src/index.ts', ['./src', './lib', './config']);

      const watchArgs = result.args.filter((arg) => arg.startsWith('--watch'));
      expect(watchArgs).toHaveLength(1);
      expect(watchArgs[0]).toBe('--watch=./src,./lib,./config');
    });
  });
});
