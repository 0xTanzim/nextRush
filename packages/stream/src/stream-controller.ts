/**
 * @nextrush/stream - StreamController
 *
 * The single internal component that owns streaming lifecycle: abort tracking,
 * enqueue, cooperative backpressure, source normalization, and close/cleanup.
 * The protocol writers ({@link TextWriter}/{@link SSEWriter}/{@link NDJSONWriter})
 * are thin formatting wrappers over this — they never touch lifecycle directly.
 *
 * See docs/RFC/RFC-NEXTRUSH-STREAM.md §5.
 *
 * @packageDocumentation
 */

import { StreamAbortedError } from './errors';

/** Shared encoder — avoids per-call allocation. */
const TEXT_ENCODER = new TextEncoder();

/**
 * Owns the underlying `ReadableStream` controller and all streaming lifecycle.
 *
 * @remarks
 * One instance per streaming response, shared by exactly one writer.
 */
export class StreamController {
  /** Fires when the client disconnects. */
  readonly signal: AbortSignal;

  private _rsController: ReadableStreamDefaultController<Uint8Array> | null = null;
  private _pullResolve: (() => void) | null = null;
  private _abortCallbacks: (() => void)[] = [];
  private _closed = false;

  constructor(signal: AbortSignal) {
    this.signal = signal;
    if (!signal.aborted) {
      signal.addEventListener('abort', this._onAbort, { once: true });
    }
  }

  /** `true` once the client has disconnected. */
  get aborted(): boolean {
    return this.signal.aborted;
  }

  /**
   * @internal Wire the underlying `ReadableStream` controller. Called once from
   * the stream's `start()`.
   */
  attach(controller: ReadableStreamDefaultController<Uint8Array>): void {
    this._rsController = controller;
  }

  /**
   * @internal Release a pending backpressure wait. Called from the stream's
   * `pull()` when the consumer is ready for more data.
   */
  onPull(): void {
    this._resolvePull();
  }

  /**
   * Register a cleanup callback invoked once when the client disconnects.
   * Invoked immediately if already aborted.
   */
  onAbort(fn: () => void): void {
    if (this.aborted) {
      fn();
      return;
    }
    this._abortCallbacks.push(fn);
  }

  /**
   * Enqueue raw bytes, applying cooperative backpressure.
   *
   * @throws StreamAbortedError if the client has disconnected.
   */
  async enqueue(chunk: Uint8Array): Promise<void> {
    if (this.aborted) throw new StreamAbortedError();
    const controller = this._rsController;
    if (!controller) {
      throw new Error('StreamController is not attached to a stream.');
    }
    controller.enqueue(chunk);
    // Backpressure: if the consumer's buffer is full, wait until the next pull().
    if ((controller.desiredSize ?? 1) <= 0) {
      await this._waitForPull();
      // Re-check via the signal directly: the client may have disconnected
      // while we were parked on backpressure.
      if (this.signal.aborted) throw new StreamAbortedError();
    }
  }

  /** Encode a UTF-8 string and enqueue it. */
  enqueueText(text: string): Promise<void> {
    return this.enqueue(TEXT_ENCODER.encode(text));
  }

  /**
   * Normalize any accepted source shape to a single async-iterator.
   *
   * @remarks
   * The one and only place that branches on source type. `AsyncIterable`
   * (including Node `Readable`, which implements `Symbol.asyncIterator`) is used
   * directly; a bare Web `ReadableStream` is adapted via its reader.
   */
  normalize<T>(source: AsyncIterable<T> | ReadableStream<T>): AsyncIterator<T> {
    if (Symbol.asyncIterator in source) {
      return (source as AsyncIterable<T>)[Symbol.asyncIterator]();
    }
    const reader = (source as ReadableStream<T>).getReader();
    return {
      async next(): Promise<IteratorResult<T>> {
        const { done, value } = await reader.read();
        return done
          ? { done: true, value: undefined as never }
          : { done: false, value };
      },
      async return(): Promise<IteratorResult<T>> {
        await reader.cancel();
        return { done: true, value: undefined as never };
      },
    };
  }

  /** Close the underlying stream cleanly. Idempotent. */
  close(): void {
    if (this._closed) return;
    this._closed = true;
    this.signal.removeEventListener('abort', this._onAbort);
    this._resolvePull();
    if (this._rsController) {
      try {
        this._rsController.close();
      } catch {
        // Already closed or errored by the consumer — nothing to do.
      }
    }
  }

  /** Error the underlying stream. Idempotent. */
  error(err: unknown): void {
    if (this._closed) return;
    this._closed = true;
    this.signal.removeEventListener('abort', this._onAbort);
    this._resolvePull();
    if (this._rsController) {
      try {
        this._rsController.error(err);
      } catch {
        // Already closed or errored — nothing to do.
      }
    }
  }

  private _onAbort = (): void => {
    // Unblock any writer waiting on backpressure so it observes the abort.
    this._resolvePull();
    const callbacks = this._abortCallbacks;
    this._abortCallbacks = [];
    for (const cb of callbacks) {
      try {
        cb();
      } catch {
        // Cleanup callbacks must not break the abort path.
      }
    }
  };

  private _resolvePull(): void {
    const resolve = this._pullResolve;
    if (resolve) {
      this._pullResolve = null;
      resolve();
    }
  }

  private _waitForPull(): Promise<void> {
    return new Promise<void>((resolve) => {
      this._pullResolve = resolve;
    });
  }
}
