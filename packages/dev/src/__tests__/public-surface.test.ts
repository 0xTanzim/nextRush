/**
 * @nextrush/dev - Public API surface test
 *
 * Locks the exported symbol set from `src/index.ts`. If this test fails, the
 * public API has changed. Intentional changes require an explicit update to
 * the expected list below, plus a changeset for a published package.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as devApi from '../index';
import { GENERATOR_TYPES } from '../index';
import type { BuildOptions, DevOptions, GeneratorType, NextRushConfig, Runtime, RuntimeInfo } from '../index';

describe('Public API surface (runtime exports)', () => {
  it('exports exactly the intended runtime symbols', () => {
    const actualExports = Object.keys(devApi).sort();

    // SEALED: intentional public runtime API surface.
    const expectedRuntime = [
      'cli',
      'legacyDevCli',
      'build',
      'buildCli',
      'buildHelp',
      'dev',
      'devCli',
      'devHelp',
      'detectRuntime',
      'getRuntimeExecutable',
      'getRuntimeInfo',
      'isBun',
      'isDeno',
      'isNode',
      'findEntry',
      'getDefaultWatchPaths',
      'loadConfig',
      'GENERATOR_TYPES',
      'generate',
      'generateAdapter',
      'generateCli',
      'generateHelp',
    ].sort();

    expect(actualExports).toEqual(expectedRuntime);
    expect(typeof GENERATOR_TYPES === 'object' || Array.isArray(GENERATOR_TYPES)).toBe(true);
  });
});

describe('Public API surface (type-only exports)', () => {
  it('the type-only surface stays importable from the barrel', () => {
    // Compile-time only: removing/renaming any of these in src/index.ts fails
    // this file to type-check.
    type Surface = [BuildOptions, DevOptions, Runtime, RuntimeInfo, NextRushConfig, GeneratorType];
    expectTypeOf<Surface>().not.toBeNever();
  });
});
