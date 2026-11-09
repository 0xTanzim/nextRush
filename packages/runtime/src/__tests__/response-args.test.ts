/**
 * @nextrush/runtime - per-call response arguments
 *
 * The resolver is the single source of truth for the second argument accepted by
 * `ctx.json()`, `ctx.html()` and `ctx.send()`: a numeric status or a
 * `ResponseOptions` object. Both adapter families call it, so these tests pin the
 * precedence and rejection rules the conformance suite then checks end to end.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  applyResponseHeaders,
  assertResponseStatus,
  resolveResponseArgs,
  type HeaderWriter,
} from '../response-args.js';

describe('assertResponseStatus', () => {
  it('accepts the inclusive 200-599 integer range', () => {
    for (const status of [200, 201, 204, 304, 404, 599]) {
      expect(() => { assertResponseStatus(status, 'json'); }).not.toThrow();
    }
  });

  it('rejects out-of-range and non-integer values with a RangeError naming the range', () => {
    for (const status of [99, 199, 600, 999, 201.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => { assertResponseStatus(status, 'json'); }).toThrow(RangeError);
      expect(() => { assertResponseStatus(status, 'json'); }).toThrow(/200/);
      expect(() => { assertResponseStatus(status, 'json'); }).toThrow(/599/);
    }
  });

  it('names the helper that received the bad value', () => {
    expect(() => { assertResponseStatus(99, 'html'); }).toThrow(/ctx\.html\(\)/);
  });
});

describe('resolveResponseArgs', () => {
  it('keeps the carried status when no argument is supplied', () => {
    expect(resolveResponseArgs(undefined, 250, 'send')).toEqual({ status: 250, headers: undefined });
  });

  it('treats a number as the explicit status', () => {
    expect(resolveResponseArgs(201, 200, 'json')).toEqual({ status: 201, headers: undefined });
  });

  it('reads status and headers from the options object', () => {
    const headers = { 'X-Trace': 't1' };
    expect(resolveResponseArgs({ status: 202, headers }, 200, 'json')).toEqual({
      status: 202,
      headers,
    });
  });

  it('keeps the carried status when the options object omits status', () => {
    expect(resolveResponseArgs({ headers: { ETag: 'v1' } }, 201, 'json')).toEqual({
      status: 201,
      headers: { ETag: 'v1' },
    });
  });

  it('rejects an invalid explicit status from either form', () => {
    expect(() => resolveResponseArgs(600, 200, 'json')).toThrow(RangeError);
    expect(() => resolveResponseArgs({ status: 99 }, 200, 'json')).toThrow(RangeError);
    expect(() => resolveResponseArgs({ status: 201.5 }, 200, 'json')).toThrow(RangeError);
  });

  it('rejects a non-number status supplied at runtime', () => {
    expect(() =>
      resolveResponseArgs({ status: '201' as unknown as number }, 200, 'json')
    ).toThrow(RangeError);
  });

  it('rejects a null argument instead of treating it as options', () => {
    expect(() => resolveResponseArgs(null as never, 200, 'json')).toThrow(TypeError);
  });

  it('does not validate the carried status (unchanged behavior)', () => {
    expect(resolveResponseArgs(undefined, 99, 'json')).toEqual({ status: 99, headers: undefined });
  });
});

describe('applyResponseHeaders', () => {
  function writer(): HeaderWriter & { readonly calls: [string, string | number | string[]][] } {
    const calls: [string, string | number | string[]][] = [];
    return {
      calls,
      set(field, value) {
        calls.push([field, value]);
      },
    };
  }

  it('writes nothing when no headers are supplied', () => {
    const target = writer();
    applyResponseHeaders(target, undefined);
    expect(target.calls).toEqual([]);
  });

  it('writes every supplied field in insertion order', () => {
    const target = writer();
    applyResponseHeaders(target, { Location: '/a', 'X-Trace': 7, 'Set-Cookie': ['a=1', 'b=2'] });
    expect(target.calls).toEqual([
      ['Location', '/a'],
      ['X-Trace', 7],
      ['Set-Cookie', ['a=1', 'b=2']],
    ]);
  });

  it('rejects Content-Length in any casing', () => {
    for (const field of ['Content-Length', 'content-length', 'CONTENT-LENGTH']) {
      const target = writer();
      expect(() => { applyResponseHeaders(target, { [field]: '10' }); }).toThrow(TypeError);
      expect(() => { applyResponseHeaders(target, { [field]: '10' }); }).toThrow(/derived/i);
      expect(target.calls).toEqual([]);
    }
  });

  it('does not treat a lookalike field as Content-Length', () => {
    const target = writer();
    applyResponseHeaders(target, { 'X-Content-Length': '10' });
    expect(target.calls).toEqual([['X-Content-Length', '10']]);
  });

  it('validates before writing any field', () => {
    const target = writer();
    const set = vi.spyOn(target, 'set');
    expect(() =>
      applyResponseHeaders(target, { 'X-First': '1', 'Content-Length': '2' })
    ).toThrow(TypeError);
    expect(set).not.toHaveBeenCalled();
  });
});
