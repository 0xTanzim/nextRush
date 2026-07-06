/**
 * @nextrush/stream - Run orchestration
 *
 * Wires a protocol writer to a Web `ReadableStream` and ships it through the
 * adapter's `ctx.sendStream()` primitive. Runtime-agnostic: identical code path
 * on Node (eager pump) and Bun/Deno/Edge (lazy Response body).
 *
 * See docs/RFC/RFC-NEXTRUSH-STREAM.md §5, §6.
 *
 * @packageDocumentation
 */

import type {
  NDJSONStreamWriter,
  SSEStreamWriter,
  StreamRun,
  TextStreamWriter,
} from '@nextrush/types';
import { StreamAbortedError } from './errors';
import { StreamController } from './stream-controller';
import { NDJSONWriter, SSEWriter, TextWriter } from './writers';

/**
 * Minimal Context surface `@nextrush/stream` needs. The concrete adapter
 * `Context` satisfies this structurally; kept narrow so unit tests can supply a
 * lightweight fake.
 */
export interface StreamCapableContext {
  readonly signal: AbortSignal;
  set(field: string, value: string | number | string[]): void;
  sendStream(source: ReadableStream<Uint8Array>): Promise<void>;
}

const CONTENT_TYPE = {
  text: 'text/plain; charset=utf-8',
  sse: 'text/event-stream; charset=utf-8',
  ndjson: 'application/x-ndjson; charset=utf-8',
} as const;

/**
 * Core streaming loop shared by all three protocols.
 *
 * @remarks
 * The callback runs in a **detached** task launched from the stream's `start()`,
 * intentionally not awaited there: awaiting it would block `pull()` from ever
 * being called, deadlocking backpressure on lazy (web) runtimes. Backpressure is
 * instead relieved cooperatively via `pull()` → `controller.onPull()`.
 */
function runStream<W>(
  ctx: StreamCapableContext,
  contentType: string,
  makeWriter: (controller: StreamController) => W,
  run: (writer: W) => Promise<void>,
  extraHeaders?: Record<string, string>,
): Promise<void> {
  ctx.set('Content-Type', contentType);
  if (extraHeaders) {
    for (const [field, value] of Object.entries(extraHeaders)) {
      ctx.set(field, value);
    }
  }

  const controller = new StreamController(ctx.signal);

  const readable = new ReadableStream<Uint8Array>({
    start(rsController): void {
      controller.attach(rsController);
      const writer = makeWriter(controller);
      // Detached on purpose — see function remarks.
      void (async (): Promise<void> => {
        try {
          await run(writer);
          controller.close();
        } catch (err) {
          if (err instanceof StreamAbortedError) {
            // Client disconnected — expected, close cleanly and swallow.
            controller.close();
          } else {
            // Real error: surface it to the stream. On Node this rejects the
            // pump (ctx.sendStream); on web it errors the Response body stream.
            controller.error(err);
          }
        }
      })();
    },
    pull(): void {
      controller.onPull();
    },
    cancel(): void {
      // Consumer cancelled the read side — release any pending backpressure wait.
      controller.onPull();
    },
  });

  return ctx.sendStream(readable);
}

/** Implements `ctx.stream()`. */
export function runTextStream(
  ctx: StreamCapableContext,
  run: StreamRun<TextStreamWriter>,
): Promise<void> {
  return runStream(ctx, CONTENT_TYPE.text, (c) => new TextWriter(c), run);
}

/** Implements `ctx.sse()`. */
export function runSSEStream(
  ctx: StreamCapableContext,
  run: StreamRun<SSEStreamWriter>,
): Promise<void> {
  return runStream(ctx, CONTENT_TYPE.sse, (c) => new SSEWriter(c), run, {
    'Cache-Control': 'no-cache',
  });
}

/** Implements `ctx.ndjson()`. */
export function runNDJSONStream(
  ctx: StreamCapableContext,
  run: StreamRun<NDJSONStreamWriter>,
): Promise<void> {
  return runStream(ctx, CONTENT_TYPE.ndjson, (c) => new NDJSONWriter(c), run);
}
