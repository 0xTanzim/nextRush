/**
 * @nextrush/dev - Config Utilities Tests
 *
 * Unit tests for configuration utilities.
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from '../runtime/fs.js';
import { findEntry, getDefaultWatchPaths, validateDecoratorConfig } from '../utils/config.js';

// Mock the fs module
vi.mock('../runtime/fs.js', () => ({
  existsSync: vi.fn(),
  getCwd: vi.fn(() => '/test/cwd'),
  resolvePath: vi.fn((...paths: string[]) => paths.join('/')),
  joinPath: vi.fn((...paths: string[]) => paths.join('/')),
  readFileSync: vi.fn(() => JSON.stringify({})),
}));

describe('Config Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('findEntry', () => {
    it('should find src/index.ts if it exists', () => {
      vi.mocked(fs.existsSync).mockImplementation((path: string) => {
        return path.includes('src/index.ts');
      });

      const entry = findEntry();
      expect(entry).toBe('src/index.ts');
    });

    it('should find src/main.ts if index.ts does not exist', () => {
      vi.mocked(fs.existsSync).mockImplementation((path: string) => {
        return path.includes('src/main.ts');
      });

      const entry = findEntry();
      expect(entry).toBe('src/main.ts');
    });

    it('should find index.ts in root if src files do not exist', () => {
      vi.mocked(fs.existsSync).mockImplementation((path: string) => {
        return path.endsWith('/test/cwd/index.ts');
      });

      const entry = findEntry();
      expect(entry).toBe('index.ts');
    });

    it('should return src/index.ts as default if nothing found', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const entry = findEntry();
      expect(entry).toBe('src/index.ts');
    });
  });

  describe('getDefaultWatchPaths', () => {
    it('should return [src] when src directory exists', () => {
      vi.mocked(fs.existsSync).mockImplementation((path: string) => {
        return path.includes('src');
      });

      const paths = getDefaultWatchPaths();
      expect(paths).toEqual(['src']);
    });

    it('should return [.] when src directory does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const paths = getDefaultWatchPaths();
      expect(paths).toEqual(['.']);
    });
  });

  describe('validateDecoratorConfig', () => {
    it('should return no warnings when both decorator options are omitted (functional scaffold)', () => {
      vi.mocked(fs.existsSync).mockImplementation((path: string) => path.includes('tsconfig.json'));
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          compilerOptions: {
            strict: true,
            target: 'ES2022',
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
          },
        })
      );

      expect(validateDecoratorConfig()).toEqual([]);
    });

    it('should return no warnings when both decorator options are true', () => {
      vi.mocked(fs.existsSync).mockImplementation((path: string) => path.includes('tsconfig.json'));
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          compilerOptions: {
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
          },
        })
      );

      expect(validateDecoratorConfig()).toEqual([]);
    });

    it('should warn when experimentalDecorators is true but emitDecoratorMetadata is missing', () => {
      vi.mocked(fs.existsSync).mockImplementation((path: string) => path.includes('tsconfig.json'));
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          compilerOptions: {
            experimentalDecorators: true,
          },
        })
      );

      const out = validateDecoratorConfig();
      expect(out.length).toBeGreaterThanOrEqual(1);
      expect(out.some((line) => line.includes('emitDecoratorMetadata'))).toBe(true);
    });

    it('should warn when emitDecoratorMetadata is true but experimentalDecorators is missing', () => {
      vi.mocked(fs.existsSync).mockImplementation((path: string) => path.includes('tsconfig.json'));
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          compilerOptions: {
            emitDecoratorMetadata: true,
          },
        })
      );

      const out = validateDecoratorConfig();
      expect(out.some((line) => line.includes('experimentalDecorators'))).toBe(true);
    });

    it('should warn when tsconfig.json is missing', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const out = validateDecoratorConfig();
      expect(out.some((line) => line.includes('No tsconfig.json'))).toBe(true);
    });
  });
});
