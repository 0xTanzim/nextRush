/**
 * @nextrush/errors - the client-error code contract
 *
 * One derivation, shared by `@nextrush/core`'s default error response and this
 * package's `errorHandler()`: a client error keeps its own machine-readable
 * code, an error without one gets its status's canonical code, and a server
 * error never tells the client what it was.
 */

import { describe, expect, it } from 'vitest';
import { codeForStatus, resolveErrorCode } from '../codes';

describe('resolveErrorCode', () => {
  it("keeps a client error's own code", () => {
    expect(resolveErrorCode({ code: 'INVALID_JSON' }, 400)).toBe('INVALID_JSON');
    expect(resolveErrorCode({ code: 'UNSUPPORTED_CONTENT_TYPE' }, 415)).toBe(
      'UNSUPPORTED_CONTENT_TYPE'
    );
    expect(resolveErrorCode({ code: 'ENTITY_TOO_LARGE' }, 413)).toBe('ENTITY_TOO_LARGE');
  });

  it("derives the status's canonical code when the error carries none", () => {
    expect(resolveErrorCode(new Error('gone'), 404)).toBe('NOT_FOUND');
    expect(resolveErrorCode(new Error('bad'), 400)).toBe('BAD_REQUEST');
  });

  it('never reflects an internal error code to the client', () => {
    expect(resolveErrorCode({ code: 'DB_POOL_EXHAUSTED' }, 503)).toBe('INTERNAL_ERROR');
    expect(resolveErrorCode({ code: 'DB_POOL_EXHAUSTED' }, 500)).toBe('INTERNAL_ERROR');
  });

  it('ignores a code that is not a non-empty string', () => {
    expect(resolveErrorCode({ code: 42 }, 409)).toBe('CONFLICT');
    expect(resolveErrorCode({ code: '' }, 409)).toBe('CONFLICT');
    expect(resolveErrorCode({}, 409)).toBe('CONFLICT');
  });

  it('falls back to HTTP_<status> for a status with no canonical code', () => {
    expect(codeForStatus(499)).toBe('HTTP_499');
    expect(resolveErrorCode(new Error('teapot'), 499)).toBe('HTTP_499');
  });
});
