/**
 * @nextrush/adapter-node - per-call response arguments (RFC-048).
 *
 * The Node context is the second implementation of the shared Contract; the
 * conformance suite proves parity, and these unit tests pin the Node-specific
 * paths the Web builder does not have: `send()`'s object delegation to `json()`
 * and a bodyless status on a stream (which must not pipe bytes or strand the
 * producer).
 */

import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { Readable } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  vi.spyOn(res, 'writeHead').mockImplementation((status: number) => {
    res.statusCode = status;
    return res;
  });

  return res;
}

function writtenHeaders(res: ServerResponse): Record<string, unknown> {
  const calls = vi.mocked(res.writeHead).mock.calls;
  return (calls[0]?.[1] ?? {}) as Record<string, unknown>;
}

function writtenBody(res: ServerResponse): unknown {
  const calls = vi.mocked(res.end).mock.calls;
  return calls[0]?.[0];
}

describe('NodeContext response arguments (RFC-048)', () => {
  let req: IncomingMessage;
  let res: ServerResponse;
  let ctx: NodeContext;

  beforeEach(() => {
    req = createMockReq();
    res = createMockRes();
    ctx = new NodeContext(req, res);
  });

  it('applies a numeric status and records it on the context', () => {
    ctx.json({ ok: true }, 201);
    ctx.flushResponse();

    expect(res.statusCode).toBe(201);
    expect(ctx.status).toBe(201);
    expect(writtenBody(res)).toBe('{"ok":true}');
  });

  it('applies an options status and headers', () => {
    ctx.json({ ok: true }, { status: 202, headers: { 'X-Trace': 't1' } });
    ctx.flushResponse();

    expect(res.statusCode).toBe(202);
    expect(writtenHeaders(res)['X-Trace']).toBe('t1');
    expect(writtenHeaders(res)['Content-Type']).toBe('application/json');
  });

  it('routes send(object, status) through the JSON path with that status', () => {
    ctx.send({ id: 'u_1' }, 201);
    ctx.flushResponse();

    expect(res.statusCode).toBe(201);
    expect(writtenBody(res)).toBe('{"id":"u_1"}');
    expect(writtenHeaders(res)['Content-Type']).toBe('application/json');
  });

  it('applies the argument to html()', () => {
    ctx.html('<b>hi</b>', { status: 203 });
    ctx.flushResponse();

    expect(res.statusCode).toBe(203);
    expect(writtenHeaders(res)['Content-Type']).toBe('text/html; charset=utf-8');
  });

  it('lets an explicit status beat a previously assigned status', () => {
    ctx.status = 200;
    ctx.json({ ok: true }, 201);

    expect(ctx.status).toBe(201);
  });

  it('rejects an invalid status before committing anything', () => {
    expect(() => { ctx.json({ ok: true }, 600); }).toThrow(RangeError);

    expect(ctx.responded).toBe(false);
    expect(res.writeHead).not.toHaveBeenCalled();
  });

  it('rejects a supplied Content-Length before committing anything', () => {
    expect(() => {
      ctx.json({ ok: true }, { headers: { 'Content-Length': '10' } });
    }).toThrow(TypeError);

    expect(ctx.responded).toBe(false);
    expect(res.writeHead).not.toHaveBeenCalled();
  });

  it('changes nothing when the response is already committed', () => {
    ctx.json({ ok: true });
    ctx.json({ late: true }, { status: 500 });

    expect(ctx.status).toBe(200);
    expect(ctx.responded).toBe(true);
  });

  it('suppresses the body of a stream at a bodyless status instead of piping it', () => {
    const stream = Readable.from(['chunk']);

    ctx.send(stream, { status: 204 });
    ctx.flushResponse();

    expect(res.statusCode).toBe(204);
    expect(writtenBody(res)).toBeUndefined();
    expect(stream.destroyed).toBe(true);
  });
});
