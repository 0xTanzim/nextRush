/**
 * @nextrush/runtime - Uninitialized Cookie Capability Stubs (RFC-034)
 *
 * The `ctx.cookies` property always exists on a Context; before the
 * `cookies()` middleware runs it references these frozen, process-shared
 * stubs. Property access is safe; invoking any operation throws
 * `CapabilityNotInitializedError` with the four-part diagnostic.
 */

import { describe, expect, it } from 'vitest';
import { CapabilityNotInitializedError } from '@nextrush/errors';
import { UNINITIALIZED_COOKIES, UNINITIALIZED_SIGNED_COOKIES } from '../capabilities';

describe('UNINITIALIZED_COOKIES', () => {
  it('property access does not throw', () => {
    expect(() => UNINITIALIZED_COOKIES).not.toThrow();
    expect(UNINITIALIZED_COOKIES).toBeTypeOf('object');
  });

  it('every plain operation throws COOKIES_NOT_INITIALIZED', () => {
    for (const invoke of [
      () => UNINITIALIZED_COOKIES.get('a'),
      () => UNINITIALIZED_COOKIES.set('a', 'b'),
      () => UNINITIALIZED_COOKIES.delete('a'),
      () => UNINITIALIZED_COOKIES.all(),
      () => UNINITIALIZED_COOKIES.has('a'),
    ]) {
      expect(invoke).toThrow(CapabilityNotInitializedError);
      try {
        invoke();
      } catch (error) {
        expect((error as CapabilityNotInitializedError).code).toBe('COOKIES_NOT_INITIALIZED');
        expect((error as CapabilityNotInitializedError).capability).toBe('cookies');
      }
    }
  });

  it('every signed operation throws SIGNED_COOKIES_NOT_INITIALIZED', () => {
    for (const invoke of [
      () => UNINITIALIZED_COOKIES.signed.get('a'),
      () => UNINITIALIZED_COOKIES.signed.set('a', 'b'),
      () => UNINITIALIZED_COOKIES.signed.delete('a'),
    ]) {
      expect(invoke).toThrow(CapabilityNotInitializedError);
    }
    expect(() => UNINITIALIZED_COOKIES.signed.get('a')).toThrowError(
      expect.objectContaining({ code: 'SIGNED_COOKIES_NOT_INITIALIZED' })
    );
  });

  it('the diagnostic message contains WHAT, WHY, HOW, WHERE', () => {
    try {
      UNINITIALIZED_COOKIES.get('session');
      throw new Error('unreachable');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('cookies');
      expect(message).toContain('not initialized');
      expect(message).toContain('app.use(cookies())');
      expect(message).toContain('docs/reference/cookies');
    }
  });

  it('is frozen and process-shared', () => {
    expect(Object.isFrozen(UNINITIALIZED_COOKIES)).toBe(true);
    expect(UNINITIALIZED_COOKIES.signed).toBe(UNINITIALIZED_SIGNED_COOKIES);
    // Shared singleton: repeated access returns the same object identity.
    expect(UNINITIALIZED_COOKIES).toBe(UNINITIALIZED_COOKIES);
  });

  it('async signed operations reject (they are sync-throwing here)', () => {
    // The stub throws synchronously, which is the strictest contract: any
    // caller awaiting the promise would have rejected too.
    expect(() => UNINITIALIZED_COOKIES.signed.get('a')).toThrow(CapabilityNotInitializedError);
  });
});
