/**
 * @nextrush/runtime - Fast-property null-prototype base
 *
 * A leaf module that imports nothing, so any runtime module (and any adapter)
 * can depend on it without risking an import cycle.
 *
 * @packageDocumentation
 */

/**
 * Prototype for every per-request key/value container handed to application
 * code — `ctx.params`, `ctx.query`, `ctx.headers`.
 *
 * Create containers with `Object.create(NULL_PROTO)`, never
 * `Object.create(null)`. Both keep `Object.prototype` unreachable, which is the
 * actual security requirement: a key named `__proto__`, `constructor` or
 * `prototype` binds as an own key, and no inherited member is visible. But
 * `Object.create(null)` *also* switches the object into V8 dictionary mode,
 * where property loads cannot be inline-cached — a cost paid on every
 * `ctx.params.id` and `ctx.query.q` read in application code, forever.
 * Deriving from a null-prototype object keeps fast properties and identical
 * safety.
 *
 * `@nextrush/router` carries its own copy for `ctx.params`: it is a sibling
 * package that may not import `runtime`, and `@nextrush/types` holds no runtime
 * code.
 *
 * @see docs/adr/ADR-0021-fast-property-request-containers.md
 */
export const NULL_PROTO: object = Object.create(null) as object;
