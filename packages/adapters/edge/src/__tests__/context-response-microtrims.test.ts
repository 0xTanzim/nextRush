/**
 * @nextrush/adapter-edge — HP-5-web lazy `ctx.raw` regression contract
 *
 * OpenSpec change `web-adapters-context-response-microtrims` (HP-5-web): the
 * `{ req, res }` wrapper is built lazily by a memoized getter, with `req` held
 * in a private field used by the `signal` getter and `triggerTimeout`. These
 * are behavior-preserving characterization tests pinning the observable
 * contract of `ctx.raw`, `ctx.signal`, and timeout across the refactor. The
 * "no wrapper allocated when unread" proof is the allocation micro-bench
 * (`apps/benchmark/scripts/web-context-alloc.js`, task 5.2), not a unit test.
 */

import { describe, expect, it } from 'vitest';
import { EdgeContext } from '../context';

function makeRequest(init?: RequestInit): Request {
  return new Request('http://localhost/', init);
}

describe('HP-5-web: Edge ctx.raw lazy memoized wrapper', () => {
  it('returns the { req, res: undefined } shape', () => {
    const request = makeRequest();
    const ctx = new EdgeContext(request);
    expect(ctx.raw.req).toBe(request);
    expect(ctx.raw.res).toBeUndefined();
  });

  it('is memoized — repeated reads return the same object', () => {
    const ctx = new EdgeContext(makeRequest());
    expect(ctx.raw).toBe(ctx.raw);
  });
});

describe('HP-5-web: Edge ctx.signal still combines request signal + timeout', () => {
  it('aborts ctx.signal when the underlying request signal aborts', () => {
    const controller = new AbortController();
    const ctx = new EdgeContext(makeRequest({ signal: controller.signal }));
    const signal = ctx.signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal.aborted).toBe(false);
    controller.abort();
    expect(signal.aborted).toBe(true);
  });

  it('aborts ctx.signal when triggerTimeout fires', () => {
    const ctx = new EdgeContext(makeRequest());
    const signal = ctx.signal;
    expect(signal.aborted).toBe(false);
    ctx.triggerTimeout();
    expect(signal.aborted).toBe(true);
  });
});
