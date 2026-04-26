/**
 * @nextrush/dev - Config Utilities Tests
 *
 * Unit tests for configuration utilities.
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from '../runtime/fs.js';
import { findEntry, getDefaultWatchPaths } from '../utils/config.js';

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
});
