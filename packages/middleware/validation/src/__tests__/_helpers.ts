/**
 * Shared test helpers for @nextrush/validation.
 *
 * Not a test file (no `.test`/`.spec` suffix) and excluded from coverage, so it
 * is never collected as a suite. Keeps a single hand-written fake Standard
 * Schema — proving the package couples only to the interface, never to Zod.
 */

import { ValidationError } from '@nextrush/errors';
import type { Context, Next } from '@nextrush/types';
import type { StandardSchemaResult, StandardSchemaV1 } from '@nextrush/types';

/** Build a hand-written Standard Schema from a validate() implementation. */
export function fake<T>(
  validateFn: (value: unknown) => StandardSchemaResult<T> | Promise<StandardSchemaResult<T>>
): StandardSchemaV1<unknown, T> {
  return { '~standard': { version: 1, vendor: 'test', validate: validateFn } };
}

/** Minimal Context stub carrying only what the validation middleware touches. */
export function mockCtx(
  init: { body?: unknown; query?: Record<string, unknown>; params?: Record<string, string> } = {}
): Context {
  return {
    body: init.body,
    query: init.query ?? {},
    params: init.params ?? {},
  } as unknown as Context;
}

/** A `next` that records whether the downstream chain was reached. */
export function tracker(): { next: Next; called: () => boolean } {
  let count = 0;
  return { next: async () => void count++, called: () => count > 0 };
}

/** Await a promise expected to reject with ValidationError; return that error. */
export async function catchErr(promise: Promise<unknown>): Promise<ValidationError> {
  try {
    await promise;
    throw new Error('expected the call to throw, but it resolved');
  } catch (err) {
    if (!(err instanceof ValidationError)) throw err;
    return err;
  }
}
