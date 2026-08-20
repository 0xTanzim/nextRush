/**
 * @nextrush/errors - CapabilityNotInitializedError Tests
 *
 * Locked behavior for the "middleware-provided capability used before
 * activation" diagnostic (RFC-034): code, status, expose flag, and the
 * four-part WHAT / WHY / HOW / WHERE message shape.
 */

import { describe, expect, it } from 'vitest';
import { NextRushError } from '../base';
import { CapabilityNotInitializedError } from '../capability';

describe('CapabilityNotInitializedError', () => {
  it('extends NextRushError', () => {
    const error = new CapabilityNotInitializedError('cookies', 'register cookies()');
    expect(error).toBeInstanceOf(NextRushError);
    expect(error).toBeInstanceOf(Error);
  });

  it('sets status 500 and expose false regardless of inputs', () => {
    const error = new CapabilityNotInitializedError('cookies', 'register cookies()');
    expect(error.status).toBe(500);
    expect(error.expose).toBe(false);
  });

  it('derives the code from the capability name', () => {
    const error = new CapabilityNotInitializedError('cookies', 'register cookies()');
    expect(error.code).toBe('COOKIES_NOT_INITIALIZED');
  });

  it('keeps the capability name available for structured handling', () => {
    const error = new CapabilityNotInitializedError('cookies', 'register cookies()');
    expect(error.capability).toBe('cookies');
  });

  it('message answers WHAT, WHY, HOW, and WHERE', () => {
    const error = new CapabilityNotInitializedError(
      'cookies',
      'import { cookies } from \'@nextrush/cookies\';\napp.use(cookies());'
    );
    expect(error.message).toContain('cookies'); // WHAT / which capability
    expect(error.message).toContain('not initialized'); // WHY
    expect(error.message).toContain('app.use(cookies())'); // HOW
    expect(error.message).toContain('docs/reference/cookies'); // WHERE
  });

  it('never exposes the diagnostic to clients when serialized', () => {
    const error = new CapabilityNotInitializedError('cookies', 'secret install detail');
    const json = error.toJSON();
    expect(json.message).toBe('Internal Server Error');
    expect(json.code).toBe('COOKIES_NOT_INITIALIZED');
  });
});
