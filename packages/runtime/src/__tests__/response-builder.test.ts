/**
 * @nextrush/runtime - WebResponseBuilder tests (F-04b)
 *
 * The shared, composable Web response collaborator. It owns the response
 * builder state (status/headers/body), the response methods
 * (json/send/html/redirect/getResponse/sendStream), HEAD/204/304/1xx body
 * suppression, and CRLF-guarded header setting — so the Bun/Deno/Edge contexts
 * compose it instead of copy-pasting ~200 lines each.
 */

import { describe, expect, it } from 'vitest';
import { assertHeaderSafe, isBodylessResponse, WebResponseBuilder } from '../response-builder.js';

describe('isBodylessResponse', () => {
  it('suppresses body for HEAD, 204, 304, and 1xx', () => {
    expect(isBodylessResponse('HEAD', 200)).toBe(true);
    expect(isBodylessResponse('GET', 204)).toBe(true);
    expect(isBodylessResponse('GET', 304)).toBe(true);
    expect(isBodylessResponse('GET', 100)).toBe(true);
    expect(isBodylessResponse('GET', 199)).toBe(true);
  });

  it('allows a body for normal responses', () => {
    expect(isBodylessResponse('GET', 200)).toBe(false);
    expect(isBodylessResponse('POST', 201)).toBe(false);
    expect(isBodylessResponse('GET', 302)).toBe(false);
  });
});

describe('assertHeaderSafe', () => {
  it('rejects CRLF in the field name', () => {
    expect(() => assertHeaderSafe('X-Bad\r\nInjected', 'v')).toThrow(
      'Header field contains invalid characters'
    );
  });

  it('rejects CRLF in a string value', () => {
    expect(() => assertHeaderSafe('X-Ok', 'bad\nvalue')).toThrow(
      'Header value contains invalid characters'
    );
  });

  it('rejects CRLF in any array value', () => {
    expect(() => assertHeaderSafe('Set-Cookie', ['a=1', 'b=2\r\nx'])).toThrow(
      'Header value contains invalid characters'
    );
  });

  it('accepts numeric values', () => {
    expect(() => assertHeaderSafe('X-Count', 42)).not.toThrow();
  });
});

