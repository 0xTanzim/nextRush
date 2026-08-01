/**
 * @nextrush/runtime - WebResponseBuilder tests (F-04b)
 *
 * The shared, composable Web response collaborator. It owns the response
 * builder state (status/headers/body), the response methods
 * (json/send/html/redirect/getResponse/sendStream), HEAD/204/304/1xx body
 * suppression, and CRLF-guarded header setting — so the Bun/Deno/Edge contexts
 * compose it instead of copy-pasting ~200 lines each.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { HeaderValidationError } from '@nextrush/errors';
import { assertHeaderSafe, isBodylessResponse, jsonErrorResponse, WebResponseBuilder } from '../response-builder.js';

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
    expect(() => assertHeaderSafe('X-Bad\r\nInjected', 'v')).toThrow(HeaderValidationError);
  });

  it('rejects CRLF in a string value', () => {
    expect(() => assertHeaderSafe('X-Ok', 'bad\nvalue')).toThrow(HeaderValidationError);
  });

  it('rejects CRLF in any array value', () => {
    expect(() => assertHeaderSafe('Set-Cookie', ['a=1', 'b=2\r\nx'])).toThrow(HeaderValidationError);
  });

  it('accepts numeric values', () => {
    expect(() => assertHeaderSafe('X-Count', 42)).not.toThrow();
  });

  // SEC-12: full RFC 9110 field-name token grammar, not just CR/LF.
  describe('field-name token grammar (SEC-12)', () => {
    it.each([
      ['a space in the name', 'X Foo'],
      ['a colon in the name', 'X:Foo'],
      ['a comma', 'X,Foo'],
      ['a quote', 'X"Foo'],
      ['a NUL byte', 'X\u0000Foo'],
      ['a DEL byte', 'X\u007FFoo'],
      ['an empty name', ''],
    ])('rejects %s (%j)', (_label, field) => {
      expect(() => assertHeaderSafe(field, 'v')).toThrow(HeaderValidationError);
    });

    it.each([
      ['plain alphanumerics', 'X-Custom-Header'],
      ['every RFC 9110 tchar', "!#$%&'*+-.^_`|~"],
      ['digits', 'X123'],
    ])('accepts %s (%j)', (_label, field) => {
      expect(() => assertHeaderSafe(field, 'v')).not.toThrow();
    });
  });

  // SEC-12: field-value grammar — control chars, NUL, leading/trailing
  // whitespace (obs-fold precursor), not only CR/LF.
  describe('field-value grammar (SEC-12)', () => {
    it.each([
      ['a NUL byte', 'X\u0000Y'],
      ['a DEL byte (0x7F)', 'X\u007FY'],
      ['a low control byte (0x1F)', 'X\u001FY'],
      ['a leading space', ' value'],
      ['a trailing space', 'value '],
      ['a leading tab', '\tvalue'],
      ['an obs-fold sequence', 'value\r\n\tcontinued'],
    ])('rejects %s (%j)', (_label, value) => {
      expect(() => assertHeaderSafe('X-Ok', value)).toThrow(HeaderValidationError);
    });

    it.each([
      ['a plain ASCII value', 'application/json'],
      ['an internal space', 'max-age=0, must-revalidate'],
      ['high-byte (Latin-1) content', 'caf\u00e9'],
      ['an empty value', ''],
    ])('accepts %s (%j)', (_label, value) => {
      expect(() => assertHeaderSafe('X-Ok', value)).not.toThrow();
    });

    it('validates array values element-wise — one bad element rejects the whole write', () => {
      expect(() => assertHeaderSafe('Set-Cookie', ['a=1', ' bad-leading-space'])).toThrow(
        HeaderValidationError
      );
    });

    it('accepts a fully valid array', () => {
      expect(() => assertHeaderSafe('Set-Cookie', ['a=1', 'b=2'])).not.toThrow();
    });

    // 7.10 edge case: the grammar validates character classes, not length —
    // a value at Node's default maxHeaderSize (16KB) boundary must be
    // accepted on grammar grounds alone; any length-based rejection is the
    // HTTP server's own concern, not assertHeaderSafe()'s.
    it('accepts a valid value at the platform header size limit (16KB) without a length-based rejection', () => {
      const valueAtLimit = 'a'.repeat(16384);
      expect(() => assertHeaderSafe('X-Large', valueAtLimit)).not.toThrow();
    });
  });

  it('throws a typed HeaderValidationError, not a bare Error, for every rejection', () => {
    expect(() => assertHeaderSafe('X Foo', 'v')).toThrow(HeaderValidationError);
    expect(() => assertHeaderSafe('X-Ok', ' v')).toThrow(HeaderValidationError);
    try {
      assertHeaderSafe('X Foo', 'v');
      expect.fail('expected assertHeaderSafe to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HeaderValidationError);
      expect((err as Error).name).toBe('HeaderValidationError');
    }
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

// ===========================================================================
// HP-15-web — set-cookie detection gated behind a constant-time pre-check
//
// OpenSpec change `web-adapters-context-response-microtrims`: `set()` must
// detect `set-cookie` (case-insensitively, all casings) via a cheap length +
// first-char pre-check BEFORE `field.toLowerCase()`, so a non-cookie header
// allocates no lowercased string. `assertHeaderSafe` and the array-value
// delete+append branch are unchanged.
// ===========================================================================

describe('WebResponseBuilder.set — HP-15-web set-cookie pre-check', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('detects Set-Cookie across all casings and accumulates each', () => {
    const rb = new WebResponseBuilder('GET');
    rb.set('Set-Cookie', 'a=1');
    rb.set('set-cookie', 'b=2');
    rb.set('SET-COOKIE', 'c=3');
    rb.set('SeT-CooKie', 'd=4');
    const cookies = rb.getResponse(200).headers.getSetCookie();
    expect(cookies).toHaveLength(4);
    expect(cookies).toEqual(expect.arrayContaining(['a=1', 'b=2', 'c=3', 'd=4']));
  });

  it('[trim] the first-char pre-check short-circuits the detection toLowerCase for a non-cookie field', () => {
    // Native Headers name-normalization also calls String.prototype.toLowerCase,
    // so a raw "not called" spy can't isolate our detection. Instead compare two
    // 10-char fields that differ ONLY in the first char and both hit
    // `_headers.set` (neither is a cookie): the 's…' field passes the cheap
    // pre-check and reaches the `field.toLowerCase()` fallback; the 'x…' field
    // fails the first-char check and skips it. Equal length ⇒ identical native
    // normalization, so the call-count delta is exactly our one detection call.
    const original = String.prototype.toLowerCase;
    let calls = 0;
    vi.spyOn(String.prototype, 'toLowerCase').mockImplementation(function (this: string) {
      calls += 1;
      return original.call(this);
    });

    const rbS = new WebResponseBuilder('GET');
    calls = 0;
    rbS.set('sxxxxxxxxx', 'v'); // 10 chars, first char 's' → reaches the fallback
    const withFallback = calls;

    const rbX = new WebResponseBuilder('GET');
    calls = 0;
    rbX.set('xxxxxxxxxx', 'v'); // 10 chars, first char 'x' → skips the fallback
    const withoutFallback = calls;

    expect(withFallback - withoutFallback).toBe(1);
    // Neither is a cookie → both set as normal headers.
    expect(rbS.getResponse(200).headers.get('sxxxxxxxxx')).toBe('v');
    expect(rbX.getResponse(200).headers.get('xxxxxxxxxx')).toBe('v');
  });

  it('a 10-char non-cookie header starting with s is replaced, not accumulated', () => {
    // Guards the fallback compare: length===10 + first-char 's' alone must NOT
    // be treated as set-cookie — the full `=== 'set-cookie'` check still decides.
    const rb = new WebResponseBuilder('GET');
    rb.set('sec-fetch1', 'first');
    rb.set('sec-fetch1', 'second');
    expect(rb.getResponse(200).headers.get('sec-fetch1')).toBe('second');
  });

  it('the CRLF guard still throws for field and value', () => {
    const rb = new WebResponseBuilder('GET');
    expect(() => rb.set('X-Bad\r\n', 'v')).toThrow('Header field contains invalid characters');
    expect(() => rb.set('X-Ok', 'a\r\nb')).toThrow('Header value contains invalid characters');
  });

  it('an array value still deletes then appends each entry', () => {
    const rb = new WebResponseBuilder('GET');
    rb.set('Set-Cookie', 'old=1');
    rb.set('Set-Cookie', ['n1=a', 'n2=b']);
    const cookies = rb.getResponse(200).headers.getSetCookie();
    expect(cookies).toHaveLength(2);
    expect(cookies).toEqual(expect.arrayContaining(['n1=a', 'n2=b']));
  });
});

describe('F-03: HEAD Content-Length by body type', () => {
  it('a string body (via send) yields a measured Content-Length on HEAD', () => {
    const rb = new WebResponseBuilder('HEAD');
    rb.send('hello world', 200);
    const res = rb.getResponse(200);
    expect(res.headers.get('content-length')).toBe(String(new TextEncoder().encode('hello world').length));
  });

  it('a binary body (Uint8Array) already has an explicit Content-Length, preserved on HEAD', () => {
    const rb = new WebResponseBuilder('HEAD');
    rb.send(new Uint8Array([1, 2, 3, 4]), 200);
    const res = rb.getResponse(200);
    expect(res.headers.get('content-length')).toBe('4');
  });

  it('a null body (no response method called) has no measurable length — omitted', () => {
    const rb = new WebResponseBuilder('HEAD');
    const res = rb.getResponse(200);
    expect(res.headers.has('content-length')).toBe(false);
  });

  it('a ReadableStream body has no known length — omitted on HEAD', () => {
    const rb = new WebResponseBuilder('HEAD');
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });
    rb.sendStream(stream, 200);
    const res = rb.getResponse(200);
    expect(res.headers.has('content-length')).toBe(false);
  });

  it('204 and 304 never gain a Content-Length even on HEAD', () => {
    const rb204 = new WebResponseBuilder('HEAD');
    rb204.send('hidden', 204);
    expect(rb204.getResponse(200).headers.has('content-length')).toBe(false);

    const rb304 = new WebResponseBuilder('HEAD');
    rb304.send('hidden', 304);
    expect(rb304.getResponse(200).headers.has('content-length')).toBe(false);
  });

  it('GET is unaffected — no Content-Length is force-set for a string body', () => {
    const rb = new WebResponseBuilder('GET');
    rb.send('hello', 200);
    // F-18: the runtime derives Content-Length from the string body; this
    // builder never sets it explicitly for GET.
    expect(rb.getResponse(200).headers.has('content-length')).toBe(false);
  });
});

describe('F-05: jsonErrorResponse', () => {
  it('builds a JSON error response with a uniform charset and the expected body shape', async () => {
    const res = jsonErrorResponse(500, 'Internal Server Error');
    expect(res.status).toBe(500);
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(await res.json()).toEqual({ error: 'Internal Server Error' });
  });

  it('supports arbitrary status codes and messages (e.g. 504 Gateway Timeout)', async () => {
    const res = jsonErrorResponse(504, 'Gateway Timeout');
    expect(res.status).toBe(504);
    expect(await res.json()).toEqual({ error: 'Gateway Timeout' });
  });
});
