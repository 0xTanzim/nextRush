/**
 * @nextrush/express-bridge - Public types
 *
 * The Express/Connect middleware contract wrapped by {@link compat}.
 *
 * `req` / `res` are deliberately `unknown` at the boundary: the bridge hands
 * foreign middleware a `Proxy`, and TypeScript-shape compatibility is not the
 * same as semantic compatibility (RFC-035 §8.1).
 *
 * @packageDocumentation
 */

/**
 * Connect/Express 3-arity middleware.
 *
 * The bridge does not import `express`. 3-arity `(req, res, next)` is the
 * normative contract; 2-arity and 0/1-arity functions are P0-gated and are
 * never treated as normative.
 */
export type ExpressMiddleware = (
  req: unknown,
  res: unknown,
  next: ExpressNext
) => unknown;

/**
 * Express `next` continuation. Accepts an optional error (or the special
 * `'route'` / `'router'` strings, which the bridge treats as unsupported).
 */
export type ExpressNext = (err?: unknown) => void;
