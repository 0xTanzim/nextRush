/**
 * @nextrush/runtime - The framework's last-resort error response body
 *
 * When the error path itself fails to produce a response, both adapter families
 * answer through this one envelope, so the last resort cannot drift between
 * them: Node's response finalizer and the Web response builder emit
 * byte-identical bodies, matching the 404/500 bodies the adapters already write.
 *
 * @packageDocumentation
 */

import { getHttpStatusMessage } from '@nextrush/errors';

/**
 * The lowest status treated as an error by the last resort.
 *
 * @remarks
 * A response with a success status and no body is a *documented empty response*
 * (a handler that resolved without responding), not a failure to answer, so it
 * is left alone. An error status with nothing written is always a failure to
 * answer — the client is waiting for an explanation that never came.
 */
export const LAST_RESORT_ERROR_STATUS = 400;

/**
 * The body for an error status that reached finalization with nothing written.
 *
 * @param status - The error status the response would carry.
 * @returns The framework's error envelope, `{ error: <status message> }`.
 */
export function unansweredErrorBody(status: number): { error: string } {
  return { error: getHttpStatusMessage(status) };
}
