/**
 * @nextrush/router — the executor's synchronous-settlement marker.
 *
 * @remarks
 * The marker is the only signal a Web adapter has that a request chain finished
 * without a pending promise. It must be set for a synchronous handler, and must
 * never be set when work is still pending: a false positive would let the runner
 * answer before a middleware or an async handler had mutated the response.
 */

import { describe, expect, it } from 'vitest';
import { DISPATCH_SETTLED_SYNC, RESOLVED_PROMISE, type Context, type DispatchMarkerCarrier } from '@nextrush/types';
import { compileExecutor } from '../segment-trie';

function makeContext(): Context & DispatchMarkerCarrier {
  return {
    method: 'GET',
    path: '/',
    status: 200,
    responded: false,
    headers: {},
    params: {},
    state: {},
    setNext: () => undefined,
  } as unknown as Context & DispatchMarkerCarrier;
}

describe('route executor — synchronous settlement marker', () => {
  it('marks the context when the handler returns without a promise', () => {
    const executor = compileExecutor((ctx) => {
      ctx.status = 200;
    }, []);
    const ctx = makeContext();

    void executor(ctx);

    expect(ctx[DISPATCH_SETTLED_SYNC]).toBe(true);
  });

  it('does not mark the context when the handler is async', () => {
    const executor = compileExecutor(async (ctx) => {
      await Promise.resolve();
      ctx.status = 200;
    }, []);
    const ctx = makeContext();

    void executor(ctx);

    expect(ctx[DISPATCH_SETTLED_SYNC]).toBeUndefined();
  });

  it('does not mark the context when the handler throws', () => {
    const executor = compileExecutor(() => {
      throw new Error('boom');
    }, []);
    const ctx = makeContext();

    const result = executor(ctx);

    expect(ctx[DISPATCH_SETTLED_SYNC]).toBeUndefined();
    return expect(result).rejects.toThrow('boom');
  });

  it('does not mark the context when route middleware is present', () => {
    // A middleware can resume after `next()`, so a synchronous return from the
    // outermost layer does not prove the chain finished.
    const executor = compileExecutor((ctx) => {
      ctx.status = 200;
    }, [async (_ctx, next) => next()]);
    const ctx = makeContext();

    void executor(ctx);

    expect(ctx[DISPATCH_SETTLED_SYNC]).toBeUndefined();
  });

  it('returns canonical RESOLVED_PROMISE from @nextrush/types on synchronous settlement', () => {
    const executor = compileExecutor((ctx) => {
      ctx.status = 200;
    }, []);
    const ctx = makeContext();

    const result = executor(ctx);

    expect(result).toBe(RESOLVED_PROMISE);
  });
});
