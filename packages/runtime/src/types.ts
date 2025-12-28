/**
 * @nextrush/runtime - Type Definitions
 *
 * Core types for runtime detection and cross-runtime abstractions.
 *
 * @packageDocumentation
 */

/**
 * Supported JavaScript runtimes
 *
 * @remarks
 * NextRush detects the runtime environment and exposes it via `ctx.runtime`.
 * This enables runtime-specific optimizations while maintaining a unified API.
 *
 * @example
 * ```typescript
 * import { detectRuntime, type Runtime } from '@nextrush/runtime';
 *
 * const runtime = detectRuntime();
 * console.log(runtime); // 'node' | 'bun' | 'deno' | 'cloudflare-workers' | 'edge' | 'unknown'
 * ```
 */
export type Runtime =
  | 'node'
  | 'bun'
  | 'deno'
  | 'cloudflare-workers'
  | 'vercel-edge'
  | 'edge'
  | 'unknown';

/**
 * Runtime feature capabilities
 *
 * @remarks
 * Different runtimes have different feature sets. Use this to check
 * what's available before using runtime-specific features.
 */
export interface RuntimeCapabilities {
  /** Supports Node.js streams (Readable, Writable) */
  nodeStreams: boolean;

  /** Supports Web Streams API (ReadableStream, WritableStream) */
  webStreams: boolean;

  /** Supports file system operations */
  fileSystem: boolean;

  /** Supports WebSocket */
  webSocket: boolean;

  /** Supports native fetch API */
  fetch: boolean;

  /** Supports crypto.subtle API */
  cryptoSubtle: boolean;

  /** Supports Web Workers / Worker Threads */
  workers: boolean;
}

/**
 * Runtime information object
 */
export interface RuntimeInfo {
  /** Runtime identifier */
  runtime: Runtime;

  /** Runtime version (if available) */
  version: string | undefined;

  /** Runtime capabilities */
  capabilities: RuntimeCapabilities;
}

/**
 * Body source interface for cross-runtime body reading
 *
 * @remarks
 * Different runtimes have different APIs for reading request bodies:
 * - Node.js: `IncomingMessage` stream with `on('data')` events
 * - Bun/Deno/Edge: Web `Request` with `text()`, `arrayBuffer()` methods
 *
 * `BodySource` provides a unified interface for body parsers to work
 * across all runtimes without runtime-specific code.
 *
 * @example
 * ```typescript
 * // Works on any runtime
 * async function parseJson(bodySource: BodySource): Promise<unknown> {
 *   const text = await bodySource.text();
 *   return JSON.parse(text);
 * }
 * ```
 */
export interface BodySource {
  /**
   * Read the body as a UTF-8 string
   *
   * @returns Promise resolving to the body as string
   * @throws Error if body has already been consumed
   */
  text(): Promise<string>;

  /**
   * Read the body as a Uint8Array buffer
   *
   * @returns Promise resolving to the body as Uint8Array
   * @throws Error if body has already been consumed
   */
  buffer(): Promise<Uint8Array>;

  /**
   * Read the body as JSON
   *
   * @returns Promise resolving to parsed JSON
   * @throws SyntaxError if body is not valid JSON
   * @throws Error if body has already been consumed
   */
  json<T = unknown>(): Promise<T>;

  /**
   * Get the body as a stream
   *
   * @remarks
   * Returns the native stream type for the runtime:
   * - Node.js: `Readable`
   * - Web API: `ReadableStream<Uint8Array>`
   *
   * @returns The underlying stream
   */
  stream(): ReadableStream<Uint8Array> | NodeJS.ReadableStream;

  /**
   * Whether the body has been consumed
   *
   * @remarks
   * Most runtimes only allow the body to be read once. After calling
   * `text()`, `buffer()`, `json()`, or `stream()`, subsequent calls
   * may throw an error.
   */
  readonly consumed: boolean;

  /**
   * Content length from headers (if available)
   *
   * @remarks
   * This is the value from the Content-Length header, which may not
   * match the actual body size for chunked transfers.
   */
  readonly contentLength: number | undefined;

  /**
   * Content type from headers (if available)
   */
  readonly contentType: string | undefined;
}

/**
 * Options for creating a BodySource
 */
export interface BodySourceOptions {
  /** Maximum body size in bytes (default: 1MB) */
  limit?: number;

  /** Encoding for text() method (default: 'utf-8') */
  encoding?: BufferEncoding;
}
