/**
 * @nextrush/runtime - WebResponseBuilder: serialize before commit, and never
 * leave an error unanswered.
 *
 * The builder is the Web family's response finalizer, so it carries two
 * guarantees: a body method that throws leaves the response uncommitted, and a
 * request that reaches finalization with an error status and no body still gets
 * an answer instead of an empty response.
 */

import { describe, expect, it } from 'vitest';
import { WebResponseBuilder } from '../response-builder.js';

function makeBuilder(): WebResponseBuilder {
  return new WebResponseBuilder('GET');
}

describe('WebResponseBuilder - serialize before commit', () => {
  it('builds a complete JSON response', async () => {
    const builder = makeBuilder();

    builder.json({ ok: true }, 200);
    const res = builder.getResponse(200);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json');
    await expect(res.text()).resolves.toBe('{"ok":true}');
  });

  it('leaves the builder uncommitted when json() cannot serialize', () => {
    const builder = makeBuilder();

    expect(() => builder.json({ n: 10n }, 200)).toThrow(TypeError);

    expect(builder.responded).toBe(false);
  });

  it('rejects a value that serializes to nothing instead of committing an empty body', () => {
    const builder = makeBuilder();

    expect(() => builder.json(undefined, 200)).toThrow(TypeError);

    expect(builder.responded).toBe(false);
  });

  it('leaves send() uncommitted and header-clean when the body cannot be serialized', () => {
    const builder = makeBuilder();

    expect(() => builder.send({ n: 10n }, 200)).toThrow(TypeError);

    expect(builder.responded).toBe(false);
    expect(builder.getResponse(200).headers.get('content-type')).toBeNull();
  });

  it('answers an unanswered error status instead of returning it empty', async () => {
    const builder = makeBuilder();

    const res = builder.getResponse(500);

    expect(res.status).toBe(500);
    expect(res.headers.get('content-type')).toBe('application/json');
    await expect(res.json()).resolves.toEqual({ error: 'Internal Server Error' });
  });

  it('names the status it answers for a non-500 error status', async () => {
    const builder = makeBuilder();

    const res = builder.getResponse(503);

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: 'Service Unavailable' });
  });

  it('keeps the documented empty body for a handler that wrote nothing', async () => {
    const builder = makeBuilder();

    const res = builder.getResponse(200);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBeNull();
    await expect(res.text()).resolves.toBe('');
  });

  it('suppresses the synthesized body for a HEAD request', () => {
    const builder = new WebResponseBuilder('HEAD');

    const res = builder.getResponse(500);

    expect(res.status).toBe(500);
    // HEAD carries the length the GET would, with no body.
    expect(res.headers.get('content-length')).toBe('33');
    return expect(res.text()).resolves.toBe('');
  });

  it('keeps headers set before finalization in the synthesized answer', async () => {
    const builder = makeBuilder();
    builder.set('X-Request-Id', 'abc123');

    const res = builder.getResponse(500);

    expect(res.headers.get('x-request-id')).toBe('abc123');
    await expect(res.json()).resolves.toEqual({ error: 'Internal Server Error' });
  });

  // Audit: html/redirect/sendStream resolve nothing, so they cannot throw after
  // the responded flag — each commits and writes its body.
  it('commits and writes html(), redirect() and sendStream()', async () => {
    const html = makeBuilder();
    html.html('<p>hi</p>', 200);
    expect(html.responded).toBe(true);
    await expect(html.getResponse(200).text()).resolves.toBe('<p>hi</p>');

    const redirect = makeBuilder();
    redirect.redirect('/next', 302);
    expect(redirect.responded).toBe(true);
    const relocated = redirect.getResponse(200);
    expect(relocated.headers.get('location')).toBe('/next');
    await expect(relocated.text()).resolves.toBe('Redirecting to /next');

    const streamed = makeBuilder();
    streamed.sendStream(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('chunk'));
          controller.close();
        },
      }),
      200
    );
    expect(streamed.responded).toBe(true);
    await expect(streamed.getResponse(200).text()).resolves.toBe('chunk');
  });
});
