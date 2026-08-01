/**
 * @nextrush/runtime - Audit Remediation Tests
 *
 * Covers audit findings R-2 (detection dedup), R-3 (capability probing for
 * unknown/future runtimes), R-4 (ServerStartError joins the error hierarchy),
 * and R-6 (1xx guard in the response builder).
 */

import { NextRushError } from '@nextrush/errors';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  capabilitiesFor,
  detectEdgeRuntime,
  detectRuntime,
  resetRuntimeCache,
} from '../detection.js';
import { WebResponseBuilder } from '../response-builder.js';
import { ServerStartError, normalizeStartupError } from '../server-error.js';
import { headersToRecord, isValidClientIp } from '../headers.js';

// ---------------------------------------------------------------------------
// R-2 — detectEdgeRuntime must not diverge from detectRuntime on the base string
// ---------------------------------------------------------------------------

describe('R-2: detectEdgeRuntime keeps its edge-platform contract (no drift)', () => {
  beforeEach(() => resetRuntimeCache());

  it('defaults to generic edge with all platform flags off in a plain env', () => {
    const info = detectEdgeRuntime();
    // No edge markers in the test env → generic edge, not a contradiction.
    expect(info.runtime).toBe('edge');
    expect(info.isCloudflare).toBe(false);
    expect(info.isVercel).toBe(false);
    expect(info.isNetlify).toBe(false);
    expect(info.isGenericEdge).toBe(true);
  });

  it('detectRuntime still reports the underlying JS engine (node in tests)', () => {
    // The two functions answer different questions and may differ by design.
    expect(detectRuntime()).toBe('node');
  });
});

// ---------------------------------------------------------------------------
// R-3 — capabilities are probed for unknown/future runtimes, not all-false
// ---------------------------------------------------------------------------

describe('R-3: capabilitiesFor probes real globals for unknown runtimes', () => {
  it('reports fetch/webStreams for an unknown runtime when the globals exist', () => {
    // The Node test env has global fetch + ReadableStream + crypto.subtle.
    const caps = capabilitiesFor('unknown');
    expect(caps.fetch).toBe(true);
    expect(caps.webStreams).toBe(true);
    expect(caps.cryptoSubtle).toBe(true);
  });

  it('still returns the curated matrix for a known runtime', () => {
    const node = capabilitiesFor('node');
    expect(node.nodeStreams).toBe(true);
    expect(node.fileSystem).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// R-4 — ServerStartError participates in the NextRush error hierarchy
// ---------------------------------------------------------------------------

describe('R-4: ServerStartError is a NextRushError', () => {
  it('is instanceof NextRushError with a 500 status and typed code', () => {
    const cause = new Error('EADDRINUSE');
    const error = new ServerStartError('Port in use', {
      code: 'EADDRINUSE',
      port: 8080,
      host: '0.0.0.0',
      cause,
    });
    expect(error).toBeInstanceOf(NextRushError);
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(500);
    expect(error.code).toBe('EADDRINUSE');
    expect(error.port).toBe(8080);
    expect((error as Error).cause).toBe(cause);
  });

  it('normalizeStartupError produces a hierarchy error', () => {
    const raw = Object.assign(new Error('listen EADDRINUSE'), { code: 'EADDRINUSE' });
    const error = normalizeStartupError(raw, { port: 3000, host: 'localhost' });
    expect(error).toBeInstanceOf(NextRushError);
    expect(error.code).toBe('EADDRINUSE');
  });
});

// ---------------------------------------------------------------------------
// R-6 — 1xx status must be rejected with a clear error, not an opaque RangeError
// ---------------------------------------------------------------------------

describe('R-6: WebResponseBuilder guards informational (1xx) responses', () => {
  it('throws a descriptive error for a 1xx fallback status', () => {
    const builder = new WebResponseBuilder('GET');
    expect(() => builder.getResponse(101)).toThrow(/informational|1xx/i);
    expect(() => builder.getResponse(199)).toThrow(/informational|1xx/i);
  });

  it('still builds a normal 2xx response', () => {
    const builder = new WebResponseBuilder('GET');
    builder.json({ ok: true }, 200);
    const res = builder.getResponse(200);
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// R-7 — client IP validation is structural, not a charset filter
// ---------------------------------------------------------------------------

describe('R-7: isValidClientIp validates IP structure', () => {
  it('accepts valid IPv4 and IPv6 literals', () => {
    expect(isValidClientIp('203.0.113.5')).toBe('203.0.113.5');
    expect(isValidClientIp('2001:db8::1')).toBe('2001:db8::1');
    expect(isValidClientIp('::1')).toBe('::1');
    expect(isValidClientIp(' 198.51.100.9 ')).toBe('198.51.100.9');
  });

  it('rejects structurally-invalid values the old charset filter allowed', () => {
    expect(isValidClientIp('999.999.999.999')).toBeUndefined();
    expect(isValidClientIp('...')).toBeUndefined();
    expect(isValidClientIp('::::')).toBeUndefined();
    expect(isValidClientIp('1.2.3')).toBeUndefined();
    expect(isValidClientIp('12345::6')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// R-10 — multiple Set-Cookie headers must not collapse
// ---------------------------------------------------------------------------

describe('R-10: headersToRecord preserves multiple Set-Cookie values', () => {
  it('keeps multiple set-cookie values as an array', () => {
    const headers = new Headers();
    headers.append('set-cookie', 'a=1');
    headers.append('set-cookie', 'b=2');
    const record = headersToRecord(headers);
    expect(Array.isArray(record['set-cookie'])).toBe(true);
    expect(record['set-cookie']).toEqual(['a=1', 'b=2']);
  });

  it('keeps a single set-cookie value as a string', () => {
    const headers = new Headers();
    headers.append('set-cookie', 'only=1');
    expect(headersToRecord(headers)['set-cookie']).toBe('only=1');
  });
});
