/** @nextrush/dev - Process Spawn Tests */

import { describe, expect, it } from 'vitest';
import { buildDevArgs, toDenoStdio } from '../runtime/spawn.js';

describe('toDenoStdio', () => {
  // Regression coverage for the bug found fixing this file's ESLint `any`-typing debt:
  // this package's own `SpawnOptions.stdio` vocabulary (`inherit`/`pipe`/`ignore`,
  // matching Node's `child_process`) was passed straight through to Deno's `Command`,
  // which uses different literals (`inherit`/`piped`/`null`). `'pipe'` is not a valid
  // Deno stdio value — this went undetected while `globalThis.Deno` was typed `any`.
  it('maps this package\'s "pipe" to Deno\'s "piped"', () => {
    expect(toDenoStdio('pipe')).toBe('piped');
  });

  it('maps this package\'s "ignore" to Deno\'s "null"', () => {
    expect(toDenoStdio('ignore')).toBe('null');
  });

  it('passes "inherit" through unchanged (same literal on both sides)', () => {
    expect(toDenoStdio('inherit')).toBe('inherit');
  });

  it('defaults to "inherit" when stdio is undefined', () => {
    expect(toDenoStdio(undefined)).toBe('inherit');
  });
});

describe('Process Spawning', () => {
  describe('buildDevArgs', () => {
    it('should return node command with SWC loader for node runtime', () => {
      const result = buildDevArgs('node', 'src/index.ts', []);

      expect(result.command).toBe('node');
      expect(Array.isArray(result.args)).toBe(true);
      expect(result.args.length).toBeGreaterThan(0);
    });

    it('should include --import with loader path for node runtime', () => {
      const result = buildDevArgs('node', 'src/index.ts', []);

      const importIndex = result.args.indexOf('--import');
      expect(importIndex).toBeGreaterThanOrEqual(0);

      const loaderPath = result.args[importIndex + 1];
      expect(loaderPath).toBeDefined();

      // Should be either a file:// URL or the npm package fallback
      if (loaderPath) {
        expect(
          loaderPath.startsWith('file://') || loaderPath === '@swc-node/register/esm-register'
        ).toBe(true);
      }
    });

    it('should include --watch for node runtime', () => {
      const result = buildDevArgs('node', 'src/index.ts', []);
      expect(result.args).toContain('--watch');
    });

    it('should include entry file in args', () => {
      const entryFile = 'src/server.ts';
      const result = buildDevArgs('node', entryFile, []);

      expect(result.args).toContain(entryFile);
    });

    it('should include inspect port when provided', () => {
      const result = buildDevArgs('node', 'src/index.ts', [], true, 9230);

      const inspectArg = result.args.find((arg) => arg.includes('--inspect'));
      expect(inspectArg).toBeDefined();
      expect(inspectArg).toContain('9230');
    });

    it('should use default inspect port 9229 when not provided', () => {
      const result = buildDevArgs('node', 'src/index.ts', [], true);

      const inspectArg = result.args.find((arg) => arg.includes('--inspect'));
      expect(inspectArg).toBeDefined();
      expect(inspectArg).toContain('9229');
    });

    it('should handle bun runtime', () => {
      const result = buildDevArgs('bun', 'src/index.ts', []);

      expect(result.command).toBe('bun');
      expect(result.args).toContain('--watch');
      expect(result.args).toContain('src/index.ts');
    });

    it('should handle deno runtime', () => {
      const result = buildDevArgs('deno', 'src/index.ts', []);

      expect(result.command).toBe('deno');
      expect(result.args).toContain('run');
      expect(result.args).toContain('--watch');
      expect(result.args).toContain('--allow-net');
      expect(result.args).toContain('src/index.ts');
    });

    it('should not include inspect args when inspect is false', () => {
      const result = buildDevArgs('node', 'src/index.ts', [], false);

      const inspectArg = result.args.find((arg) => arg.includes('--inspect'));
      expect(inspectArg).toBeUndefined();
    });
  });
});
