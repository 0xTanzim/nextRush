/**
 * @nextrush/adapter-node — Lazy `ctx.bodySource` regression contract (BP-F)
 *
 * `NodeContext` no longer builds the body source eagerly in the constructor; it
 * holds a private `_bodySource?` backing field and materializes it lazily via a
 * memoized `get bodySource()`, so a body-method request whose body is never read
 * allocates no `NodeBodySource` — mirroring the shipped lazy `raw`/`state`.
 */

import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { describe, expect, it, vi } from 'vitest';
import { NodeContext } from '../context';
import { NodeBodySource, createEmptyBodySource } from '../body-source';

function createMockReq(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.method = overrides.method ?? 'POST';
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

const newCtx = (method = 'POST'): NodeContext =>
  new NodeContext(createMockReq({ method }), createMockRes());

describe('BP-F: bodySource is lazy — no NodeBodySource on a body-unread request', () => {
  it('bodySource is a lazy accessor on the prototype, not an eager own field', () => {
    const desc = Object.getOwnPropertyDescriptor(NodeContext.prototype, 'bodySource');
    expect(typeof desc?.get).toBe('function');
  });

  it('does not materialize bodySource as an own property until it is read', () => {
    const ctx = newCtx('POST');
    ctx.status = 201;
    void ctx.params;
    expect(Object.prototype.hasOwnProperty.call(ctx, 'bodySource')).toBe(false);
  });
});

describe('BP-F: materialization, identity, and method policy', () => {
  it('a body-method request materializes a NodeBodySource on first read', () => {
    const ctx = newCtx('POST');
    expect(ctx.bodySource).toBeInstanceOf(NodeBodySource);
  });

  it('repeated reads return the same instance (identity stable)', () => {
    const ctx = newCtx('PUT');
    expect(ctx.bodySource).toBe(ctx.bodySource);
  });

  it.each(['GET', 'HEAD', 'OPTIONS', 'TRACE'])(
    'a bodyless method (%s) resolves to the shared EmptyBodySource singleton',
    (method) => {
      const ctx = newCtx(method);
      expect(ctx.bodySource).toBe(createEmptyBodySource());
    }
  );

  it('DELETE is body-bearing — gets a NodeBodySource, not the empty singleton', () => {
    const ctx = newCtx('DELETE');
    expect(ctx.bodySource).toBeInstanceOf(NodeBodySource);
  });
});
