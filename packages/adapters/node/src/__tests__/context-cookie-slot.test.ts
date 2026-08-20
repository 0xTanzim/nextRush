/**
 * @nextrush/adapter-node — `ctx.cookies` slot wiring contract (RFC-034)
 *
 * `NodeContext` constructs with the shared uninitialized cookie stub — never
 * `undefined` — and the slot is an eager own field (a declared class field,
 * not an accessor) so the cookies middleware's activation is a value write to
 * an existing slot, not a hidden-class transition.
 */

import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { describe, expect, it, vi } from 'vitest';
import { CapabilityNotInitializedError } from '@nextrush/errors';
import { UNINITIALIZED_COOKIES } from '@nextrush/runtime';
import { NodeContext } from '../context';

function createMockReq(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.method = overrides.method ?? 'GET';
  req.url = overrides.url ?? '/';
  req.headers = overrides.headers ?? {};
  return req;
}

function createMockRes(): ServerResponse {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  const res = new ServerResponse(req);
  vi.spyOn(res, 'setHeader').mockImplementation(() => res);
  vi.spyOn(res, 'end').mockImplementation(() => res);
  vi.spyOn(res, 'writeHead').mockImplementation(() => res);
  return res;
}

const newCtx = (): NodeContext => new NodeContext(createMockReq(), createMockRes());

describe('RFC-034: NodeContext cookie slot wiring', () => {
  it('constructs ctx.cookies as the shared uninitialized stub', () => {
    const ctx = newCtx();
    expect(ctx.cookies).toBe(UNINITIALIZED_COOKIES);
  });

  it('is an own field on the instance (declared slot, not prototype accessor)', () => {
    const ctx = newCtx();
    expect(Object.hasOwn(ctx, 'cookies')).toBe(true);
  });

  it('operations throw the cookies diagnostic before middleware runs', () => {
    const ctx = newCtx();
    expect(() => ctx.cookies.get('a')).toThrow(CapabilityNotInitializedError);
    expect(() => ctx.cookies.set('a', 'b')).toThrow(CapabilityNotInitializedError);
    expect(() => ctx.cookies.delete('a')).toThrow(CapabilityNotInitializedError);
  });

  it('the slot is reassignable for middleware activation', () => {
    const ctx = newCtx();
    const store = {
      get: (name: string) => `activated:${name}`,
      set: () => undefined,
      delete: () => undefined,
      all: () => ({}),
      has: () => true,
      signed: {
        get: async () => 'signed',
        set: async () => undefined,
        delete: () => undefined,
      },
    };
    (ctx as { cookies: typeof store }).cookies = store;
    expect(ctx.cookies.get('a')).toBe('activated:a');
  });
});
