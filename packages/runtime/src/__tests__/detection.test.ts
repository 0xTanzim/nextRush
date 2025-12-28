/**
 * @nextrush/runtime - Runtime Detection Tests
 *
 * @packageDocumentation
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  detectRuntime,
  getRuntime,
  getRuntimeCapabilities,
  getRuntimeInfo,
  getRuntimeVersion,
  isBun,
  isDeno,
  isEdge,
  isNode,
  isRuntime,
  resetRuntimeCache,
} from '../detection.js';

describe('Runtime Detection', () => {
  // Reset cache before each test
  beforeEach(() => {
    resetRuntimeCache();
  });

  describe('detectRuntime', () => {
    it('should detect Node.js runtime', () => {
      // In test environment (Node.js), should return 'node'
      const runtime = detectRuntime();
      expect(runtime).toBe('node');
    });

    it('should return consistent results', () => {
      const result1 = detectRuntime();
      const result2 = detectRuntime();
      expect(result1).toBe(result2);
    });
  });

  describe('getRuntime', () => {
    it('should cache runtime detection result', () => {
      const result1 = getRuntime();
      const result2 = getRuntime();
      expect(result1).toBe(result2);
    });

    it('should return node in test environment', () => {
      expect(getRuntime()).toBe('node');
    });
  });

  describe('getRuntimeVersion', () => {
    it('should return Node.js version string', () => {
      const version = getRuntimeVersion();
      expect(version).toBeDefined();
      expect(typeof version).toBe('string');
      // Node.js version format: major.minor.patch
      expect(version).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe('getRuntimeCapabilities', () => {
    it('should return capabilities object', () => {
      const caps = getRuntimeCapabilities();

      expect(caps).toBeDefined();
      expect(typeof caps.nodeStreams).toBe('boolean');
      expect(typeof caps.webStreams).toBe('boolean');
      expect(typeof caps.fileSystem).toBe('boolean');
      expect(typeof caps.webSocket).toBe('boolean');
      expect(typeof caps.fetch).toBe('boolean');
      expect(typeof caps.cryptoSubtle).toBe('boolean');
      expect(typeof caps.workers).toBe('boolean');
    });

    it('should return Node.js capabilities in test environment', () => {
      const caps = getRuntimeCapabilities();

      expect(caps.nodeStreams).toBe(true);
      expect(caps.webStreams).toBe(true);
      expect(caps.fileSystem).toBe(true);
      expect(caps.fetch).toBe(true);
    });
  });

  describe('getRuntimeInfo', () => {
    it('should return complete runtime information', () => {
      const info = getRuntimeInfo();

      expect(info).toBeDefined();
      expect(info.runtime).toBe('node');
      expect(info.version).toBeDefined();
      expect(info.capabilities).toBeDefined();
    });

    it('should have consistent structure', () => {
      const info = getRuntimeInfo();

      expect(Object.keys(info)).toContain('runtime');
      expect(Object.keys(info)).toContain('version');
      expect(Object.keys(info)).toContain('capabilities');
    });
  });

  describe('isRuntime', () => {
    it('should return true for current runtime', () => {
      expect(isRuntime('node')).toBe(true);
    });

    it('should return false for other runtimes', () => {
      expect(isRuntime('bun')).toBe(false);
      expect(isRuntime('deno')).toBe(false);
      expect(isRuntime('edge')).toBe(false);
    });
  });

  describe('Runtime helper functions', () => {
    it('isNode should return true in test environment', () => {
      expect(isNode()).toBe(true);
    });

    it('isBun should return false in Node.js', () => {
      expect(isBun()).toBe(false);
    });

    it('isDeno should return false in Node.js', () => {
      expect(isDeno()).toBe(false);
    });

    it('isEdge should return false in Node.js', () => {
      expect(isEdge()).toBe(false);
    });
  });

  describe('resetRuntimeCache', () => {
    it('should reset cached runtime', () => {
      // Get initial value (cached)
      const initial = getRuntime();

      // Reset cache
      resetRuntimeCache();

      // Should re-detect (same result in this case)
      const afterReset = getRuntime();
      expect(afterReset).toBe(initial);
    });
  });
});

describe('Runtime Detection Edge Cases', () => {
  beforeEach(() => {
    resetRuntimeCache();
  });

  it('should handle multiple capability checks', () => {
    const caps1 = getRuntimeCapabilities();
    const caps2 = getRuntimeCapabilities();

    // Should return equivalent capabilities
    expect(caps1.nodeStreams).toBe(caps2.nodeStreams);
    expect(caps1.webStreams).toBe(caps2.webStreams);
  });

  it('should return valid runtime type', () => {
    const runtime = getRuntime();
    const validRuntimes = [
      'node',
      'bun',
      'deno',
      'cloudflare-workers',
      'vercel-edge',
      'edge',
      'unknown',
    ];

    expect(validRuntimes).toContain(runtime);
  });
});
