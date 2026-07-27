/**
 * @nextrush/cors - direct unit tests for header utilities
 *
 * Most of `headers.ts` is exercised indirectly through the `cors()`
 * middleware integration tests in `cors.test.ts`. This file adds direct
 * unit coverage for the small exported utilities that middleware-level
 * integration tests never happened to hit (wildcard/dedup branches in
 * `appendVary`, `buildMethodList`, `headerContains`) — a pre-existing gap
 * found while verifying package coverage for this workstream, not a
 * SEC-10-17 behavior change.
 */
import type { Context } from '@nextrush/types';
import { describe, expect, it, vi } from 'vitest';
import { appendVary, buildMethodList, headerContains } from '../headers';

function createVaryContext(): { ctx: Context; set: ReturnType<typeof vi.fn> } {
  const set = vi.fn();
  const ctx = { set } as unknown as Context;
  return { ctx, set };
}

describe('appendVary', () => {
  it('does nothing once the tracked set already contains a wildcard', () => {
    const { ctx, set } = createVaryContext();

    appendVary(ctx, '*');
    set.mockClear();
    appendVary(ctx, 'Origin');

    expect(set).not.toHaveBeenCalled();
  });

  it('skips a case-insensitive duplicate without re-setting the header', () => {
    const { ctx, set } = createVaryContext();

    appendVary(ctx, 'Origin');
    set.mockClear();
    appendVary(ctx, 'origin');

    expect(set).not.toHaveBeenCalled();
  });
});

describe('buildMethodList', () => {
  it('uppercases a comma-separated string as-is', () => {
    expect(buildMethodList('get,post,put')).toBe('GET,POST,PUT');
  });

  it('uppercases and joins an array of methods', () => {
    expect(buildMethodList(['get', 'post'])).toBe('GET,POST');
  });
});

describe('headerContains', () => {
  it('returns false for an undefined header value', () => {
    expect(headerContains(undefined, 'post')).toBe(false);
  });

  it('finds an item case-insensitively among comma-separated values', () => {
    expect(headerContains('GET, POST, PUT', 'post')).toBe(true);
  });

  it('returns false when the item is not present', () => {
    expect(headerContains('Origin', 'Referer')).toBe(false);
  });
});
