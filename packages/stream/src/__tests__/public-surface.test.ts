/**
 * @nextrush/stream - Public API surface test
 *
 * Locks the exported symbol set from `src/index.ts`. If this test fails, the
 * public API has changed. Intentional changes require an explicit update to
 * the expected list below, plus a changeset for a published package.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as streamApi from '../index';
import type { BaseStreamWriter, NDJSONStreamWriter, SSEEvent, SSEStreamWriter, StreamCapableContext, StreamRun, StreamSource, TextStreamWriter } from '../index';

describe('Public API surface (runtime exports)', () => {
  it('exports exactly the intended runtime symbols', () => {
    const actualExports = Object.keys(streamApi).sort();

    // SEALED: intentional public runtime API surface.
    const expectedRuntime = [
      'StreamAbortedError',
      'formatSSE',
      'StreamController',
      'runNDJSONStream',
      'runSSEStream',
      'runTextStream',
      'NDJSONWriter',
      'SSEWriter',
      'TextWriter',
    ].sort();

    expect(actualExports).toEqual(expectedRuntime);
  });
});

describe('Public API surface (type-only exports)', () => {
  it('the type-only surface stays importable from the barrel', () => {
    // Compile-time only: removing/renaming any of these in src/index.ts fails
    // this file to type-check.
    type Surface = [StreamCapableContext, BaseStreamWriter, NDJSONStreamWriter, SSEEvent, SSEStreamWriter, StreamRun, StreamSource, TextStreamWriter];
    expectTypeOf<Surface>().not.toBeNever();
  });
});
