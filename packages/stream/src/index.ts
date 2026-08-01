/**
 * @nextrush/stream — Runtime-agnostic response streaming for NextRush.
 *
 * Provides `ctx.stream()` / `ctx.sse()` / `ctx.ndjson()` implementations wired by
 * the platform adapters, plus the `StreamController` foundation and
 * `StreamAbortedError`. Built for AI/agentic apps (LLM token streaming) but works
 * for any chunked response (CSV export, progress logs, structured traces).
 *
 * See docs/RFC/request-data/003-stream.md.
 *
 * @packageDocumentation
 * @module @nextrush/stream
 */

export { StreamAbortedError } from './errors';
export { formatSSE } from './sse-format';
export { StreamController } from './stream-controller';
export {
  runNDJSONStream,
  runSSEStream,
  runTextStream,
  type StreamCapableContext,
} from './run';
export { NDJSONWriter, SSEWriter, TextWriter } from './writers';

// Re-export the writer contracts for convenience (canonical home: @nextrush/types).
export type {
  BaseStreamWriter,
  NDJSONStreamWriter,
  SSEEvent,
  SSEStreamWriter,
  StreamRun,
  StreamSource,
  TextStreamWriter,
} from '@nextrush/types';
