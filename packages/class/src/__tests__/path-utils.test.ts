/**
 * @nextrush/decorators - Path Utility Tests
 *
 * Characterizes the two historically-divergent normalization behaviors that
 * were previously duplicated in class.ts (strips trailing slash) and routes.ts
 * (does not). Both must be preserved by the shared helper.
 */

import { describe, expect, it } from 'vitest';
import { normalizePath } from '../path-utils.js';

describe('normalizePath', () => {
  it('adds a leading slash when missing', () => {
    expect(normalizePath('users')).toBe('/users');
  });

  it('preserves an existing leading slash', () => {
    expect(normalizePath('/users')).toBe('/users');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizePath('  users  ')).toBe('/users');
  });

  it('preserves a trailing slash by default (route decorator behavior)', () => {
    expect(normalizePath('/users/')).toBe('/users/');
  });

  it('strips a trailing slash when stripTrailingSlash is set (controller behavior)', () => {
    expect(normalizePath('/users/', { stripTrailingSlash: true })).toBe('/users');
  });

  it('keeps root "/" intact even with stripTrailingSlash', () => {
    expect(normalizePath('/', { stripTrailingSlash: true })).toBe('/');
  });
});
