/**
 * @nextrush/router - Shared internal constants
 *
 * A leaf module that imports nothing, so any router module can depend on it
 * without risking an import cycle. This is the resolution of the former
 * `EMPTY_PARAMS` duplication: the constant was previously copied across modules
 * to dodge a `router.ts` <-> `match-route.ts` cycle, which a dependency-free
 * leaf module makes impossible by construction.
 *
 * @packageDocumentation
 * @internal
 */

/**
 * Prototype for every per-request key/value bag the router hands to
 * application code (`ctx.params`).
 *
 * Built once at module load, so instances are created with
 * `Object.create(NULL_PROTO)` rather than `Object.create(null)`. Both satisfy
 * the security requirement — `Object.prototype` stays unreachable, so a param
 * named `__proto__`/`constructor`/`prototype` binds as an own key and no
 * inherited member is visible — but `Object.create(null)` additionally puts the
 * object into V8 DICTIONARY mode, where property loads cannot be inline-cached.
 * That cost is paid by every `ctx.params.id` read in every handler, forever.
 * Deriving from a null-prototype object instead keeps FAST properties.
 *
 * @see docs/adr/ADR-0021-fast-property-request-containers.md
 */
export const NULL_PROTO: object = Object.create(null) as object;

/**
 * Frozen empty params object for matches with no path parameters (static-map
 * hits and successful walks that bound no `:param`/`*`).
 *
 * Shared as a single instance to avoid allocating a fresh object per request on
 * the hot path. Frozen so the shared instance can never be mutated by a
 * handler. Built on {@link NULL_PROTO} because it is *read* on every
 * static-route request — a dictionary-mode miss-read (`ctx.params.id` on a
 * route with no params) measured 2.2x slower than a fast-property one.
 */
export const EMPTY_PARAMS: Record<string, string> = Object.freeze(
  Object.create(NULL_PROTO) as Record<string, string>
);
