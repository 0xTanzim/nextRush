/**
 * @nextrush/runtime — context-basis `ctx.cookies` wiring tests (RFC-034).
 *
 * Every context (the Web base and, via the Node adapter's suite, NodeContext)
 * must construct with the shared uninitialized cookie stub — never
 * `undefined` — and the slot must be reassignable so the middleware can
 * activate it.
 */

import { describe, expect, it } from 'vitest';
import { CapabilityNotInitializedError } from '@nextrush/errors';
import { UNINITIALIZED_COOKIES } from '../capabilities';
import { WebContextBase } from '../web-context-base';
import type { WebStreamRunners } from '../web-context-base';

class TestContext extends WebContextBase {
  constructor(request: Request, streamRunners?: Partial<WebStreamRunners>) {
    super(request, '', 'bun', {
      runTextStream: streamRunners?.runTextStream ?? (async () => undefined),
      runSSEStream: streamRunners?.runSSEStream ?? (async () => undefined),
      runNDJSONStream: streamRunners?.runNDJSONStream ?? (async () => undefined),
    });
  }
}

describe('Context cookie slot wiring (WebContextBase)', () => {
  it('constructs ctx.cookies as the shared uninitialized stub', () => {
    const ctx = new TestContext(new Request('http://localhost/'));
    expect(ctx.cookies).toBe(UNINITIALIZED_COOKIES);
  });

  it('reading ctx.cookies does not throw', () => {
    const ctx = new TestContext(new Request('http://localhost/'));
    expect(() => ctx.cookies).not.toThrow();
    expect(() => JSON.stringify({ cookies: ctx.cookies })).not.toThrow();
  });

  it('operations on the fresh context throw the cookies diagnostic', () => {
    const ctx = new TestContext(new Request('http://localhost/'));
    expect(() => ctx.cookies.get('a')).toThrow(CapabilityNotInitializedError);
    expect(() => ctx.cookies.set('a', 'b')).toThrow(CapabilityNotInitializedError);
  });

  it('the slot is reassignable for middleware activation', () => {
    const ctx = new TestContext(new Request('http://localhost/'));
    const store = {
      get: () => 'activated',
      set: () => undefined,
      delete: () => undefined,
      all: () => ({ a: 'activated' }),
      has: () => true,
      signed: {
        get: async () => 'signed',
        set: async () => undefined,
        delete: () => undefined,
      },
    };
    (ctx as { cookies: typeof store }).cookies = store;
    expect(ctx.cookies.get('a')).toBe('activated');
    expect(ctx.cookies).toBe(store);
  });
});
