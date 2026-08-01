/**
 * @nextrush/errors - Audit Remediation Tests
 *
 * Covers audit findings E-2 (cause serialization), E-3/E-4 (factory↔class code
 * consistency + central registry), and E-6 (immutability).
 */

import { describe, expect, it } from 'vitest';
import { HttpError, NextRushError } from '../base';
import { ERROR_CODES, codeForStatus } from '../codes';
import { createError } from '../factory';
import {
  BadRequestError,
  GoneError,
  InternalServerError,
  NotFoundError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
} from '../http-errors';
import { ValidationError } from '../validation';

// ---------------------------------------------------------------------------
// E-3 / E-4 — factory returns the correctly-coded typed class; central registry
// ---------------------------------------------------------------------------

describe('E-3: createError returns the correctly-coded typed class', () => {
  it('createError(413) is a PayloadTooLargeError with code PAYLOAD_TOO_LARGE (not HTTP_413)', () => {
    const error = createError(413);
    expect(error).toBeInstanceOf(PayloadTooLargeError);
    expect(error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('createError(415) is an UnsupportedMediaTypeError', () => {
    expect(createError(415)).toBeInstanceOf(UnsupportedMediaTypeError);
    expect(createError(415).code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('createError(410) is a GoneError', () => {
    expect(createError(410)).toBeInstanceOf(GoneError);
  });

  it('createError(status).code equals the direct class code for every registry status', () => {
    for (const key of Object.keys(ERROR_CODES)) {
      const status = Number(key);
      // 405 has a divergent constructor signature; asserted separately.
      if (status === 405) continue;
      expect(createError(status).code).toBe(ERROR_CODES[status]);
    }
  });

  it('still falls back to a generic HttpError for a status with no dedicated class', () => {
    const error = createError(499);
    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(499);
    expect(error.code).toBe('HTTP_499');
  });
});

describe('E-4: central code registry is the single source of truth', () => {
  it('codeForStatus resolves canonical codes and falls back to HTTP_<status>', () => {
    expect(codeForStatus(404)).toBe('NOT_FOUND');
    expect(codeForStatus(413)).toBe('PAYLOAD_TOO_LARGE');
    expect(codeForStatus(499)).toBe('HTTP_499');
  });

  it('a direct HttpError uses the canonical code from the registry', () => {
    expect(new HttpError(404).code).toBe('NOT_FOUND');
    expect(new HttpError(413).code).toBe('PAYLOAD_TOO_LARGE');
  });
});

// ---------------------------------------------------------------------------
// E-2 — cause chain serialization (expose-gated, depth + cycle guarded)
// ---------------------------------------------------------------------------

describe('E-2: cause is serialized for exposed errors', () => {
  it('includes a serialized cause on an exposed error', () => {
    const cause = new Error('database offline');
    const error = new BadRequestError('bad input', { cause });
    const json = error.toJSON();
    expect(json.cause).toMatchObject({ name: 'Error', message: 'database offline' });
  });

  it('propagates cause to the native Error so runtime tooling sees the chain', () => {
    const cause = new Error('root');
    const error = new BadRequestError('bad', { cause });
    // Native Error.cause must be the same reference.
    expect((error as Error).cause).toBe(cause);
  });

  it('does NOT leak cause on a non-exposed (5xx) error', () => {
    const cause = new Error('secret internal detail');
    const error = new InternalServerError('boom', { cause });
    expect(error.toJSON().cause).toBeUndefined();
  });

  it('serializes a nested cause chain', () => {
    const root = new Error('root failure');
    const mid = new NextRushError('mid failure', { status: 400, cause: root });
    const top = new NextRushError('top failure', { status: 400, cause: mid });
    const json = top.toJSON();
    const c1 = json.cause as { message: string; cause?: { message: string } };
    expect(c1.message).toBe('mid failure');
    expect(c1.cause?.message).toBe('root failure');
  });

  it('does not infinite-loop on a cyclic cause chain', () => {
    const a = new Error('a') as Error & { cause?: unknown };
    const b = new Error('b') as Error & { cause?: unknown };
    a.cause = b;
    b.cause = a;
    const error = new NextRushError('c', { status: 400, cause: a });
    expect(() => error.toJSON()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// E-6 — immutability of details and validation issues
// ---------------------------------------------------------------------------

describe('E-6: error details and validation issues are frozen', () => {
  it('freezes details at construction', () => {
    const error = new BadRequestError('x', { details: { field: 'email' } });
    expect(Object.isFrozen(error.details)).toBe(true);
    expect(() => {
      (error.details as Record<string, unknown>).field = 'mutated';
    }).toThrow(TypeError);
  });

  it('freezes ValidationError.issues at construction', () => {
    const error = new ValidationError([{ path: 'email', message: 'required' }]);
    expect(Object.isFrozen(error.issues)).toBe(true);
    expect(() => {
      (error.issues as unknown[]).push({ path: 'x', message: 'y' });
    }).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// E-5 — correlation / trace identity
// ---------------------------------------------------------------------------

describe('E-5: errors carry optional correlation identity', () => {
  it('stores requestId/traceId and surfaces them in toJSON when set', () => {
    const error = new BadRequestError('x', { requestId: 'req-1', traceId: 'trace-1' });
    expect(error.requestId).toBe('req-1');
    expect(error.traceId).toBe('trace-1');
    const json = error.toJSON();
    expect(json.requestId).toBe('req-1');
    expect(json.traceId).toBe('trace-1');
  });

  it('omits identity fields from toJSON when not set (no shape change by default)', () => {
    const json = new BadRequestError('x').toJSON();
    expect('requestId' in json).toBe(false);
    expect('traceId' in json).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// E-7 — deserialization / wire round-trip
// ---------------------------------------------------------------------------

describe('E-7: HttpError.fromJSON reconstructs across a boundary', () => {
  it('round-trips status, code, message, and details', () => {
    const original = new NotFoundError('missing', { details: { id: 7 } });
    const restored = HttpError.fromJSON(original.toJSON());
    expect(restored).toBeInstanceOf(HttpError);
    expect(restored).toBeInstanceOf(NextRushError);
    expect(restored.status).toBe(404);
    expect(restored.code).toBe('NOT_FOUND');
    expect(restored.message).toBe('missing');
    expect(restored.details).toEqual({ id: 7 });
  });

  it('restores correlation identity when present', () => {
    const original = new BadRequestError('bad', { requestId: 'r-9' });
    const restored = HttpError.fromJSON(original.toJSON());
    expect(restored.requestId).toBe('r-9');
  });
});
