/**
 * @nextrush/dev - Node Modules Loader Tests
 *
 * Unit tests for SWC loader resolution.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';
import { resolveLoaderFromUrl } from '../runtime/node-modules.js';

describe('Node Modules Loader Resolution', () => {
  describe('resolveLoaderFromUrl', () => {
    it('should resolve to npm package when not in dist', () => {
      const src = 'file:///home/u/pkg/src/runtime/node-modules.ts';
      const result = resolveLoaderFromUrl(src);
      expect(result).toBe('@swc-node/register/esm-register');
    });

    it('should resolve to file:// URL for posix dist location', () => {
      const posixDist = 'file:///home/u/pkg/dist/runtime/node-modules.js';
      const result = resolveLoaderFromUrl(posixDist);

      // Must be a valid file:// URL
      expect(result).toMatch(/^file:\/\//);

      // Must end with dist/loaders/swc-loader.mjs
      expect(result).toContain('/dist/loaders/swc-loader.mjs');

      // CRITICAL: no /C:/ corruption (Windows path artifact)
      expect(result).not.toContain('/C:/');
    });

    it('should resolve to file:// URL for windows dist location', () => {
      const windowsDist = 'file:///C:/Users/u/pkg/dist/runtime/node-modules.js';
      const result = resolveLoaderFromUrl(windowsDist);

      // Must be a valid file:// URL
      expect(result).toMatch(/^file:\/\//);

      // Must end with dist/loaders/swc-loader.mjs
      expect(result).toContain('/dist/loaders/swc-loader.mjs');

      // CRITICAL: file:///C:/ is CORRECT Windows URL form
      // The old bug was doing .replace('file://','') which left invalid /C:/... path
      // Now we use URL constructor which properly preserves it as file:///C:/
      expect(result).toMatch(/file:\/\/\/C:/);

      // Should be parseable as valid URL
      expect(() => {
        new URL(result);
      }).not.toThrow();
    });

    it('should produce identical results for identical paths across platforms', () => {
      const posixDist = 'file:///home/user/nextrush/dist/runtime/node-modules.js';
      const windowsDist = 'file:///C:/Users/user/nextrush/dist/runtime/node-modules.js';

      const posixResult = resolveLoaderFromUrl(posixDist);
      const windowsResult = resolveLoaderFromUrl(windowsDist);

      // Both should resolve to file:// URLs ending in swc-loader.mjs
      expect(posixResult).toMatch(/^file:\/\//);
      expect(windowsResult).toMatch(/^file:\/\//);

      expect(posixResult).toContain('/dist/loaders/swc-loader.mjs');
      expect(windowsResult).toContain('/dist/loaders/swc-loader.mjs');

      // Both should be valid URLs parseable by the URL constructor
      expect(() => {
        new URL(posixResult);
      }).not.toThrow();
      expect(() => {
        new URL(windowsResult);
      }).not.toThrow();

      // Windows should have file:///C:/ form (correct)
      expect(windowsResult).toMatch(/file:\/\/\/C:/);
    });

    it('should maintain file:// scheme validity for node --import', () => {
      // node --import expects a valid URL that can be parsed
      const windowsDist = 'file:///C:/Users/nextrush/dist/runtime/node-modules.js';
      const result = resolveLoaderFromUrl(windowsDist);

      // Should be parseable as URL (no exception)
      expect(() => {
        new URL(result);
      }).not.toThrow();

      // The parsed URL should have file: scheme
      const parsed = new URL(result);
      expect(parsed.protocol).toBe('file:');
    });
  });
});
