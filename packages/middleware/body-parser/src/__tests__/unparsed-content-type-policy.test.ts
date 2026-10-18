/**
 * @nextrush/body-parser - the unparsed-content-type policy
 *
 * An unmatched `Content-Type` used to be ignored silently: a `POST` with
 * `Content-Type: application/xml` answered 200 with `ctx.body === undefined`, so
 * a handler that forgot to check, or a validator downstream, reported the wrong
 * problem. `multipart/*` already rejected; the policy makes the rest of that
 * behaviour explicit without changing today's default.
 */

import { describe, expect, it, vi } from 'vitest';
import { bodyParser, type BodyParserContext } from '../index';

function createMockContext(
  method: string,
  contentType?: string,
  body?: string
): BodyParserContext {
  const headers: Record<string, string | undefined> = {};
  if (contentType !== undefined) headers['content-type'] = contentType;
  if (body !== undefined) headers['content-length'] = String(body.length);

  return {
    method,
    path: '/',
    headers,
    bodySource: {
      async text() {
        return body ?? '';
      },
      async buffer() {
        return new TextEncoder().encode(body ?? '');
      },
      async json<T>() {
        return JSON.parse(body ?? 'null') as T;
      },
      get consumed() {
        return false;
      },
      get contentLength() {
        return undefined;
      },
      get contentType() {
        return undefined;
      },
    },
  };
}

const XML = 'application/xml';
const MULTIPART = 'multipart/form-data; boundary=----x';

describe("onUnsupportedContentType: 'ignore' (the default)", () => {
  it('continues with the body left undefined for an unmatched content type', async () => {
    const next = vi.fn().mockResolvedValue(undefined);
    const ctx = createMockContext('POST', XML, '<a/>');

    await bodyParser()(ctx, next);

    expect(ctx.body).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it('still rejects multipart, which has always had a dedicated error', async () => {
    const ctx = createMockContext('POST', MULTIPART, '--x');

    await expect(bodyParser()(ctx, vi.fn())).rejects.toMatchObject({
      status: 415,
      code: 'UNSUPPORTED_CONTENT_TYPE',
    });
  });
});

describe("onUnsupportedContentType: 'reject'", () => {
  const parser = bodyParser({ onUnsupportedContentType: 'reject' });

  it('answers 415 for an unmatched content type instead of running handlers', async () => {
    const next = vi.fn().mockResolvedValue(undefined);
    const ctx = createMockContext('POST', XML, '<a/>');

    await expect(parser(ctx, next)).rejects.toMatchObject({
      name: 'BodyParserError',
      status: 415,
      code: 'UNSUPPORTED_CONTENT_TYPE',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('names the received content type in the message', async () => {
    const error = await parser(createMockContext('POST', XML, '<a/>'), vi.fn()).catch(
      (err: unknown) => err
    );

    expect((error as Error).message).toContain(XML);
  });

  it('never rejects a bodyless method', async () => {
    const next = vi.fn().mockResolvedValue(undefined);
    const ctx = createMockContext('GET', XML);

    await parser(ctx, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('never rejects a request with no content type at all', async () => {
    const next = vi.fn().mockResolvedValue(undefined);
    const ctx = createMockContext('POST', undefined, 'opaque');

    await parser(ctx, next);

    expect(ctx.body).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it('leaves a matched content type parsing exactly as before', async () => {
    const next = vi.fn().mockResolvedValue(undefined);
    const ctx = createMockContext('POST', 'application/json; charset=utf-8', '{"a":1}');

    await parser(ctx, next);

    expect(ctx.body).toEqual({ a: 1 });
    expect(next).toHaveBeenCalledOnce();
  });

  it('still ignores a request whose body was already parsed upstream', async () => {
    const next = vi.fn().mockResolvedValue(undefined);
    const ctx = createMockContext('POST', XML, '<a/>');
    ctx.body = { parsed: true };

    await parser(ctx, next);

    expect(ctx.body).toEqual({ parsed: true });
    expect(next).toHaveBeenCalledOnce();
  });
});
