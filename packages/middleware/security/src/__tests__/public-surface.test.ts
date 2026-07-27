/**
 * @nextrush/security - Public API surface test
 *
 * Locks the exported symbol set from `src/index.ts`.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as securityApi from '../index';
import type { SecurityPresetOptions } from '../index';

describe('Public API surface (runtime exports)', () => {
  it('exports exactly the intended runtime symbols', () => {
    const actualExports = Object.keys(securityApi).sort();

    const expectedRuntime = ['security'].sort();

    expect(actualExports).toEqual(expectedRuntime);
    expect(typeof securityApi.security).toBe('function');
  });
});

describe('Public API surface (type-only exports)', () => {
  it('the type-only surface stays importable from the barrel', () => {
    type Surface = [SecurityPresetOptions];
    expectTypeOf<Surface>().not.toBeNever();
  });
});