describe('WebResponseBuilder', () => {
  it('json() sets content-type, status and serialized body', async () => {
    const rb = new WebResponseBuilder('GET');
    rb.json({ ok: true }, 201);
    expect(rb.responded).toBe(true);
    const res = rb.getResponse(200);
    expect(res.status).toBe(201);
    expect(res.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    expect(await res.json()).toEqual({ ok: true });
  });

  it('send() handles string, object, Uint8Array, and null', async () => {
    const str = new WebResponseBuilder('GET');
    str.send('hello', 200);
    expect(await str.getResponse(200).text()).toBe('hello');
    expect(str.getResponse(200).headers.get('Content-Type')).toBe('text/plain; charset=utf-8');

    const obj = new WebResponseBuilder('GET');
    obj.send({ a: 1 }, 200);
    expect(await obj.getResponse(200).json()).toEqual({ a: 1 });

    const bin = new WebResponseBuilder('GET');
    bin.send(new Uint8Array([1, 2, 3]), 200);
    expect(bin.getResponse(200).headers.get('Content-Type')).toBe('application/octet-stream');

    const empty = new WebResponseBuilder('GET');
    empty.send(null, 200);
    expect(await empty.getResponse(200).text()).toBe('');
  });

  it('html() sets text/html', () => {
    const rb = new WebResponseBuilder('GET');
    rb.html('<h1>hi</h1>', 200);
    expect(rb.getResponse(200).headers.get('Content-Type')).toBe('text/html; charset=utf-8');
  });

  it('redirect() sets Location and default status, text/plain body', () => {
    const rb = new WebResponseBuilder('GET');
    rb.redirect('/login', 302);
    const res = rb.getResponse(200);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/login');
    expect(res.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
  });

  it('set() accumulates Set-Cookie and replaces on array', () => {
    const rb = new WebResponseBuilder('GET');
    rb.set('Set-Cookie', 'a=1; Path=/');
    rb.set('Set-Cookie', 'b=2; Path=/');
    expect(rb.getResponse(200).headers.getSetCookie()).toHaveLength(2);

    const rb2 = new WebResponseBuilder('GET');
    rb2.set('Set-Cookie', 'old=1');
    rb2.set('Set-Cookie', ['n1=a', 'n2=b']);
    const cookies = rb2.getResponse(200).headers.getSetCookie();
    expect(cookies).toHaveLength(2);
    expect(cookies).toContain('n1=a');
  });

  it('set() overwrites non-cookie headers and guards CRLF', () => {
    const rb = new WebResponseBuilder('GET');
    rb.set('X-Custom', 'first');
    rb.set('X-Custom', 'second');
    expect(rb.getResponse(200).headers.get('X-Custom')).toBe('second');
    expect(() => rb.set('X-Bad', 'a\r\nb')).toThrow('Header value contains invalid characters');
  });

  it('getResponse() suppresses body for HEAD/204/304 but keeps headers', () => {
    const head = new WebResponseBuilder('HEAD');
    head.set('X-Keep', 'yes');
    head.json({ data: 1 }, 200);
    const res = head.getResponse(200);
    expect(res.body).toBeNull();
    expect(res.headers.get('X-Keep')).toBe('yes');

    const noContent = new WebResponseBuilder('GET');
    noContent.set('X-Keep', 'yes');
    const res204 = noContent.getResponse(204);
    expect(res204.status).toBe(204);
    expect(res204.body).toBeNull();
    expect(res204.headers.get('X-Keep')).toBe('yes');
  });

  it('getResponse() falls back to the context status when not responded', () => {
    const rb = new WebResponseBuilder('GET');
    rb.set('X-Keep', 'yes');
    const res = rb.getResponse(418);
    expect(res.status).toBe(418);
    expect(res.headers.get('X-Keep')).toBe('yes');
  });

  it('sendStream() wires a byte stream as the body', async () => {
    const rb = new WebResponseBuilder('GET');
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('chunk'));
        controller.close();
      },
    });
    rb.sendStream(stream, 200);
    expect(rb.responded).toBe(true);
    expect(await rb.getResponse(200).text()).toBe('chunk');
  });

  // F-12: a Node-style Readable (has `.pipe` + is async-iterable) must stream,
  // not get JSON.stringify'd into `{}`.
  it('send() adapts a Node Readable stream instead of serializing it to {}', async () => {
    const nodeReadable = {
      pipe(): void {
        /* Node Readable surface — unused by the Web adapter */
      },
      async *[Symbol.asyncIterator](): AsyncGenerator<Uint8Array> {
        yield new TextEncoder().encode('node-');
        yield new TextEncoder().encode('stream');
      },
    };

    const rb = new WebResponseBuilder('GET');
    rb.send(nodeReadable, 200);
    const res = rb.getResponse(200);
    expect(res.headers.get('Content-Type')).toBe('application/octet-stream');
    expect(await res.text()).toBe('node-stream');
  });

  // F-18: string/json/html bodies must NOT carry a builder-set Content-Length;
  // the runtime derives it from the BodyInit at serialization time. Before the
  // fix the builder eagerly encoded the body to set this header (present).
  it('does not set Content-Length for string/json/html bodies', () => {
    const multibyte = 'héllo-😀';

    const j = new WebResponseBuilder('GET');
    j.json({ msg: multibyte }, 200);
    expect(j.getResponse(200).headers.get('Content-Length')).toBeNull();

    const s = new WebResponseBuilder('GET');
    s.send(multibyte, 200);
    expect(s.getResponse(200).headers.get('Content-Length')).toBeNull();

    const h = new WebResponseBuilder('GET');
    h.html(multibyte, 200);
    expect(h.getResponse(200).headers.get('Content-Length')).toBeNull();

    const o = new WebResponseBuilder('GET');
    o.send({ msg: multibyte }, 200);
    expect(o.getResponse(200).headers.get('Content-Length')).toBeNull();
  });

  // F-18: binary bodies keep an explicit Content-Length (free from .length).
  it('keeps explicit Content-Length for Uint8Array/ArrayBuffer bodies', () => {
    const u = new WebResponseBuilder('GET');
    u.send(new Uint8Array([1, 2, 3, 4]), 200);
    expect(u.getResponse(200).headers.get('Content-Length')).toBe('4');
  });
});
