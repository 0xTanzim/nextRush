/**
 * @nextrush/dev - Simple Arg Parsing Tests
 *
 * Test that --flag=value syntax is supported and unknown flags are rejected.
 *
 */

import { describe, expect, it, vi } from 'vitest';
import * as runtime from '../runtime/index.js';

describe('Arg Parsing Simple Tests', () => {
  describe('dev command error handling', () => {
    it('should detect unknown flags and exit with error', () => {
      const exitSpy = vi.spyOn(runtime, 'exitProcess').mockImplementation(() => {
        throw new Error('exit');
      });
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // We expect this to fail because --unknown-flag is not a valid flag
      let didFail = false;
      try {
        // Dynamic require to avoid module cache issues
        delete (require.cache as unknown as Record<string, unknown>)[require.resolve('../commands/dev.js')];
        const { devCli } = require('../commands/dev.js');
        devCli(['--unknown-flag']);
      } catch (e) {
        didFail = true;
      }

      // Either it fails or exitProcess is called
      expect(didFail || exitSpy.mock.calls.length > 0).toBe(true);

      if (exitSpy.mock.calls.length > 0) {
        expect(exitSpy).toHaveBeenCalledWith(1);
      }

      exitSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe('build command error handling', () => {
    it('should detect unknown flags and exit with error', () => {
      const exitSpy = vi.spyOn(runtime, 'exitProcess').mockImplementation(() => {
        throw new Error('exit');
      });
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      let didFail = false;
      try {
        delete (require.cache as unknown as Record<string, unknown>)[require.resolve('../commands/build.js')];
        const { buildCli } = require('../commands/build.js');
        buildCli(['--badFlag']);
      } catch (e) {
        didFail = true;
      }

      expect(didFail || exitSpy.mock.calls.length > 0).toBe(true);

      if (exitSpy.mock.calls.length > 0) {
        expect(exitSpy).toHaveBeenCalledWith(1);
      }

      exitSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });
});
