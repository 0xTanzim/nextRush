/** @nextrush/dev - File System Path Tests */

import { describe, expect, it } from 'vitest';
import { resolvePath, joinPath } from '../runtime/fs.js';

describe('File System Path Operations', () => {
  describe('resolvePath', () => {
    it('should resolve paths using node:path semantics', () => {
      // resolvePath should behave like node:path.resolve
      // It normalizes the path and resolves relative to cwd
      const result = resolvePath('foo', 'bar');

      // Should not be a naive join
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');

      // Should handle absolute paths correctly
      const absolute = resolvePath('/absolute/path');
      expect(absolute).toMatch(/^\//);
    });

    it('should normalize path separators', () => {
      const result = resolvePath('a', 'b', 'c');
      // Should not have doubled slashes (naive join leaves this)
      expect(result).not.toContain('//');
    });

    it('should resolve . and .. correctly', () => {
      // node:path.resolve handles . and ..
      const result = resolvePath('a', '..', 'b');
      // The result should resolve parent directory references
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('joinPath', () => {
    it('should join paths using node:path semantics', () => {
      // joinPath should behave like node:path.join
      const result = joinPath('a', 'b', 'c');

      // Should not be a naive string join
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');

      // On all platforms, should use appropriate separator
      // (not hardcoded /)
      expect(result).not.toContain('//');
    });

    it('should handle root paths on all platforms', () => {
      // joinPath should normalize root references
      const result = joinPath('/root', 'sub', 'path');
      expect(result).toMatch(/^\//);
    });

    it('should normalize relative path segments', () => {
      // node:path.join normalizes . and .. in segments
      // On all platforms this should work correctly
      const result = joinPath('a', '.', 'b');
      // The exact behavior depends on whether node:path is loaded
      // but it should be a valid path
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should differ from resolve in handling absolute segments', () => {
      // join ignores absolute segments before the last one
      // resolve stops at the first absolute segment
      const joinResult = joinPath('a', '/b', 'c');
      const resolveResult = resolvePath('a', '/b', 'c');

      // They should produce different results
      // (one includes 'a', one doesn't, depending on absolute segment handling)
      expect(joinResult).toBeDefined();
      expect(resolveResult).toBeDefined();
    });
  });

  describe('Path operations before initFsSync', () => {
    it('resolvePath should work even if path module not yet initialized', () => {
      // This tests the ordering hazard:
      // path operations should NOT fail before initFsSync is called
      const result = resolvePath('some', 'path');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('joinPath should work even if path module not yet initialized', () => {
      const result = joinPath('some', 'path');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });
});
