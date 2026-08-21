/**
 * @nextrush/express-bridge - Bridge error classes
 *
 * Every bridge failure is a {@link NextRushError} subclass with a stable
 * `code`, `status: 500`, and `expose: false` — install/fix text is a
 * developer aid and must never serialize to a client response.
 *
 * @packageDocumentation
 */

import { NextRushError } from '@nextrush/errors';

/** The docs anchor for the compatibility surface. */
const SURFACE_DOCS = 'https://nextrush.dev/docs/reference/express-bridge#surface';

/**
 * Thrown when `compat()` runs against a context whose `ctx.raw` is not
 * Node-shaped HTTP (IncomingMessage-like `req` + ServerResponse-like `res`).
 */
export class ExpressBridgeCapabilityError extends NextRushError {
  constructor() {
    super(
      '@nextrush/express-bridge cannot run on this request.\n\n' +
        'What happened:\n' +
        '  compat() received a context whose ctx.raw is not Node-shaped HTTP\n' +
        '  (IncomingMessage-like req + ServerResponse-like res).\n\n' +
        'Why:\n' +
        '  Express/Connect middleware is a Node HTTP contract. This adapter\n' +
        '  exposes Web-shaped raw HTTP ({ req: Request, res: undefined }),\n' +
        '  which is what Edge / serverless fetch / WebContextBase use.\n\n' +
        'How to fix:\n' +
        '  1. Prefer a native NextRush package (e.g. app.use(cors()) from\n' +
        '     @nextrush/cors, app.use(helmet()) from @nextrush/helmet).\n' +
        '  2. If you need this Express package, run the app on\n' +
        '     @nextrush/adapter-node (or any adapter that exposes Node-shaped\n' +
        '     ctx.raw).\n' +
        '  3. See the compatibility registry for packages that are Full/Partial.\n\n' +
        `Docs: ${SURFACE_DOCS}`,
      { status: 500, code: 'EXPRESS_BRIDGE_WRONG_RAW', expose: false }
    );
  }
}

/**
 * Thrown at `compat()` registration time for an array or a 4+-arity function
 * (Express error middleware), or a non-function value.
 */
export class ExpressBridgeArityError extends NextRushError {
  constructor(kind: 'array' | 'error-middleware' | 'not-a-function') {
    const why =
      kind === 'array'
        ? 'You passed an array of middleware.'
        : kind === 'not-a-function'
          ? 'You passed a value that is not a function.'
          : 'You passed a function with 4 or more parameters (Express error middleware).';

    super(
      'compat() wraps one function. The v1 normative contract is 3-arity\n' +
        '(req, res, next); 2-arity is P0-gated and terminal-only; 0/1-arity is\n' +
        'P0-gated. Arrays and 4+-arity error middleware are rejected.\n\n' +
        'What happened:\n' +
        `  ${why}\n\n` +
        'Why:\n' +
        '  NextRush already has Application.setErrorHandler and class exception\n' +
        '  filters. Emulating (err, req, res, next) would fork that pipeline.\n' +
        '  Arrays are not auto-flattened — that would be magic.\n\n' +
        'How to fix:\n' +
        '  Use app.setErrorHandler((err, ctx) => { ... }) for app-level errors.\n' +
        '  If a package returned an array of middleware, map it:\n' +
        '    for (const fn of mwArray) app.use(compat(fn));\n' +
        '  If this function is actually 3-arity, bind it so .length is 3\n' +
        '  or wrap it: compat((req, res, next) => fn(req, res, next)).\n' +
        '  If a native NextRush package exists (e.g. helmet → @nextrush/helmet),\n' +
        '  use that instead.',
      {
        status: 500,
        code:
          kind === 'not-a-function'
            ? 'EXPRESS_BRIDGE_NOT_A_FUNCTION'
            : 'EXPRESS_BRIDGE_ERROR_MIDDLEWARE',
        expose: false,
      }
    );
  }
}

/**
 * Thrown when a thenable-returning middleware fulfills while continuation is
 * still `idle` and the response was not committed (the async/`next()` footgun).
 */
export class ExpressBridgeProtocolError extends NextRushError {
  constructor() {
    super(
      '[express-bridge] middleware neither called next() nor finished the response.\n\n' +
        'What happened:\n' +
        '  The wrapped function returned a thenable that fulfilled while\n' +
        '  continuation was still idle and the response was not committed.\n\n' +
        'Why:\n' +
        '  Accidental `async (req, res, next) => { await work; }` with no next()\n' +
        '  is the Express 5 / async footgun. Failing closed is safer than hanging.\n\n' +
        'How to fix:\n' +
        '  Call next() after the async work, or send a response (res.json/res.send)\n' +
        '  and do not call next(). Classic callback-style middleware that returns\n' +
        '  undefined is not this error — it is Express continuation.',
      { status: 500, code: 'EXPRESS_BRIDGE_HANGING', expose: false }
    );
  }
}

/**
 * Thrown when wrapped middleware touches a known-unsupported Express prototype
 * API that the bridge deliberately does not implement.
 */
export class UnsupportedExpressApiError extends NextRushError {
  constructor(api: string) {
    super(
      `Unsupported Express API: ${api}\n\n` +
        'What happened:\n' +
        `  The wrapped middleware read ${api}, which is not on the v1\n` +
        '  compatibility surface.\n\n' +
        'Why:\n' +
        '  The bridge implements a measured minimum surface, not Express.\n\n' +
        'How to fix:\n' +
        '  1. Check the compatibility registry for this package\'s level.\n' +
        '  2. If you needed content negotiation, handle it in NextRush\n' +
        '     middleware via ctx.get(\'Accept\').\n' +
        '  3. If this package is on the native-overlap list, use the\n' +
        '     first-party package instead.\n\n' +
        `Docs: ${SURFACE_DOCS}`,
      { status: 500, code: 'EXPRESS_BRIDGE_UNSUPPORTED_API', expose: false }
    );
  }
}
