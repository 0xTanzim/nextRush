/**
 * @nextrush/body-parser — limit propagation (BP-A), depth-walk gate (BP-D),
 * and method-policy alignment (BP-H).
 *
 * These pin the observable contracts introduced by
 * openspec/changes/body-parser-limit-and-hot-path-fixes.
 */

import { describe, expect, it, vi } from 'vitest';
import { json } from '../parsers/json.js';
import { bodyParser } from '../parsers/combined.js';
import { DEFAULT_LIMITS } from '../constants.js';
import type { BodyParserContext, BodyParserBodySource } from '../types.js';
import type { BodySource } from '@nextrush/types';

interface MakeCtxOptions {
  method?: string;
  body?: string;
  contentType?: string;
  /** When set, exposed as bodySource.contentLength + a content-length header. */
  contentLength?: number;
}

/**
 * Build a mock context whose `bodySource.buffer(limit)` simulates the adapter's
 * incremental enforcement: it records the limit it was called with and throws a
 * `BodyTooLargeError`-shaped error when the body exceeds that caller limit.
 */
function makeCtx(opts: MakeCtxOptions = {}): {
  ctx: BodyParserContext;
  calls: { bufferLimit: number | undefined };
} {
  const { method = 'POST', body = '', contentType = 'application/json', contentLength } = opts;
  const bytes = new TextEncoder().encode(body);
  const calls: { bufferLimit: number | undefined } = { bufferLimit: undefined };

  const headers: Record<string, string> = { 'content-type': contentType };
  if (contentLength !== undefined) headers['content-length'] = String(contentLength);

  const ctx: BodyParserContext = {
    method,
    path: '/',
    headers,
    bodySource: {
      text: async () => body,
      buffer: async (limit?: number) => {
        calls.bufferLimit = limit;
        if (limit !== undefined && bytes.byteLength > limit) {
          const err = new Error(`Body too large: ${bytes.byteLength} > ${limit}`);
          err.name = 'BodyTooLargeError';
          throw err;
        }
        return bytes;
      },
      json: async () => JSON.parse(body),
      get consumed() {
        return false;
      },
      get contentLength() {
        return contentLength;
      },
      get contentType() {
        return contentType;
      },
    },
  };
  return { ctx, calls };
}

describe('BP-A — configured limit reaches the reader', () => {
  it('honors a configured limit larger than the adapter 1MB default', async () => {
    const big = 'a'.repeat(2 * 1024 * 1024); // 2 MB
    const { ctx, calls } = makeCtx({ body: JSON.stringify({ x: big }) });
    const next = vi.fn().mockResolvedValue(undefined);

    await json({ limit: '5mb' })(ctx, next);

    expect(calls.bufferLimit).toBe(5 * 1024 * 1024);
    expect((ctx.body as { x: string }).x).toBe(big);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects over a small configured limit and reports THAT limit', async () => {
    const body = JSON.stringify({ x: 'a'.repeat(900 * 1024) }); // ~900 KB
    const { ctx, calls } = makeCtx({ body });
    const next = vi.fn();

    await expect(json({ limit: '10kb' })(ctx, next)).rejects.toMatchObject({
      code: 'ENTITY_TOO_LARGE',
    });
    expect(calls.bufferLimit).toBe(10 * 1024);
    expect(next).not.toHaveBeenCalled();

    // The error message reports the configured limit that fired, not a different layer's.
    const { ctx: ctx2 } = makeCtx({ body });
    await json({ limit: '10kb' })(ctx2, vi.fn()).catch((e: Error) => {
      expect(e.message).toContain(String(10 * 1024));
    });
  });

  it('passes the default 1MB limit when none is configured', async () => {
    const { ctx, calls } = makeCtx({ body: '{"a":1}' });
    await json()(ctx, vi.fn().mockResolvedValue(undefined));
    expect(calls.bufferLimit).toBe(DEFAULT_LIMITS.JSON);
  });
});

