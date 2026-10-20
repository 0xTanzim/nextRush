/**
 * @nextrush/body-parser — the JSON parser's body-read selection.
 *
 * @remarks
 * The parser may skip the byte buffer only when the body source proves the body
 * fits and nobody asked for bytes. `rawBody` and `verify` always force the byte
 * path, because both hand the raw payload to caller code. These cases pin that
 * selection, the fallback when a source offers no text capability, and the
 * behaviour the parser still owes on the text path (empty bodies, depth limits,
 * malformed JSON, size limits).
 */
import { describe, expect, it, vi } from 'vitest';
import { json } from '../parsers/json';
import type { BodyParserContext } from '../types';

type Source = NonNullable<BodyParserContext['bodySource']>;

/** Test double: the parser only reads these fields off the context. */
function contextWith(source: Source): BodyParserContext {
  return {
    method: 'POST',
    path: '/',
    headers: { 'content-type': 'application/json' },
    bodySource: source,
  } as unknown as BodyParserContext;
}

interface CapableOptions {
  contentLength?: number;
  text: string;
}

/**
 * A source that advertises the text capability. Call assertions prove the
 * parser took the text path rather than reading bytes first.
 */
function textCapable({ contentLength, text }: CapableOptions): Source {
  const bytes = new TextEncoder().encode(text);
  return {
    contentLength,
    contentType: 'application/json',
    consumed: false,
    text: vi.fn(async () => text),
    buffer: vi.fn(async () => bytes),
    json: vi.fn(async () => JSON.parse(text) as never),
    readTextIfProvenWithin: vi.fn(async () => text),
  } as unknown as Source;
}

/** A source without the capability: the pre-existing shape every adapter can rely on. */
function bytesOnly(text: string): Source {
  const bytes = new TextEncoder().encode(text);
  return {
    contentLength: bytes.byteLength,
    contentType: 'application/json',
    consumed: false,
    text: vi.fn(async () => text),
    buffer: vi.fn(async () => bytes),
    json: vi.fn(async () => JSON.parse(text) as never),
  } as unknown as Source;
}

describe('json parser — body read selection', () => {
  it('parses through the text capability when no bytes are requested', async () => {
    const source = textCapable({ contentLength: 7, text: '{"a":1}' });
    const ctx = contextWith(source);

    await json({ limit: 1024 })(ctx);

    expect(ctx.body).toEqual({ a: 1 });
    expect(source.readTextIfProvenWithin).toHaveBeenCalledWith(1024);
    expect(source.buffer).not.toHaveBeenCalled();
  });

  it('falls back to the byte read when the source has no text capability', async () => {
    const source = bytesOnly('{"a":2}');
    const ctx = contextWith(source);

    await json({ limit: 1024 })(ctx);

    expect(ctx.body).toEqual({ a: 2 });
    expect(source.buffer).toHaveBeenCalledWith(1024);
  });

  it('reads bytes when rawBody is requested', async () => {
    const source = textCapable({ contentLength: 7, text: '{"a":3}' });
    const ctx = contextWith(source);

    await json({ limit: 1024, rawBody: true })(ctx);

    expect(ctx.body).toEqual({ a: 3 });
    expect(source.readTextIfProvenWithin).not.toHaveBeenCalled();
    expect(ctx.rawBody).toBeDefined();
  });

  it('reads bytes before invoking verify', async () => {
    const source = textCapable({ contentLength: 7, text: '{"a":4}' });
    const ctx = contextWith(source);
    const seen: number[] = [];

    await json({
      limit: 1024,
      verify: async (_ctx, bytes) => {
        seen.push(bytes.length);
      },
    })(ctx);

    expect(seen).toEqual([7]);
    expect(source.readTextIfProvenWithin).not.toHaveBeenCalled();
  });

  it('treats an empty text body as no body and continues the chain', async () => {
    const source = textCapable({ contentLength: 0, text: '' });
    const ctx = contextWith(source);
    const next = vi.fn(async () => undefined);

    await json({ limit: 1024 })(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(ctx.body).toBeUndefined();
  });

  it('still rejects a body deeper than maxDepth on the text path', async () => {
    const source = textCapable({ contentLength: 14, text: '{"é":{"b":1}}' });
    const ctx = contextWith(source);

    await expect(json({ limit: 1024, maxDepth: 1 })(ctx)).rejects.toMatchObject({
      name: 'BodyParserError',
    });
    expect(ctx.body).toBeUndefined();
  });

  it('rejects malformed JSON on the text path without a placeholder body', async () => {
    const source = textCapable({ contentLength: 9, text: '{"a":oops}' });
    const ctx = contextWith(source);

    await expect(json({ limit: 1024 })(ctx)).rejects.toMatchObject({
      name: 'BodyParserError',
    });
    expect(ctx.body).toBeUndefined();
  });

  it('maps a text-path size failure to the entity-too-large error', async () => {
    const source = {
      ...textCapable({ contentLength: 7, text: '{"a":5}' }),
      readTextIfProvenWithin: vi.fn(async () => {
        throw Object.assign(new Error('too large'), { name: 'BodyTooLargeError' });
      }),
    } as unknown as Source;
    const ctx = contextWith(source);

    await expect(json({ limit: 1024 })(ctx)).rejects.toMatchObject({
      name: 'BodyParserError',
      code: 'ENTITY_TOO_LARGE',
    });
  });

  it('rejects a declared length above the limit before reading anything', async () => {
    const source = textCapable({ contentLength: 4096, text: '{}' });
    const ctx = contextWith(source);

    await expect(json({ limit: 1024 })(ctx)).rejects.toMatchObject({
      name: 'BodyParserError',
    });
    expect(source.readTextIfProvenWithin).not.toHaveBeenCalled();
    expect(source.buffer).not.toHaveBeenCalled();
  });
});
