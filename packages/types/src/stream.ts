/**
 * @nextrush/types - Response Streaming Contracts
 *
 * Pure type contracts for runtime-agnostic response streaming (text/SSE/NDJSON).
 * The implementation lives in `@nextrush/stream`; these interfaces live here so
 * the `Context` interface can reference them without `@nextrush/types` depending
 * on any higher-tier package.
 *
 * See `docs/RFC/request-data/003-stream.md`.
 *
 * @packageDocumentation
 */

/**
 * A single Server-Sent Event.
 *
 * @remarks
 * `data` is the only required field. Objects are serialized with `JSON.stringify`;
 * strings are sent verbatim. The framework handles all wire-format framing
 * (multi-line `data:` escaping, `event:`/`id:`/`retry:` fields, terminating blank line).
 */
export interface SSEEvent {
  /** Event payload. Objects are JSON-serialized; strings are sent as-is. */
  data: unknown;
  /** SSE `event:` field — lets the client dispatch to a named listener. */
  event?: string;
  /** SSE `id:` field — enables client auto-reconnect from the last-seen id. */
  id?: string;
  /** SSE `retry:` field, in milliseconds — client reconnection delay hint. */
  retry?: number;
}

/**
 * Capabilities shared by every response-stream writer, regardless of protocol.
 *
 * @remarks
 * Concrete writers ({@link TextStreamWriter}, {@link SSEStreamWriter},
 * {@link NDJSONStreamWriter}) add a protocol-specific `write()` on top of this.
 */
export interface BaseStreamWriter {
  /**
   * `true` once the client has disconnected.
   *
   * @remarks
   * Use as a loop guard for long-running streams. Writing after this is `true`
   * throws `StreamAbortedError`.
   */
  readonly aborted: boolean;

  /**
   * Fires when the client disconnects.
   *
   * @remarks
   * Pass this straight into an upstream SDK's own abort option
   * (e.g. `{ signal: writer.signal }`) so the upstream call is cancelled the
   * instant the client goes away.
   */
  readonly signal: AbortSignal;

  /**
   * Register a cleanup callback invoked once when the client disconnects.
   *
   * @param fn - Cleanup callback (e.g. abort an upstream request, release a resource).
   */
  onAbort(fn: () => void): void;
}

/**
 * Source shapes accepted by a writer's `consume()` method.
 *
 * @remarks
 * Normalized internally to a single async-iterator path — callers never branch
 * on the concrete shape.
 */
export type StreamSource<T> = AsyncIterable<T> | ReadableStream<T>;

/**
 * Writer for a raw text/byte stream (`ctx.stream()`).
 */
export interface TextStreamWriter extends BaseStreamWriter {
  /**
   * Write text or bytes.
   * @throws StreamAbortedError if the client has already disconnected.
   */
  write(chunk: string | Uint8Array): Promise<void>;

  /**
   * Consume an existing producer as this response's body.
   * @param source - An `AsyncIterable` or Web `ReadableStream` of strings/bytes.
   * @throws StreamAbortedError if the client disconnects mid-consume.
   */
  consume(source: StreamSource<string | Uint8Array>): Promise<void>;
}

/**
 * Writer for a Server-Sent Events stream (`ctx.sse()`).
 */
export interface SSEStreamWriter extends BaseStreamWriter {
  /**
   * Write one Server-Sent Event. The framework handles all wire-format framing.
   * @throws StreamAbortedError if the client has already disconnected.
   */
  write(event: SSEEvent): Promise<void>;

  /**
   * Consume an existing producer; each yielded chunk is sent as `{ data: chunk }`.
   * @throws StreamAbortedError if the client disconnects mid-consume.
   */
  consume(source: StreamSource<string | Uint8Array>): Promise<void>;
}

/**
 * Writer for a newline-delimited JSON stream (`ctx.ndjson()`).
 */
export interface NDJSONStreamWriter extends BaseStreamWriter {
  /**
   * Write one JSON-serializable value as a single NDJSON line.
   * @throws StreamAbortedError if the client has already disconnected.
   */
  write(value: unknown): Promise<void>;

  /**
   * Consume an existing producer of JSON-serializable values, one line each.
   * @throws StreamAbortedError if the client disconnects mid-consume.
   */
  consume(source: StreamSource<unknown>): Promise<void>;
}

/**
 * A streaming callback that receives a protocol-specific writer.
 *
 * @remarks
 * The connection auto-closes when this callback resolves.
 */
export type StreamRun<W extends BaseStreamWriter> = (writer: W) => Promise<void>;
