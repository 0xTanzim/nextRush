/**
 * Every place a benchmark server departs from its framework's own defaults.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The fairness reasoning behind each deviation was recorded only in server
 * source comments, so a reader of the generated report saw Fastify described as
 * "logger disabled, default config" while it in fact ran with no response
 * schema (its headline serialization feature) and an overridden keep-alive, and
 * saw Express described as "minimal middleware" while two of its defaults had
 * been changed in its favour (audit F-23).
 *
 * Declared here rather than hand-written into the report so the disclosure can
 * never drift from the servers: a deviation that is added to a server and not
 * declared here fails `deviations-disclosure.test.js`.
 *
 * `direction` states who the deviation helps, judged honestly:
 *   'favours'  — plausibly helps this framework's measured number
 *   'costs'    — plausibly hurts it
 *   'neutral'  — no measurable effect established either way
 */

/**
 * @typedef {object} Deviation
 * @property {string} setting     What was changed, in the framework's own terms.
 * @property {string} from        The framework's default.
 * @property {string} to          The value this suite uses.
 * @property {'favours' | 'costs' | 'neutral'} direction
 * @property {string} why         The fairness reason, one sentence.
 */

/** @type {Readonly<Record<string, readonly Deviation[]>>} */
export const FRAMEWORK_DEVIATIONS = Object.freeze({
  'raw-node': Object.freeze([
    Object.freeze({
      setting: 'Static file resolution',
      from: 'n/a — no static serving exists',
      to: 'exact-match on the single fixture path only',
      direction: 'favours',
      why: 'the baseline implements no traversal-safe resolver, so it does strictly less work than every framework in the static-file scenario, which is why that scenario is not like-for-like',
    }),
  ]),

  fastify: Object.freeze([
    Object.freeze({
      setting: 'Response schemas (`fast-json-stringify`)',
      from: 'recommended for production; schemas compile a specialised serializer',
      to: 'none declared — falls back to `JSON.stringify`',
      direction: 'costs',
      why: 'schema-compiled serialization is a capability no other server in this suite has, so enabling it would stop the serialization scenarios being like-for-like; the cost to Fastify is disclosed rather than hidden',
    }),
    Object.freeze({
      setting: 'keepAliveTimeout',
      from: '72000 ms',
      to: '5000 ms (Node\u2019s own default, used by all six servers)',
      direction: 'neutral',
      why: 'a 14x deeper idle-socket window is an uncontrolled variable; measured inert under sustained load (native 72 s: 16,953 RPS vs 5 s: 17,347 — inside noise) because sockets are never idle for 5 s while wrk is running',
    }),
    Object.freeze({
      setting: 'logger',
      from: 'pino, enabled',
      to: 'false (noop logger)',
      direction: 'favours',
      why: 'no server in this suite logs per request; with `logger: false` Fastify also skips per-request child-logger creation entirely',
    }),
    Object.freeze({
      setting: 'bodyLimit (large-post route only)',
      from: '1 MB',
      to: '5 MB',
      direction: 'neutral',
      why: 'the scenario body is ~1.5 MB by design, so every server raises its parser limit for that route rather than riding the boundary of a default',
    }),
  ]),

  hono: Object.freeze([
    Object.freeze({
      setting: '`c.json()` content type',
      from: '`application/json` (no charset)',
      to: '`application/json; charset=utf-8` via c.json\u2019s own headers argument',
      direction: 'costs',
      why: 'the parity gate requires identical content types; passing headers to the real helper costs Hono a small per-request headers object, but hand-rolling `c.body(JSON.stringify(...))` would measure benchmark code instead of Hono\u2019s serializer',
    }),
  ]),

  koa: Object.freeze([
    Object.freeze({
      setting: '`router.allowedMethods()`',
      from: 'commonly mounted',
      to: 'not mounted',
      direction: 'favours',
      why: 'it made Koa the only server answering a wrong-method request with 405 + `Allow`, so Koa alone paid a per-request layer for a behaviour no scenario exercises and no competitor provides',
    }),
    Object.freeze({
      setting: 'app.silent',
      from: 'false (errors logged to stderr)',
      to: 'true',
      direction: 'neutral',
      why: 'no server in this suite logs; Koa has no dedicated error-handler hook, so silencing its built-in handling is the equivalent of the others\u2019 error handlers',
    }),
  ]),

  express: Object.freeze([
    Object.freeze({
      setting: 'etag',
      from: "'weak' — SHA-1 over the full response body on every res.json()",
      to: 'false',
      direction: 'favours',
      why: 'no other server computes a response hash; measured cost before disabling was -14% RPS on /json and -13.7% on /large-json, larger than the gaps separating mid-field frameworks',
    }),
    Object.freeze({
      setting: 'x-powered-by',
      from: 'enabled',
      to: 'disabled',
      direction: 'favours',
      why: 'extra response-header bytes no other server emits, which the header-set parity gate rejects',
    }),
  ]),

  'nextrush-v3': Object.freeze([
    Object.freeze({
      setting: 'Static serving registration',
      from: '`app.use()` middleware is the general form',
      to: 'registered as a router route',
      direction: 'favours',
      why: 'keeps the application middleware stack at one entry so `compose()` stays on its single-middleware fast path; fastify, hono and koa scope static per-route in this suite too, but Express uses `app.use(path, ...)` because that is its own idiomatic form',
    }),
    Object.freeze({
      setting: 'Diagnostic `/__elu-sample` route',
      from: 'n/a',
      to: 'present (13 routes vs 12 elsewhere)',
      direction: 'costs',
      why: 'polled only by scripts/profile.js; never probed by the parity gate and never measured, but it does add one route to the trie',
    }),
  ]),
});

/**
 * Deviations for one framework, or an empty list when it runs stock.
 * @param {string} frameworkId
 * @returns {readonly Deviation[]}
 */
export function deviationsFor(frameworkId) {
  return FRAMEWORK_DEVIATIONS[frameworkId] ?? [];
}
