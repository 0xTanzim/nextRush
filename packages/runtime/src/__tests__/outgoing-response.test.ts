/**
 * @nextrush/runtime - the recorded outgoing response
 *
 * The record is the single place a response is built before an adapter flush:
 * status, an ordered case-insensitive header map with multi-value support, the
 * serialized body, and the committed/flushed lifecycle that decides whether a
 * write still lands or is discarded.
 *
 * The distinction these tests pin is the one the adapter families disagreed on:
 * committing a response (a response method recorded it) must not freeze its
 * headers, because middleware that runs after the handler still writes them.
 * Only the flush freezes the record.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { OutgoingResponse, type OutgoingHeaderEntry } from '../outgoing-response.js';

interface CapturedFlush {
  readonly status: number;
  readonly contentType: string | undefined;
  readonly headers: OutgoingHeaderEntry[];
  readonly body: string | Uint8Array | null;
}

function recordFlush(record: OutgoingResponse): CapturedFlush[] {
  const captured: CapturedFlush[] = [];
  record.flush((flushed) => {
    captured.push({
      status: flushed.status,
      contentType: flushed.contentType,
      headers: [...flushed.extraHeaders()],
      body: flushed.body,
    });
  });
  return captured;
}

function capturedHeader(
  captured: CapturedFlush[],
  name: string
): OutgoingHeaderEntry | undefined {
  return captured[0]?.headers.find(([entryName]) => entryName.toLowerCase() === name.toLowerCase());
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OutgoingResponse header recording', () => {
  it('lands a header set before the response is committed', () => {
    const record = new OutgoingResponse();

    record.set('X-Early', 'before');
    record.setBody('{"ok":true}', 'application/json; charset=utf-8');

    const captured = recordFlush(record);

    expect(captured).toHaveLength(1);
    expect(capturedHeader(captured, 'x-early')).toEqual(['X-Early', 'before']);
    expect(captured[0].contentType).toBe('application/json; charset=utf-8');
  });

  it('lands a header set after the response is committed but before the flush', () => {
    const record = new OutgoingResponse();

    record.setBody('{"ok":true}', 'application/json; charset=utf-8');
    expect(record.committed).toBe(true);

    record.set('X-Late', 'after-commit');

    const captured = recordFlush(record);

    expect(capturedHeader(captured, 'x-late')).toEqual(['X-Late', 'after-commit']);
  });

  it('discards a header set after the flush and reports it once per process', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // A fresh module instance starts with a clean once-per-process flag, so this
    // assertion does not depend on which tests ran before it.
    vi.resetModules();
    const { OutgoingResponse: FreshOutgoingResponse } = await import('../outgoing-response.js');

    const first = new FreshOutgoingResponse();
    first.setBody('ok');
    first.flush(() => undefined);

    expect(first.flush(() => undefined)).toBe(false);
    first.set('X-First-Late', 'v');
    first.set('X-Second-Late', 'v');

    const repeated = new FreshOutgoingResponse();
    repeated.setBody('ok');
    repeated.flush(() => undefined);
    repeated.set('X-Third-Late', 'v');

    const reports = warn.mock.calls
      .map((call) => String(call[0]))
      .filter((message) => message.includes('discarding'));
    expect(reports).toHaveLength(1);
    expect(reports[0]).toContain('X-First-Late');
    expect(first.getHeader('x-first-late')).toBeUndefined();
  });
});

describe('OutgoingResponse header semantics', () => {
  it('accumulates set-cookie across field-name casings', () => {
    const record = new OutgoingResponse();

    record.set('Set-Cookie', 'a=1');
    record.set('set-cookie', 'b=2');
    record.set('SET-COOKIE', 'c=3');

    expect(record.getSetCookie()).toEqual(['a=1', 'b=2', 'c=3']);
  });

  it('replaces the field with an array value and keeps each element in order', () => {
    const record = new OutgoingResponse();
    record.set('X-List', 'old');
    record.set('X-List', ['a', 'b']);

    recordFlush(record);

    expect(record.extraHeaders()).toEqual([
      ['X-List', 'a'],
      ['X-List', 'b'],
    ]);
    expect(record.getHeader('x-list')).toBe('a');
  });

  it('replaces a non-cookie field when a single value is set', () => {
    const record = new OutgoingResponse();
    record.set('X-One', 'first');
    record.set('x-one', 'second');

    expect(record.extraHeaders()).toEqual([['x-one', 'second']]);
  });
});

describe('OutgoingResponse body', () => {
  it('updates the bytes and the derived length when the body is replaced', () => {
    const record = new OutgoingResponse();
    const encoder = new TextEncoder();

    record.setBody('hello');
    expect(record.body).toBe('hello');
    expect(record.contentLength()).toBe(5);

    record.setBody(encoder.encode('hello world'));

    expect(record.bodyBytes()).toEqual(encoder.encode('hello world'));
    expect(record.contentLength()).toBe(11);
  });
});

describe('OutgoingResponse flush', () => {
  it('flushes exactly once', () => {
    const record = new OutgoingResponse();
    record.setBody('ok');

    const writer = vi.fn();
    expect(record.flush(writer)).toBe(true);
    expect(record.flush(writer)).toBe(false);

    expect(writer).toHaveBeenCalledTimes(1);
    expect(record.flushed).toBe(true);
  });
});
