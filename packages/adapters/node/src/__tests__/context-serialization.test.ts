/**
 * @nextrush/adapter-node - Serialize before commit
 *
 * A response method must not mark the response committed until it holds the
 * bytes it is going to write. Committing first is what turned an unserializable
 * value into a socket that hangs: the throw reached the error handler, which
 * then found the response already marked sent and wrote nothing.
 */

import { describe, expect, it } from 'vitest';
import { NodeContext } from '../context';
import { createMockRequest, createMockResponse } from './_shared/mock-response';

function makeCtx() {
  const { res, setHeader, end, writeHead } = createMockResponse();
  return { ctx: new NodeContext(createMockRequest(), res), setHeader, end, writeHead };
}

/** Values `JSON.stringify` cannot represent, with the class its message must name. */
const UNSERIALIZABLE: ReadonlyArray<[label: string, value: unknown, named: RegExp]> = [
  ['a BigInt', 10n, /BigInt/],
  ['undefined', undefined, /undefined/],
  ['a function', () => undefined, /function/],
  ['a Symbol', Symbol('value'), /Symbol/],
];

describe('NodeContext - serialize before commit', () => {
  it('writes a complete JSON response for a serializable value', () => {
    const { ctx, writeHead, end } = makeCtx();

    ctx.json({ ok: true });
    expect(ctx.responded).toBe(true);

    ctx.flushResponse();

    expect(writeHead).toHaveBeenCalledWith(200, {
      'Content-Type': 'application/json',
      'Content-Length': '11',
    });
    expect(end).toHaveBeenCalledWith('{"ok":true}');
  });

  it.each(UNSERIALIZABLE)('throws for %s without writing a byte', (_label, value) => {
    const { ctx, setHeader, end, writeHead } = makeCtx();

    expect(() => ctx.json(value)).toThrow(TypeError);

    expect(ctx.responded).toBe(false);
    expect(writeHead).not.toHaveBeenCalled();
    expect(setHeader).not.toHaveBeenCalled();
    expect(end).not.toHaveBeenCalled();
  });

  it.each(UNSERIALIZABLE)('names %s in the thrown message', (_label, value, named) => {
    const { ctx } = makeCtx();

    expect(() => ctx.json(value)).toThrow(named);
  });

  it('rejects a circular structure without committing', () => {
    const { ctx, end } = makeCtx();
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    expect(() => ctx.json(cyclic)).toThrow(/circular/i);
    expect(ctx.responded).toBe(false);
    expect(end).not.toHaveBeenCalled();
  });

  it('answers a later write after a serialization failure', () => {
    const { ctx, end } = makeCtx();

    expect(() => ctx.json(10n)).toThrow(TypeError);

    const envelope = { error: 'Internal Server Error', status: 500 };
    ctx.json(envelope);
    expect(ctx.responded).toBe(true);

    ctx.flushResponse();

    expect(end).toHaveBeenCalledWith(JSON.stringify(envelope));
  });

  it('guards the object branch of send() through the same serializer', () => {
    const { ctx, end } = makeCtx();

    expect(() => ctx.send({ n: 10n })).toThrow(TypeError);

    expect(ctx.responded).toBe(false);
    expect(end).not.toHaveBeenCalled();
  });

  it('refuses a locked stream without committing the response', () => {
    const { ctx, end } = makeCtx();
    const source = new ReadableStream<Uint8Array>();
    void source.getReader();

    expect(() => ctx.sendStream(source)).toThrow(TypeError);

    expect(ctx.responded).toBe(false);
    expect(end).not.toHaveBeenCalled();
  });

  it('refuses a locked Web stream passed to send() without committing', () => {
    const { ctx, end } = makeCtx();
    const source = new ReadableStream<Uint8Array>();
    void source.getReader();

    expect(() => ctx.send(source)).toThrow(TypeError);

    expect(ctx.responded).toBe(false);
    expect(end).not.toHaveBeenCalled();
  });

  it('refuses an object that only looks like a Node stream, without committing', () => {
    const { ctx, end } = makeCtx();

    expect(() => ctx.send({ pipe: () => undefined } as never)).toThrow(TypeError);

    expect(ctx.responded).toBe(false);
    expect(end).not.toHaveBeenCalled();
  });

  it.each([
    ['a string', 'plain', 'plain'],
    ['a number', 42, '42'],
    ['a Uint8Array', new Uint8Array([104, 105]), 'hi'],
  ])('commits and writes %s through send()', (_label, value, written) => {
    const { ctx, end } = makeCtx();

    ctx.send(value as never);
    expect(ctx.responded).toBe(true);

    ctx.flushResponse();

    expect(end).toHaveBeenCalled();
    // The recorded body is written through in the form it was recorded: a string
    // reaches `res.end` as a string (Node encodes it once, no intermediate
    // array), and bytes reach it as bytes.
    const chunk = end.mock.calls[0]?.[0];
    const text =
      typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk as Uint8Array);
    expect(text).toBe(written);
    expect(typeof chunk).toBe(typeof value === 'string' ? 'string' : typeof chunk);
  });

  it('commits and writes html() and redirect()', () => {
    const html = makeCtx();
    html.ctx.html('<p>hi</p>');
    expect(html.ctx.responded).toBe(true);
    html.ctx.flushResponse();
    expect(html.end).toHaveBeenCalledWith('<p>hi</p>');

    const redirect = makeCtx();
    redirect.ctx.redirect('/next');
    expect(redirect.ctx.responded).toBe(true);
    redirect.ctx.flushResponse();
    expect(redirect.end).toHaveBeenCalledWith('Redirecting to /next');
  });

  it('does not write again when a stream writer starts after the response was sent', async () => {
    const { ctx, end } = makeCtx();
    ctx.json({ ok: true });
    end.mockClear();

    await ctx.ndjson(async (writer) => {
      await writer.write({ a: 1 });
    });

    expect(end).not.toHaveBeenCalled();
  });

  it('commits the streaming methods only through a writable stream', async () => {
    const { ctx, end } = makeCtx();

    await ctx.stream(async (writer) => {
      await writer.write('hello');
    });

    expect(ctx.responded).toBe(true);
    expect(end).toHaveBeenCalled();
  });
});
