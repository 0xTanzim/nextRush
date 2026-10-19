/**
 * @nextrush/errors - `errorHandler()` and the shared code derivation
 *
 * `errorHandler()` used to build the code from the error type alone: anything
 * that was not an `HttpError`/`NextRushError` became `INTERNAL_ERROR`, and a
 * plain error carrying a `status` was reported as 500. Both surfaces now go
 * through `resolveErrorCode` + `getErrorStatus`, so this asserts the middleware
 * agrees with the shared derivation rather than repeating today's behavior.
 */

import type { Context } from '@nextrush/types';
import { describe, expect, it, vi } from 'vitest';
import { resolveErrorCode } from '../codes';
import { getErrorStatus } from '../factory';
import { errorHandler } from '../middleware';

function createMockContext(): Context {
  return {
    method: 'GET',
    url: '/test',
    path: '/test',
    query: {},
    headers: {},
    ip: '127.0.0.1',
    body: undefined,
    params: {},
    status: 200,
    json: vi.fn(),
    send: vi.fn(),
    html: vi.fn(),
    redirect: vi.fn(),
    set: vi.fn(),
    get: vi.fn(),
    next: vi.fn().mockResolvedValue(undefined),
    state: {},
    responded: false,
    raw: { req: {} as never, res: {} as never },
  } as unknown as Context;
}

async function handle(error: Error): Promise<Record<string, unknown>> {
  const ctx = createMockContext();
  await errorHandler()(ctx, async () => {
    throw error;
  });
  const json = ctx.json as unknown as { mock: { calls: unknown[][] } };
  return json.mock.calls[0]?.[0] as Record<string, unknown>;
}

const parserError = Object.assign(new Error('Invalid JSON'), {
  name: 'BodyParserError',
  status: 400,
  code: 'INVALID_JSON',
});
const statusOnly = Object.assign(new Error('no such file'), { status: 404 });
const internal = Object.assign(new Error('relation "users" does not exist'), {
  status: 503,
  code: 'DB_DOWN',
});

describe('errorHandler derives the code through the shared contract', () => {
  it('reports each error with the code the contract resolves', async () => {
    for (const error of [parserError, statusOnly, internal]) {
      const body = await handle(error);
      expect(body.code).toBe(resolveErrorCode(error, getErrorStatus(error)));
    }
  });

  it('keeps a client parser error code and its status', async () => {
    const body = await handle(parserError);
    expect(body).toEqual({
      error: 'BodyParserError',
      message: 'Invalid JSON',
      code: 'INVALID_JSON',
      status: 400,
    });
  });

  it('derives NOT_FOUND for a plain error that only carries a 404 status', async () => {
    const body = await handle(statusOnly);
    expect(body.status).toBe(404);
    expect(body.code).toBe('NOT_FOUND');
  });

  it('masks a 5xx code and message', async () => {
    const body = await handle(internal);
    expect(body).toEqual({
      error: 'Service Unavailable',
      message: 'Internal Server Error',
      code: 'INTERNAL_ERROR',
      status: 503,
    });
  });
});
