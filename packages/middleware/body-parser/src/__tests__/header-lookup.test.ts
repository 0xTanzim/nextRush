/**
 * The parser must read one header without materializing the whole record.
 *
 * `ctx.headers` is a lazily built record: the first read walks every request header.
 * A parser that only needs `content-type` and `content-length` should not pay for that
 * walk, so it reads through `ctx.get(name)` when the context offers it. This test
 * makes the rule falsifiable instead of a comment: the header record throws if touched.
 */
import { describe, expect, it, vi } from 'vitest';
import { bodyParser, getContentLength, getContentType, json, type BodyParserContext } from '../index';

function source(payload: string): BodyParserContext['bodySource'] {
  const bytes = new TextEncoder().encode(payload);
  let consumed = false;
  return {
    text() {
      consumed = true;
      return Promise.resolve(payload);
    },
    buffer() {
      consumed = true;
      return Promise.resolve(bytes);
    },
    json<T>() {
      consumed = true;
      return Promise.resolve(JSON.parse(payload) as T);
    },
    get consumed() {
      return consumed;
    },
    get contentLength() {
      return undefined;
    },
    get contentType() {
      return undefined;
    },
  };
}

function contextWithThrowingRecord(values: Record<string, string>): BodyParserContext {
  return {
    method: 'POST',
    path: '/echo',
    get(name: string) {
      return values[name.toLowerCase()];
    },
    get headers(): never {
      throw new Error('the parser materialized the header record');
    },
    bodySource: source('{"ok":true}'),
  };
}

describe('header lookup', () => {
  it('parses through ctx.get without touching the header record', async () => {
    const ctx = contextWithThrowingRecord({ 'content-type': 'application/json' });
    const next = vi.fn().mockResolvedValue(undefined);

    await bodyParser()(ctx, next);

    expect(ctx.body).toEqual({ ok: true });
    expect(next).toHaveBeenCalledOnce();
  });

  it('reads content-length through ctx.get when the body source does not report it', async () => {
    const ctx = contextWithThrowingRecord({
      'content-type': 'application/json',
      'content-length': '11',
    });
    const next = vi.fn().mockResolvedValue(undefined);

    await expect(json({ limit: 1 })(ctx, next)).rejects.toThrow();

    expect(next).not.toHaveBeenCalled();
  });

  it('falls back to the header record when the context has no get()', async () => {
    const ctx: BodyParserContext = {
      method: 'POST',
      path: '/echo',
      headers: { 'content-type': 'application/json' },
      bodySource: source('{"ok":true}'),
    };
    const next = vi.fn().mockResolvedValue(undefined);

    await bodyParser()(ctx, next);

    expect(ctx.body).toEqual({ ok: true });
  });

  it('keeps the dedicated JSON parser on the same lookup', async () => {
    const ctx = contextWithThrowingRecord({ 'content-type': 'application/json' });
    const next = vi.fn().mockResolvedValue(undefined);

    await json()(ctx, next);

    expect(ctx.body).toEqual({ ok: true });
  });

  it('keeps the exported record-based helpers working for callers that still pass a record', () => {
    expect(getContentType({ 'content-type': 'application/json' })).toBe('application/json');
    expect(getContentType({ 'content-type': ['text/plain', 'application/xml'] })).toBe('text/plain');
    expect(getContentType({})).toBeUndefined();

    expect(getContentLength({ 'content-length': '11' })).toBe(11);
    expect(getContentLength({ 'content-length': ['12'] })).toBe(12);
    expect(getContentLength({ 'content-length': '-1' })).toBeUndefined();
    expect(getContentLength({})).toBeUndefined();
  });
});
