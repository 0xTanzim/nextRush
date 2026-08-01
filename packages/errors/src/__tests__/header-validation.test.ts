/**
 * @nextrush/errors - HeaderValidationError tests
 */

import { describe, expect, it } from 'vitest';
import { NextRushError } from '../base';
import { HeaderValidationError } from '../header-validation';

describe('HeaderValidationError', () => {
  it('carries the given message', () => {
    const error = new HeaderValidationError('Header field contains invalid characters');

    expect(error.message).toBe('Header field contains invalid characters');
  });

  it('is a 500-class, non-exposed error with the HEADER_VALIDATION_ERROR code', () => {
    const error = new HeaderValidationError('bad header');

    expect(error.status).toBe(500);
    expect(error.code).toBe('HEADER_VALIDATION_ERROR');
    expect(error.expose).toBe(false);
  });

  it('is an instanceof NextRushError and Error', () => {
    const error = new HeaderValidationError('bad header');

    expect(error).toBeInstanceOf(NextRushError);
    expect(error).toBeInstanceOf(Error);
  });

  it('sets name to HeaderValidationError', () => {
    const error = new HeaderValidationError('bad header');

    expect(error.name).toBe('HeaderValidationError');
  });

  it('does not expose the raw message via toJSON, matching a non-exposed error contract', () => {
    const error = new HeaderValidationError('internal detail: X-Bad\\r\\nInjected');
    const json = error.toJSON();

    expect(json.message).not.toBe('internal detail: X-Bad\\r\\nInjected');
  });
});
