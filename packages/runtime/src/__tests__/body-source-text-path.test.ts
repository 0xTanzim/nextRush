/**
 * @nextrush/runtime — the text-first body read.
 *
 * @remarks
 * `readTextIfProvenWithin` is only allowed to run when the transport proves the
 * body fits a limit: a declared `Content-Length` at or below it. Everything else
 * must decline without consuming the body, so the incremental byte reader still
 * gets its turn. These cases pin that gate, the byte checks behind it, and the
 * cache contract that makes a later `buffer()` observe the same body.
 */
import { describe, expect, it } from 'vitest';
import { WebBodySource } from '../body-source';

const JSON_TYPE = 'application/json';

function sourceFor(
  body: string | undefined,
  options: {
    contentLength?: string | number;
    contentType?: string;
    encoding?: 'utf-8' | 'latin1';
  } = {}
): WebBodySource {
  const headers: Record<string, string> = { 'content-type': options.contentType ?? JSON_TYPE };
  if (options.contentLength !== undefined) {
    headers['content-length'] = String(options.contentLength);
  }
  const init: RequestInit = { method: 'POST', headers };
  if (body !== undefined) init.body = body;
  return new WebBodySource(new Request('http://localhost/echo', init), {
    ...(options.encoding === undefined ? {} : { encoding: options.encoding }),
  });
}

describe('WebBodySource.readTextIfProvenWithin', () => {
  it('returns the decoded body when Content-Length proves it fits', async () => {
    const source = sourceFor('{"hello":"world"}', { contentLength: 17 });

    await expect(source.readTextIfProvenWithin(1024)).resolves.toBe('{"hello":"world"}');
    expect(source.consumed).toBe(true);
  });

  it('leaves the byte read intact after a text read', async () => {
    const body = '{"a":"é"}';
    const expected = new TextEncoder().encode(body);
    const source = sourceFor(body, { contentLength: expected.byteLength });

    await source.readTextIfProvenWithin(1024);
    const bytes = await source.buffer(1024);

    expect(bytes).toEqual(expected);
    // Cached, not re-read from the request.
    await expect(source.buffer(1024)).resolves.toBe(bytes);
  });

  it('repeats the same string for a later text read', async () => {
    const source = sourceFor('{"a":1}', { contentLength: 7 });

    const first = await source.readTextIfProvenWithin(1024);
    await expect(source.text()).resolves.toBe(first);
  });

  it('declines without consuming when Content-Length is absent', async () => {
    const source = sourceFor('{"a":1}');

    await expect(source.readTextIfProvenWithin(1024)).resolves.toBeUndefined();

    expect(source.consumed).toBe(false);
    // The fallback still owns the body.
    await expect(source.buffer(1024)).resolves.toEqual(new TextEncoder().encode('{"a":1}'));
  });

  it('declines without consuming when Content-Length exceeds the limit', async () => {
    const source = sourceFor('{"a":1}', { contentLength: 7 });

    await expect(source.readTextIfProvenWithin(4)).resolves.toBeUndefined();

    expect(source.consumed).toBe(false);
  });

  it('declines when the source is configured for a non-UTF-8 encoding', async () => {
    // `request.text()` always decodes UTF-8, so another encoding cannot be served from it.
    const source = sourceFor('{"a":1}', { contentLength: 7, encoding: 'latin1' });

    await expect(source.readTextIfProvenWithin(1024)).resolves.toBeUndefined();
    expect(source.consumed).toBe(false);
  });

  it('rejects a body whose encoded size exceeds the limit despite an allowed length', async () => {
    // Framing should prevent this, but the post-read check is the backstop if a
    // runtime ever hands over more than the declared length.
    const body = 'é'.repeat(10); // 10 code units, 20 UTF-8 bytes
    const source = sourceFor(body, { contentLength: 10 });

    await expect(source.readTextIfProvenWithin(10)).rejects.toMatchObject({
      name: 'BodyTooLargeError',
      limit: 10,
      // Bytes, not code units: the error contract reports the encoded size.
      received: 20,
    });
    expect(source.consumed).toBe(true);
    // The rejected body must not be retrievable through the text cache.
    await expect(source.buffer(10)).rejects.toMatchObject({ name: 'BodyConsumedError' });
  });

  it('accepts a one-megabyte body at the default limit', async () => {
    const body = JSON.stringify({ v: 'x'.repeat(1024 * 1024 - 8) });
    const source = sourceFor(body, { contentLength: body.length });

    await expect(source.readTextIfProvenWithin(1024 * 1024)).resolves.toBe(body);
  });

  it('rejects a read after the body was already consumed', async () => {
    const source = sourceFor('{"a":1}', { contentLength: 7 });
    await source.buffer(1024);

    await expect(source.readTextIfProvenWithin(1024)).rejects.toMatchObject({
      name: 'BodyConsumedError',
    });
  });
});
