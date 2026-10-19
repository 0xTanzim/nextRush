/**
 * @nextrush/core - the default error body's `code` is the client-error contract
 *
 * A parser error carries a machine-readable code (`INVALID_JSON`,
 * `UNSUPPORTED_CONTENT_TYPE`, `ENTITY_TOO_LARGE`, …) and the default handler
 * used to discard it, labelling every non-`NextRushError` as `INTERNAL_ERROR` —
 * so a 400 read to a client like a server fault and no client could branch on
 * the failure. A 5xx body must stay exactly as it was: the code and the message
 * of an internal failure are not for clients.
 */

import { createError } from '@nextrush/errors';
import { describe, expect, it, vi } from 'vitest';
import { writeDefaultErrorResponse } from '../error-handler';
import { createMockContext } from './_shared/create-mock-context';

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

function bodyFor(error: Error, isProduction = false): Record<string, unknown> {
  const ctx = createMockContext();
  writeDefaultErrorResponse(error, ctx, { logger, isProduction });
  const json = ctx.json as unknown as { mock: { calls: unknown[][] } };
  return json.mock.calls[0]?.[0] as Record<string, unknown>;
}

describe("the default error body carries the error's own code", () => {
  it("keeps a client parser error's code, message and status", () => {
    const error = Object.assign(new Error('Invalid JSON'), {
      name: 'BodyParserError',
      status: 400,
      code: 'INVALID_JSON',
    });

    expect(bodyFor(error)).toEqual({
      error: 'BodyParserError',
      message: 'Invalid JSON',
      code: 'INVALID_JSON',
      status: 400,
    });
  });

  it('preserves any other client-error code rather than relabelling it', () => {
    const error = Object.assign(new Error('Unsupported content type: "application/xml"'), {
      name: 'BodyParserError',
      status: 415,
      code: 'UNSUPPORTED_CONTENT_TYPE',
    });

    expect(bodyFor(error).code).toBe('UNSUPPORTED_CONTENT_TYPE');
  });

  it("derives the status's canonical code when the error carries none", () => {
    const notFound = Object.assign(new Error('no such file'), { status: 404 });
    expect(bodyFor(notFound).code).toBe('NOT_FOUND');
  });

  it('leaves a 5xx body byte-identical, with code and message both masked', () => {
    const error = Object.assign(new Error('relation "users" does not exist'), {
      status: 503,
      code: 'DB_DOWN',
    });

    expect(bodyFor(error)).toEqual({
      error: 'Service Unavailable',
      message: 'Internal Server Error',
      code: 'INTERNAL_ERROR',
      status: 503,
    });
  });

  it('still serializes a NextRushError through its own toJSON()', () => {
    const error = createError(404, 'Not here');
    expect(bodyFor(error)).toEqual(error.toJSON());
  });
});
