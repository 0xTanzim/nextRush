/**
 * @nextrush/static - Public API surface test
 *
 * Locks the exported symbol set from `src/index.ts`. If this test fails, the
 * public API has changed. Intentional changes require an explicit update to
 * the expected list below, plus a changeset for a published package.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as staticApi from '../index';
import type { DotfilesPolicy, NodeContext, NodeMiddleware, NormalizedStaticOptions, RangeResult, StaticContext, StaticOptions, StatsLike } from '../index';

describe('Public API surface (runtime exports)', () => {
  it('exports exactly the intended runtime symbols', () => {
    const actualExports = Object.keys(staticApi).sort();

    // SEALED: intentional public runtime API surface.
    const expectedRuntime = [
      'generateETag',
      'getMimeType',
      'isDotfile',
      'isFresh',
      'normalizePrefix',
      'parseRange',
      'safeJoin',
      'statSafe',
      'stripPrefix',
      'sendFile',
      'serveStatic',
      'staticFiles',
      'createSendFile',
    ].sort();

    expect(actualExports).toEqual(expectedRuntime);
  });
});

describe('Public API surface (type-only exports)', () => {
  it('the type-only surface stays importable from the barrel', () => {
    // Compile-time only: removing/renaming any of these in src/index.ts fails
    // this file to type-check.
    type Surface = [DotfilesPolicy, NodeContext, NodeMiddleware, NormalizedStaticOptions, RangeResult, StaticContext, StaticOptions, StatsLike];
    expectTypeOf<Surface>().not.toBeNever();
  });
});
