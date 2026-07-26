/** @nextrush/dev - Logger Utilities Tests */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDuration } from '../utils/logger.js';

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

});
