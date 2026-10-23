/**
 * @nextrush/types — internal dispatch-completion marker.
 *
 * @remarks
 * A route executor knows something no adapter can observe from the outside:
 * whether the handler returned without a pending promise. When it did, the whole
 * request chain has finished by the time the dispatch call returns, so a Web
 * runtime that accepts a `Response` (instead of a `Promise<Response>`) can answer
 * without awaiting anything.
 *
 * The marker is a symbol on the context rather than a change to the composed
 * handler's return type: `Middleware` and `callback()` are public contracts, and
 * widening them from `Promise<void>` to `void | Promise<void>` would break every
 * caller that stores the result in a `Promise<void>`.
 *
 * @packageDocumentation
 */

/**
 * Set on a context by a route executor whose handler settled synchronously.
 *
 * @remarks
 * Readers must also confirm that nothing else can still run for the request —
 * the Web runner only honours the marker when the application has a single
 * middleware (the mounted router), because a middleware registered ahead of the
 * router can resume after `next()` and still mutate the response.
 */
export const DISPATCH_SETTLED_SYNC: unique symbol = Symbol.for('nextrush.dispatch.settledSync');

/** A context that can carry the {@link DISPATCH_SETTLED_SYNC} marker. */
export interface DispatchMarkerCarrier {
  [DISPATCH_SETTLED_SYNC]?: boolean;
}
