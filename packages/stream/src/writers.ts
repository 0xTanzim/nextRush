/**
 * @nextrush/stream - Protocol writers
 *
 * Thin formatting wrappers over {@link StreamController}. Each writer differs
 * only in how `write()` encodes its protocol's native unit and how `consume()`
 * maps a raw chunk. All lifecycle (abort, backpressure, close) lives in the
 * controller — not here.
 *
 * See docs/RFC/request-data/003-stream.md §5, §7.
 *
 * @packageDocumentation
 */

import type {
  NDJSONStreamWriter,
  SSEEvent,
  SSEStreamWriter,
  StreamSource,
  TextStreamWriter,
} from '@nextrush/types';
import { formatSSE } from './sse-format';
import type { StreamController } from './stream-controller';

/** Decodes byte chunks to text for protocols whose payload is textual (SSE). */
const TEXT_DECODER = new TextDecoder();

/**
 * Shared base: exposes the controller's abort surface and drives `consume()`.
 *
 * @typeParam T - The unit type each source chunk is mapped to before `write()`.
 */
abstract class BaseWriter<T> {
  constructor(protected readonly controller: StreamController) {}

  get aborted(): boolean {
    return this.controller.aborted;
  }

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  onAbort(fn: () => void): void {
    this.controller.onAbort(fn);
  }

  /** Protocol-specific write of one native unit. */
  abstract write(value: T): Promise<void>;

  /** Map one raw source chunk to this protocol's native unit. */
  protected abstract mapChunk(chunk: unknown): T;

  /**
   * Consume an existing producer into this response. Single normalization path;
   * stops and throws `StreamAbortedError` if the client disconnects mid-consume.
   */
  async consume(source: StreamSource<unknown>): Promise<void> {
    const iterator = this.controller.normalize(source);
    try {
      for (;;) {
        const result: IteratorResult<unknown> = await iterator.next();
        if (result.done) return;
        await this.write(this.mapChunk(result.value));
      }
    } finally {
      await iterator.return?.(undefined);
    }
  }
}

/** Raw text/byte writer for `ctx.stream()`. */
export class TextWriter
  extends BaseWriter<string | Uint8Array>
  implements TextStreamWriter
{
  write(chunk: string | Uint8Array): Promise<void> {
    return typeof chunk === 'string'
      ? this.controller.enqueueText(chunk)
      : this.controller.enqueue(chunk);
  }

  protected mapChunk(chunk: unknown): string | Uint8Array {
    return chunk as string | Uint8Array;
  }
}

/** Server-Sent Events writer for `ctx.sse()`. */
export class SSEWriter extends BaseWriter<SSEEvent> implements SSEStreamWriter {
  write(event: SSEEvent): Promise<void> {
    return this.controller.enqueueText(formatSSE(event));
  }

  protected mapChunk(chunk: unknown): SSEEvent {
    // A consumed producer yields raw text/bytes; wrap each as an SSE `data` event.
    const data = chunk instanceof Uint8Array ? TEXT_DECODER.decode(chunk) : (chunk as string);
    return { data };
  }
}

/** Newline-delimited JSON writer for `ctx.ndjson()`. */
export class NDJSONWriter extends BaseWriter<unknown> implements NDJSONStreamWriter {
  write(value: unknown): Promise<void> {
    return this.controller.enqueueText(`${JSON.stringify(value)}\n`);
  }

  protected mapChunk(chunk: unknown): unknown {
    return chunk;
  }
}