describe('BP-D — depth-walk byte-floor gate', () => {
  it('rejects depth beyond maxDepth at the byte-floor boundary', async () => {
    // maxDepth 2 → floor 2*(2+1)=6 bytes; "[[[]]]" is depth 3 and exactly 6 bytes,
    // so the walk runs and rejects.
    const { ctx } = makeCtx({ body: '[[[]]]' });
    await expect(json({ maxDepth: 2 })(ctx, vi.fn())).rejects.toMatchObject({
      code: 'JSON_DEPTH_EXCEEDED',
    });
  });

  it('accepts a payload below the byte floor (walk skipped), result unchanged', async () => {
    // "[[]]" is depth 2 and 4 bytes (< floor 6) → walk skipped → accepted.
    const { ctx } = makeCtx({ body: '[[]]' });
    const next = vi.fn().mockResolvedValue(undefined);
    await json({ maxDepth: 2 })(ctx, next);
    expect(ctx.body).toEqual([[]]);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('never rejects when maxDepth is Infinity', async () => {
    const depth = 500;
    const body = '['.repeat(depth) + ']'.repeat(depth);
    const { ctx } = makeCtx({ body });
    const next = vi.fn().mockResolvedValue(undefined);
    await json({ maxDepth: Infinity })(ctx, next);
    expect(Array.isArray(ctx.body)).toBe(true);
  });
});

describe('BP-H — method policy (DELETE parseable, TRACE bodyless)', () => {
  it('parses a DELETE request body', async () => {
    const { ctx } = makeCtx({ method: 'DELETE', body: '{"gone":true}' });
    const next = vi.fn().mockResolvedValue(undefined);
    await json()(ctx, next);
    expect(ctx.body).toEqual({ gone: true });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('treats TRACE as bodyless (skips parsing)', async () => {
    const { ctx } = makeCtx({ method: 'TRACE', body: '{"x":1}' });
    const next = vi.fn().mockResolvedValue(undefined);
    await json()(ctx, next);
    expect(ctx.body).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('BP-E — combined parser routes once, output matches individual parsers', () => {
  it('bodyParser() JSON result equals json() directly', async () => {
    const body = '{"a":1,"b":[2,3]}';
    const { ctx: c1 } = makeCtx({ body });
    const { ctx: c2 } = makeCtx({ body });
    await bodyParser()(c1, vi.fn().mockResolvedValue(undefined));
    await json()(c2, vi.fn().mockResolvedValue(undefined));
    expect(c1.body).toEqual(c2.body);
    expect(c1.body).toEqual({ a: 1, b: [2, 3] });
  });

  it('bodyParser() routes a form body to the urlencoded parser', async () => {
    const { ctx } = makeCtx({
      body: 'a=1&b=2',
      contentType: 'application/x-www-form-urlencoded',
    });
    await bodyParser()(ctx, vi.fn().mockResolvedValue(undefined));
    expect(ctx.body).toEqual({ a: '1', b: '2' });
  });

  it('bodyParser() still rejects multipart with 415', async () => {
    const { ctx } = makeCtx({ body: 'x', contentType: 'multipart/form-data; boundary=x' });
    await expect(bodyParser()(ctx, vi.fn())).rejects.toMatchObject({
      code: 'UNSUPPORTED_CONTENT_TYPE',
    });
  });
});

describe('BP-J — BodyParserBodySource stays compatible with the canonical BodySource', () => {
  it('the canonical BodySource remains assignable to the decoupled interface', () => {
    // Compile-time guard (checked by `tsc --noEmit`): if a future change to
    // @nextrush/types BodySource (e.g. dropping the buffer(limit?) added in RFC 017)
    // made it no longer structurally satisfy BodyParserBodySource, `_Assert` would
    // become `false` and `const ok: _Assert = true` would fail to compile.
    type _Assert = BodySource extends BodyParserBodySource ? true : false;
    const ok: _Assert = true;
    expect(ok).toBe(true);
  });
});
