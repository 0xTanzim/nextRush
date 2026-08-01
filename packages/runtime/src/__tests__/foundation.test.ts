/**
 * @nextrush/runtime - Runtime foundation tests
 *
 * Covers the shared timeout constants (F-16), the request-signal combiner
 * (F-08), and startup-error normalization (F-15).
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_KEEP_ALIVE_TIMEOUT_MS,
  DEFAULT_SHUTDOWN_TIMEOUT_MS,
  DEFAULT_TIMEOUT_MS,
} from '../constants.js';
import { combineAbortSignal } from '../request-signal.js';
import { normalizeStartupError, ServerStartError } from '../server-error.js';

describe('timeout constants (F-16)', () => {
  it('default timeout is 30000ms (not the 80800 doc typo)', () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(30_000);
    expect(DEFAULT_SHUTDOWN_TIMEOUT_MS).toBe(30_000);
    expect(DEFAULT_KEEP_ALIVE_TIMEOUT_MS).toBe(5_000);
  });
});

describe('combineAbortSignal (F-08)', () => {
  it('aborts when the adapter-owned side fires (timeout)', () => {
    const base = new AbortController();
    const combined = combineAbortSignal(base.signal);
    expect(combined.signal.aborted).toBe(false);
    combined.abort(new Error('Request timeout'));
    expect(combined.signal.aborted).toBe(true);
  });

  it('aborts when the base signal fires (client disconnect)', () => {
    const base = new AbortController();
    const combined = combineAbortSignal(base.signal);
    base.abort();
    expect(combined.signal.aborted).toBe(true);
  });

  it('abort() is idempotent', () => {
    const base = new AbortController();
    const combined = combineAbortSignal(base.signal);
    combined.abort();
    expect(() => combined.abort()).not.toThrow();
    expect(combined.signal.aborted).toBe(true);
  });
});

describe('normalizeStartupError (F-15)', () => {
  it('classifies EADDRINUSE from a code property', () => {
    const err = normalizeStartupError(Object.assign(new Error('listen failed'), { code: 'EADDRINUSE' }), {
      port: 8080,
      host: '0.0.0.0',
    });
    expect(err).toBeInstanceOf(ServerStartError);
    expect(err.code).toBe('EADDRINUSE');
    expect(err.port).toBe(8080);
    expect(err.message).toContain('8080');
    expect(err.message).toContain('already in use');
  });

  it('classifies EADDRINUSE from a message substring (Bun-style)', () => {
    const err = normalizeStartupError(new Error('address already in use'), {
      port: 3000,
      host: '127.0.0.1',
    });
    expect(err.code).toBe('EADDRINUSE');
  });

  it('preserves the original error as cause and falls back to UNKNOWN', () => {
    const original = new Error('weird failure');
    const err = normalizeStartupError(original, { port: 9, host: 'localhost' });
    expect(err.code).toBe('UNKNOWN');
    expect(err.cause).toBe(original);
    expect(err.message).toContain('weird failure');
  });
});
