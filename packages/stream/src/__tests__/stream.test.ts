/**
 * @nextrush/stream - Tests
 *
 * Exercises the full runtime-agnostic streaming path through a mock context that
 * consumes the ReadableStream like a real web runtime (driving pull/backpressure),
 * plus focused unit tests for SSE formatting, normalization, and abort behavior.
 */

import { describe, expect, it, vi } from 'vitest';
import { StreamAbortedError } from '../errors';
import {
  runNDJSONStream,
  runSSEStream,
  runTextStream,
  type StreamCapableContext,
} from '../run';
import { formatSSE } from '../sse-format';
import { StreamController } from '../stream-controller';

/** A mock context that consumes the stream to completion, like a web runtime. */
function createMockCtx(): StreamCapableContext & {
  readonly headers: Record<string, string>;
  collected(): Promise<string>;
  abort(): void;
} {
  const ac = new AbortController();
  const headers: Record<string, string> = {};
  let collectedPromise: Promise<Uint8Array[]> = Promise.resolve([]);

  return {
    signal: ac.signal,
    headers,
    set(field, value) {
      headers[field] = String(value);
    },
    sendStream(rs) {
      collectedPromise = (async () => {
        const reader = rs.getReader();
        const chunks: Uint8Array[] = [];
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        return chunks;
      })();
      return collectedPromise.then(() => undefined);
    },
    async collected() {
      const chunks = await collectedPromise;
      return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
    },
    abort() {
      ac.abort();
    },
  };
}

describe('formatSSE', () => {
  it('formats a minimal data-only event', () => {
    expect(formatSSE({ data: 'hello' })).toBe('data: hello\n\n');
  });

  it('JSON-serializes non-string data', () => {
    expect(formatSSE({ data: { a: 1 } })).toBe('data: {"a":1}\n\n');
  });

  it('emits event/id/retry fields before data', () => {
    expect(formatSSE({ data: 'x', event: 'token', id: '7', retry: 1000 })).toBe(
      'event: token\nid: 7\nretry: 1000\ndata: x\n\n',
    );
  });

  it('splits multi-line data into one data: field per line', () => {
    expect(formatSSE({ data: 'a\nb' })).toBe('data: a\ndata: b\n\n');
  });

  it('strips CR/LF from event and id to prevent field injection', () => {
    expect(formatSSE({ data: 'x', event: 'a\nb', id: 'c\rd' })).toBe(
      'event: ab\nid: cd\ndata: x\n\n',
    );
  });

  it('truncates a fractional retry to an integer', () => {
    expect(formatSSE({ data: 'x', retry: 1500.9 })).toContain('retry: 1500\n');
  });
});

describe('StreamController.normalize', () => {
  it('adapts a Web ReadableStream to an async iterator', async () => {
    const controller = new StreamController(new AbortController().signal);
    const rs = new ReadableStream<string>({
      start(c) {
        c.enqueue('a');
        c.enqueue('b');
        c.close();
      },
    });
    const it = controller.normalize(rs);
    expect((await it.next()).value).toBe('a');
    expect((await it.next()).value).toBe('b');
    expect((await it.next()).done).toBe(true);
  });

  it('uses an AsyncIterable directly', async () => {
    const controller = new StreamController(new AbortController().signal);
    async function* gen() {
      yield 1;
      yield 2;
    }
    const it = controller.normalize(gen());
    expect((await it.next()).value).toBe(1);
    expect((await it.next()).value).toBe(2);
    expect((await it.next()).done).toBe(true);
  });
});

describe('ctx.stream() — text', () => {
  it('writes text chunks in order', async () => {
    const ctx = createMockCtx();
    await runTextStream(ctx, async (w) => {
      await w.write('Hello, ');
      await w.write('World');
    });
    expect(await ctx.collected()).toBe('Hello, World');
    expect(ctx.headers['Content-Type']).toBe('text/plain; charset=utf-8');
  });

  it('writes raw bytes', async () => {
    const ctx = createMockCtx();
    await runTextStream(ctx, async (w) => {
      await w.write(new Uint8Array([0x68, 0x69])); // "hi"
    });
    expect(await ctx.collected()).toBe('hi');
  });

  it('consumes an async iterable', async () => {
    const ctx = createMockCtx();
    async function* gen() {
      yield 'a';
      yield 'b';
      yield 'c';
    }
    await runTextStream(ctx, async (w) => {
      await w.consume(gen());
    });
    expect(await ctx.collected()).toBe('abc');
  });

  it('consumes a Web ReadableStream', async () => {
    const ctx = createMockCtx();
    const src = new ReadableStream<string>({
      start(c) {
        c.enqueue('x');
        c.enqueue('y');
        c.close();
      },
    });
    await runTextStream(ctx, async (w) => {
      await w.consume(src);
    });
    expect(await ctx.collected()).toBe('xy');
  });
});

