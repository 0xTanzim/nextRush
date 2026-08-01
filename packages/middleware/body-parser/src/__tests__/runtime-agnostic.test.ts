/**
 * @nextrush/body-parser - Runtime-agnostic byte layer (BP-1 / BP-4)
 *
 * The decode/concat layer must operate on plain Uint8Array via Web-standard
 * TextDecoder — no Node Buffer or node:string_decoder — so the package loads
 * and runs on edge runtimes (Workers / Vercel Edge / Netlify Edge).
 */

import { describe, expect, it } from 'vitest';
import { bufferToString, concatBuffers } from '../utils/buffer.js';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

describe('bufferToString — runtime-agnostic decode', () => {
  it('decodes a small UTF-8 Uint8Array (not just Buffer)', () => {
    expect(bufferToString(enc('héllo'))).toBe('héllo');
  });

  it('decodes a large (>1KB) multi-byte UTF-8 Uint8Array correctly', () => {
    const original = 'あ'.repeat(2000); // 3-byte chars, well over the 1KB threshold
    expect(bufferToString(enc(original))).toBe(original);
  });

  it('returns empty string for an empty Uint8Array', () => {
    expect(bufferToString(new Uint8Array(0))).toBe('');
  });

  it('honors dashed charset aliases without throwing (BP-4)', () => {
    const bytes = new Uint8Array(new Uint16Array([0x68, 0x69]).buffer); // "hi" in UTF-16LE
    expect(bufferToString(bytes, 'utf-16le')).toBe('hi');
    expect(bufferToString(bytes, 'ucs-2')).toBe('hi');
  });

  it('decodes latin1', () => {
    expect(bufferToString(new Uint8Array([0xe9]), 'latin1')).toBe('é');
  });
});

describe('concatBuffers — runtime-agnostic concat', () => {
  it('concatenates Uint8Array chunks', () => {
    const chunks = [enc('foo'), enc('bar')];
    const total = chunks.reduce((n, c) => n + c.length, 0);
    expect(bufferToString(concatBuffers(chunks, total))).toBe('foobar');
  });

  it('returns an empty Uint8Array for no chunks', () => {
    const out = concatBuffers([], 0);
    expect(out).toBeInstanceOf(Uint8Array);
    expect(out.length).toBe(0);
  });

  it('preserves a single chunk without corruption', () => {
    expect(bufferToString(concatBuffers([enc('solo')], 4))).toBe('solo');
  });
});
