/**
 * @nextrush/express-bridge - Opt-in Express/Connect middleware compatibility
 *
 * Wraps a stable external execution contract — Connect/Express 3-arity
 * `(req, res, next)` — as a NextRush `Middleware`, without putting Express in
 * core, without claiming Edge portability, and with a test-backed
 * compatibility registry.
 *
 * @packageDocumentation
 */

export { compat } from './compat';

export {
  ExpressBridgeArityError,
  ExpressBridgeCapabilityError,
  ExpressBridgeProtocolError,
  UnsupportedExpressApiError,
} from './errors';

export type { ExpressMiddleware, ExpressNext } from './types';
