/**
 * @nextrush/adapter-node — NodeBodySource.buffer(limit) enforcement (BP-A / RFC 017)
 *
 * The caller-supplied per-read limit takes precedence over the construction-time
 * limit for BOTH the Content-Length pre-check and the incremental streaming check,
 * so a body-parser's configured limit is enforced at read time. Passing no argument
 * preserves the construction-time behavior exactly.
 */

import { BodyTooLargeError } from '@nextrush/runtime';
import type { IncomingMessage } from 'node:http';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { NodeBodySource } from '../body-source';

function makeReq(chunks: string[], headers: Record<string, string> = {}): IncomingMessage {
  const readable = new Readable({ read() {} });
  const req = readable as unknown as IncomingMessage;
  req.headers = headers;
  setImmediate(() => {
    for (const c of chunks) readable.push(c);
    readable.push(null);
  });
  return req;
}

describe('NodeBodySource.buffer(limit) — caller limit precedence (BP-A)', () => {
  it('rejects on a Content-Length over the caller limit, before reading', async () => {
    const req = makeReq(['x'.repeat(200)], { 'content-length': '200' });
    const source = new NodeBodySource(req); // construction default = 1 MB
    await expect(source.buffer(50)).rejects.toBeInstanceOf(BodyTooLargeError);
    expect(req.listenerCount('data')).toBe(0); // pre-check threw synchronously
  });

  it('rejects mid-stream over the caller limit (no Content-Length), without a socket reset (BP-K)', async () => {
    const req = makeReq(['x'.repeat(30), 'y'.repeat(30)]); // 60 bytes, chunked
    const source = new NodeBodySource(req); // default 1 MB
    await expect(source.buffer(40)).rejects.toBeInstanceOf(BodyTooLargeError);
    // BP-K: the stream is NOT destroyed (an immediate destroy raced the 413 response);
    // consumption stops via listener detach + pause so the response can flush cleanly.
    expect(req.destroyed).toBe(false);
    expect(req.listenerCount('data')).toBe(0);
  });

  it('reports the caller limit that fired in the error', async () => {
    const req = makeReq(['x'.repeat(200)], { 'content-length': '200' });
    const source = new NodeBodySource(req);
    await source.buffer(50).catch((err: BodyTooLargeError) => {
      expect(err.limit).toBe(50);
    });
  });

  it('honors a caller limit HIGHER than the construction default', async () => {
    const req = makeReq(['z'.repeat(50)]); // 50 bytes, chunked
    const source = new NodeBodySource(req, { limit: 10 }); // low construction limit
    const buf = await source.buffer(100); // caller limit overrides the low default
    expect(buf.length).toBe(50);
  });

  it('with no argument, enforces the construction-time limit (backward-compatible)', async () => {
    const req = makeReq(['z'.repeat(60)]);
    const source = new NodeBodySource(req, { limit: 40 });
    await expect(source.buffer()).rejects.toBeInstanceOf(BodyTooLargeError);
  });
});
