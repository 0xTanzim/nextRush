/**
 * Shared helpers for the conformance spec files.
 *
 * @packageDocumentation
 */

import type { DispatchResult } from './drivers/types';

/** Parse a JSON response body into a caller-asserted type. */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- T is the caller-supplied assertion type (test-ergonomic alias for `as T`)
export function json<T>(result: DispatchResult): T {
  return JSON.parse(result.text()) as T;
}
