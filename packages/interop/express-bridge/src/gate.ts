/**
 * @nextrush/express-bridge - Node-shaped raw-HTTP gate
 *
 * The bridge runs only when `ctx.raw` structurally matches Node's
 * `IncomingMessage` / `ServerResponse`. This is decided purely from the shape,
 * never from `ctx.runtime` (AGENTS.md §7: behavior is negotiated by
 * capabilities, not runtime identity).
 *
 * @packageDocumentation
 */

import { ExpressBridgeCapabilityError } from './errors';

/**
 * Structural shape the gate requires of `ctx.raw.res` for a Node-shaped pair.
 */
interface NodeShapedRes {
  setHeader?: unknown;
  end?: unknown;
  headersSent?: unknown;
}

/**
 * Return whether `raw` is structurally Node-shaped.
 *
 * Web-shaped raw (`{ req: Request, res: undefined }`) fails because `res` is
 * `undefined` and `Request` has no EventEmitter-style `on`.
 */
export function isNodeShapedRaw(raw: unknown): boolean {
  const pair = raw as { req?: { on?: unknown }; res?: NodeShapedRes } | null | undefined;
  const req = pair?.req;
  const res = pair?.res;
  return (
    req != null &&
    typeof req.on === 'function' &&
    res != null &&
    typeof res.setHeader === 'function' &&
    typeof res.end === 'function' &&
    typeof res.headersSent === 'boolean'
  );
}

/**
 * Assert that `ctx.raw` is Node-shaped, throwing an actionable error otherwise.
 *
 * Reads only the `raw` shape; never reads `ctx.runtime`.
 */
export function assertNodeShapedRaw(raw: unknown): void {
  if (!isNodeShapedRaw(raw)) {
    throw new ExpressBridgeCapabilityError();
  }
}
