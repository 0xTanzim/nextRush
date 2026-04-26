/**
 * @nextrush/dev - Logger Utilities Tests
 *
 * Unit tests for logger utilities.
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    formatDuration,
    formatSize,
} from '../utils/logger.js';

describe('Logger Utilities', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('formatDuration', () => {
    it('should format milliseconds correctly', () => {
      expect(formatDuration(500)).toBe('500ms');
    });

    it('should format seconds correctly', () => {
      expect(formatDuration(1500)).toBe('1.50s');
    });

    it('should format large durations correctly', () => {
      expect(formatDuration(65000)).toBe('65.00s');
    });

    it('should handle zero', () => {
      expect(formatDuration(0)).toBe('0ms');
    });
  });

  describe('formatSize', () => {
    it('should format bytes correctly', () => {
      expect(formatSize(500)).toBe('500 B');
    });

    it('should format kilobytes correctly', () => {
      const size = formatSize(2048);
      expect(size).toBe('2.0 KB');
    });

    it('should format megabytes correctly', () => {
      const size = formatSize(2 * 1024 * 1024);
      expect(size).toBe('2.00 MB');
    });

    it('should handle zero', () => {
      expect(formatSize(0)).toBe('0 B');
    });
  });
});
