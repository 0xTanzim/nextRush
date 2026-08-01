/**
 * nextrush - Public API Audit Remediation Tests (N-4)
 *
 * The SDK must expose the error-model capabilities its own model provides:
 * the code registry, codeForStatus, and ValidationError.
 */

import { describe, expect, it } from 'vitest';
import { ERROR_CODES, HttpError, ValidationError, codeForStatus } from '../index';

describe('N-4: SDK exposes the error-model capabilities', () => {
  it('exposes the ERROR_CODES registry and codeForStatus', () => {
    expect(codeForStatus(404)).toBe('NOT_FOUND');
    expect(ERROR_CODES[413]).toBe('PAYLOAD_TOO_LARGE');
  });

  it('exposes ValidationError', () => {
    const err = new ValidationError([{ path: 'email', message: 'required' }]);
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
  });

  it('HttpError.fromJSON is reachable for cross-boundary reconstruction', () => {
    const wire = new HttpError(404, 'nope').toJSON();
    const restored = HttpError.fromJSON(wire);
    expect(restored).toBeInstanceOf(HttpError);
    expect(restored.status).toBe(404);
  });
});