describe('ctx.sse() — Server-Sent Events', () => {
  it('frames events and sets the event-stream content type', async () => {
    const ctx = createMockCtx();
    await runSSEStream(ctx, async (w) => {
      await w.write({ data: 'one' });
      await w.write({ data: 'two', event: 'token' });
    });
    expect(await ctx.collected()).toBe('data: one\n\nevent: token\ndata: two\n\n');
    expect(ctx.headers['Content-Type']).toBe('text/event-stream; charset=utf-8');
    expect(ctx.headers['Cache-Control']).toBe('no-cache');
  });

  it('wraps consumed chunks as data events', async () => {
    const ctx = createMockCtx();
    async function* tokens() {
      yield 'a';
      yield 'b';
    }
    await runSSEStream(ctx, async (w) => {
      await w.consume(tokens());
    });
    expect(await ctx.collected()).toBe('data: a\n\ndata: b\n\n');
  });
});

describe('ctx.ndjson() — newline-delimited JSON', () => {
  it('emits one JSON object per line', async () => {
    const ctx = createMockCtx();
    await runNDJSONStream(ctx, async (w) => {
      await w.write({ step: 1 });
      await w.write({ step: 2 });
    });
    expect(await ctx.collected()).toBe('{"step":1}\n{"step":2}\n');
    expect(ctx.headers['Content-Type']).toBe('application/x-ndjson; charset=utf-8');
  });
});

describe('cancellation', () => {
  it('write after abort throws StreamAbortedError, swallowed by the run boundary', async () => {
    const ctx = createMockCtx();
    let caught: unknown;
    const onAbortSpy = vi.fn();

    await runTextStream(ctx, async (w) => {
      w.onAbort(onAbortSpy);
      await w.write('before');
      ctx.abort();
      try {
        await w.write('after');
      } catch (err) {
        caught = err;
        throw err; // propagate — run boundary must swallow StreamAbortedError
      }
    });

    expect(caught).toBeInstanceOf(StreamAbortedError);
    expect(onAbortSpy).toHaveBeenCalledTimes(1);
    // "before" may or may not have flushed depending on timing, but the stream
    // must have closed cleanly (no throw out of runTextStream).
  });

  it('onAbort fires immediately if already aborted', () => {
    const ac = new AbortController();
    ac.abort();
    const controller = new StreamController(ac.signal);
    const spy = vi.fn();
    controller.onAbort(spy);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(controller.aborted).toBe(true);
  });

  it('enqueue throws StreamAbortedError when already aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    const controller = new StreamController(ac.signal);
    await expect(controller.enqueue(new Uint8Array([1]))).rejects.toBeInstanceOf(
      StreamAbortedError,
    );
  });
});

describe('error propagation', () => {
  it('a non-abort error thrown in the callback surfaces to the stream consumer', async () => {
    const ctx = createMockCtx();
    const boom = new Error('boom');
    await expect(
      runTextStream(ctx, async (w) => {
        await w.write('partial');
        throw boom;
      }),
    ).rejects.toThrow('boom');
  });
});

describe('writer abort surface', () => {
  it('exposes signal and aborted on the writer', async () => {
    const ctx = createMockCtx();
    let seenSignalIsAbortSignal = false;
    let seenAbortedBefore = true;
    await runTextStream(ctx, async (w) => {
      seenSignalIsAbortSignal = w.signal instanceof AbortSignal;
      seenAbortedBefore = w.aborted;
      await w.write('x');
    });
    expect(seenSignalIsAbortSignal).toBe(true);
    expect(seenAbortedBefore).toBe(false);
    expect(await ctx.collected()).toBe('x');
  });
});

describe('consume byte sources', () => {
  it('sse consume decodes Uint8Array chunks to data events', async () => {
    const ctx = createMockCtx();
    const enc = new TextEncoder();
    async function* bytes() {
      yield enc.encode('a');
      yield enc.encode('b');
    }
    await runSSEStream(ctx, async (w) => {
      await w.consume(bytes());
    });
    expect(await ctx.collected()).toBe('data: a\n\ndata: b\n\n');
  });

  it('ndjson consume emits one line per value', async () => {
    const ctx = createMockCtx();
    async function* values() {
      yield { a: 1 };
      yield { b: 2 };
    }
    await runNDJSONStream(ctx, async (w) => {
      await w.consume(values());
    });
    expect(await ctx.collected()).toBe('{"a":1}\n{"b":2}\n');
  });
});

