/**
 * @nextrush/adapter-serverless - Types
 *
 * The serverless adapter separates the **execution model** (per-invocation,
 * stateless, timeout→504, warm-instance reuse — shared with the edge adapter)
 * from the **provider event format**, which is an {@link EventMapper} plugin.
 *
 * @packageDocumentation
 */

/**
 * Maps a provider's native event to a Web `Request` and the produced `Response`
 * back to the provider's expected result shape.
 *
 * @remarks
 * Generic over the platform event, the platform result, and an optional platform
 * context (e.g. a Lambda `context`), so mapper authors keep full type safety at
 * the boundary instead of `unknown`/`any`. A new provider is added by supplying
 * an `EventMapper` — the adapter never grows a provider `switch`.
 *
 * @typeParam Event - The platform's native event shape.
 * @typeParam Result - The platform's expected result shape.
 * @typeParam Ctx - The optional platform context passed alongside the event.
 */
export interface EventMapper<Event, Result, Ctx = unknown> {
  /** Stable mapper name (used for explicit `provider` selection). */
  readonly name: string;
  /** Build a Web `Request` from the platform event. */
  toRequest(event: Event, platformCtx?: Ctx): Request;
  /** Map the produced `Response` back to the platform result shape. */
  fromResponse(response: Response, event: Event): Result | Promise<Result>;
  /** Optional: report whether this mapper recognizes an event (detection fallback). */
  detect?(event: Event): boolean;
}

/**
 * Options for {@link createServerlessAdapter}.
 *
 * @remarks
 * `mappers` is the **immutable, per-adapter registry** — there is no global
 * mutable registry (which would be global mutable state). Selection is
 * explicit-first: a named `provider` wins; `detect()` runs only when no provider
 * is specified.
 */
export interface ServerlessAdapterOptions<Event, Result, Ctx = unknown> {
  /** The mappers this adapter can use (immutable registry). */
  readonly mappers: readonly EventMapper<Event, Result, Ctx>[];
  /** Explicit mapper name. Wins over `detect()`. */
  readonly provider?: string;
  /** Per-invocation timeout in ms; races the handler and returns 504. */
  readonly timeout?: number;
}

/** A serverless handler: platform event (+ context) → platform result. */
export type ServerlessHandler<Event, Result, Ctx = unknown> = (
  event: Event,
  platformCtx?: Ctx
) => Promise<Result>;
