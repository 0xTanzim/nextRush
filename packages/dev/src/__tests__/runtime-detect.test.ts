/**
 * @nextrush/dev - Runtime Detection Tests
 *
 * Unit tests for runtime detection utilities.
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { detectRuntime, getRuntimeInfo, isBun, isDeno, isNode } from '../runtime/detect.js';

describe('Runtime Detection', () => {
  let originalBun: unknown;
  let originalDeno: unknown;
  let originalProcess: NodeJS.Process | undefined;

  beforeEach(() => {
    // Save original globals
    originalBun = (globalThis as Record<string, unknown>).Bun;
    originalDeno = (globalThis as Record<string, unknown>).Deno;
    originalProcess = globalThis.process;
  });

  afterEach(() => {
    // Restore original globals
    (globalThis as Record<string, unknown>).Bun = originalBun;
    (globalThis as Record<string, unknown>).Deno = originalDeno;
    if (originalProcess) {
      globalThis.process = originalProcess;
    }
    vi.resetModules();
  });

  describe('detectRuntime', () => {
    it('should detect node runtime by default', () => {
      // In Node.js test environment, Bun and Deno should not exist
      delete (globalThis as Record<string, unknown>).Bun;
      delete (globalThis as Record<string, unknown>).Deno;

      const runtime = detectRuntime();
      expect(runtime).toBe('node');
    });

    it('should detect bun runtime when Bun global exists', () => {
      (globalThis as Record<string, unknown>).Bun = { version: '1.0.0' };
      delete (globalThis as Record<string, unknown>).Deno;

      const runtime = detectRuntime();
      expect(runtime).toBe('bun');
    });

    it('should detect deno runtime when Deno global exists', () => {
      delete (globalThis as Record<string, unknown>).Bun;
      (globalThis as Record<string, unknown>).Deno = { version: { deno: '2.0.0' } };

      const runtime = detectRuntime();
      expect(runtime).toBe('deno');
    });

    it('should prioritize bun over node', () => {
      // When both Bun and process exist, Bun should be detected
      (globalThis as Record<string, unknown>).Bun = { version: '1.0.0' };
      delete (globalThis as Record<string, unknown>).Deno;

      const runtime = detectRuntime();
      expect(runtime).toBe('bun');
    });

    it('should prioritize deno over node', () => {
      // When both Deno and process exist, Deno should be detected
      delete (globalThis as Record<string, unknown>).Bun;
      (globalThis as Record<string, unknown>).Deno = { version: { deno: '2.0.0' } };

      const runtime = detectRuntime();
      expect(runtime).toBe('deno');
    });
  });

  describe('isNode', () => {
    it('should return true in node environment', () => {
      delete (globalThis as Record<string, unknown>).Bun;
      delete (globalThis as Record<string, unknown>).Deno;

      expect(isNode()).toBe(true);
    });

    it('should return false when Bun exists', () => {
      (globalThis as Record<string, unknown>).Bun = { version: '1.0.0' };
      delete (globalThis as Record<string, unknown>).Deno;

      expect(isNode()).toBe(false);
    });
  });

  describe('isBun', () => {
    it('should return false in node environment', () => {
      delete (globalThis as Record<string, unknown>).Bun;
      delete (globalThis as Record<string, unknown>).Deno;

      expect(isBun()).toBe(false);
    });

    it('should return true when Bun exists', () => {
      (globalThis as Record<string, unknown>).Bun = { version: '1.0.0' };
      delete (globalThis as Record<string, unknown>).Deno;

      expect(isBun()).toBe(true);
    });
  });

  describe('isDeno', () => {
    it('should return false in node environment', () => {
      delete (globalThis as Record<string, unknown>).Bun;
      delete (globalThis as Record<string, unknown>).Deno;

      expect(isDeno()).toBe(false);
    });

    it('should return true when Deno exists', () => {
      delete (globalThis as Record<string, unknown>).Bun;
      (globalThis as Record<string, unknown>).Deno = { version: { deno: '2.0.0' } };

      expect(isDeno()).toBe(true);
    });
  });

  describe('getRuntimeInfo', () => {
    it('should return runtime info for node', () => {
      delete (globalThis as Record<string, unknown>).Bun;
      delete (globalThis as Record<string, unknown>).Deno;

      const info = getRuntimeInfo();
      expect(info.runtime).toBe('node');
      expect(typeof info.version).toBe('string');
      expect(info.version.length).toBeGreaterThan(0);
    });

    it('should indicate node needs SWC for TypeScript', () => {
      delete (globalThis as Record<string, unknown>).Bun;
      delete (globalThis as Record<string, unknown>).Deno;

      const info = getRuntimeInfo();
      expect(info.needsSwc).toBe(true);
    });

    it('should indicate bun does not need SWC', () => {
      (globalThis as Record<string, unknown>).Bun = { version: '1.0.0' };
      delete (globalThis as Record<string, unknown>).Deno;

      const info = getRuntimeInfo();
      expect(info.needsSwc).toBe(false);
    });

    it('should indicate deno does not need SWC', () => {
      delete (globalThis as Record<string, unknown>).Bun;
      (globalThis as Record<string, unknown>).Deno = { version: { deno: '2.0.0' } };

      const info = getRuntimeInfo();
      expect(info.needsSwc).toBe(false);
    });
  });
});
