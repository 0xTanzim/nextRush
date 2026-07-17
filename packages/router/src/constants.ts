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
 * Frozen, null-prototype empty params object for matches with no path
 * parameters (static-map hits and successful walks that bound no `:param`/`*`).
 *
 * Shared as a single instance to avoid allocating a fresh object per request on
 * the hot path. Null-prototype so callers can never read an inherited
 * `Object.prototype` key as if it were a route param; frozen so the shared
 * instance can never be mutated by a handler.
 */
export const EMPTY_PARAMS: Record<string, string> = Object.freeze(
  Object.create(null) as Record<string, string>
);