describe('StreamController lifecycle', () => {
  function attachedController() {
    const sc = new StreamController(new AbortController().signal);
    let rsc!: ReadableStreamDefaultController<Uint8Array>;
    // Constructing the stream synchronously invokes start(), capturing the controller.
    void new ReadableStream<Uint8Array>({
      start(c) {
        rsc = c;
      },
    });
    sc.attach(rsc);
    return sc;
  }

  it('error() then close() is idempotent (close is a no-op after error)', () => {
    const sc = attachedController();
    expect(() => sc.error(new Error('x'))).not.toThrow();
    expect(() => sc.close()).not.toThrow(); // already closed via error()
  });

  it('close() twice is idempotent', () => {
    const sc = attachedController();
    expect(() => sc.close()).not.toThrow();
    expect(() => sc.close()).not.toThrow();
  });

  it('enqueue on an unattached controller throws a clear error', async () => {
    const sc = new StreamController(new AbortController().signal);
    await expect(sc.enqueue(new Uint8Array([1]))).rejects.toThrow(/not attached/);
  });

  it('close() and error() on an unattached controller are safe no-ops', () => {
    const sc1 = new StreamController(new AbortController().signal);
    expect(() => sc1.close()).not.toThrow();
    const sc2 = new StreamController(new AbortController().signal);
    expect(() => sc2.error(new Error('x'))).not.toThrow();
  });

  it('normalize() reader adapter cancels the source on return()', async () => {
    const sc = new StreamController(new AbortController().signal);
    let cancelled = false;
    const rs = new ReadableStream<string>({
      start(c) {
        c.enqueue('a');
      },
      cancel() {
        cancelled = true;
      },
    });
    const it = sc.normalize(rs);
    expect((await it.next()).value).toBe('a');
    const ret = await it.return?.(undefined as never);
    expect(ret?.done).toBe(true);
    expect(cancelled).toBe(true);
  });
});

describe('consumer cancellation', () => {
  it('releases a backpressure wait when the consumer cancels the read side', async () => {
    const ac = new AbortController();
    let cancelled = false;
    const ctx: StreamCapableContext = {
      signal: ac.signal,
      set() {
        /* no-op */
      },
      sendStream(rs) {
        return (async () => {
          const reader = rs.getReader();
          await reader.read(); // pull first chunk → start()/pull()
          await reader.cancel(); // → run.ts cancel() → controller.onPull()
          cancelled = true;
        })();
      },
    };

    await runTextStream(ctx, async (w) => {
      await w.write('a');
      try {
        await w.write('b'); // may throw once the stream is cancelled
      } catch {
        /* expected after cancel */
      }
    });

    expect(cancelled).toBe(true);
  });
});

describe('edge cases', () => {
  it('an empty stream (no writes) closes cleanly with an empty body', async () => {
    const ctx = createMockCtx();
    await runTextStream(ctx, async () => {
      // writes nothing
    });
    expect(await ctx.collected()).toBe('');
  });

  it('a client already gone before streaming starts: first write throws and is swallowed', async () => {
    const ctx = createMockCtx();
    ctx.abort(); // client disconnected before the handler streams anything
    let threw = false;
    await runTextStream(ctx, async (w) => {
      try {
        await w.write('never delivered');
      } catch {
        threw = true;
        throw new StreamAbortedError();
      }
    });
    expect(threw).toBe(true);
    expect(await ctx.collected()).toBe('');
  });

  it('a source that throws mid-iteration propagates the error to the consumer', async () => {
    const ctx = createMockCtx();
    async function* faulty() {
      yield 'ok';
      throw new Error('source failed');
    }
    await expect(
      runTextStream(ctx, async (w) => {
        await w.consume(faulty());
      }),
    ).rejects.toThrow('source failed');
  });

  it('empty-string SSE data still frames a valid event', async () => {
    const ctx = createMockCtx();
    await runSSEStream(ctx, async (w) => {
      await w.write({ data: '' });
    });
    expect(await ctx.collected()).toBe('data: \n\n');
  });

  it('SSE retry:0 is emitted (not treated as absent)', async () => {
    const ctx = createMockCtx();
    await runSSEStream(ctx, async (w) => {
      await w.write({ data: 'x', retry: 0 });
    });
    expect(await ctx.collected()).toBe('retry: 0\ndata: x\n\n');
  });
});
