/**
 * @nextrush/runtime - Client IP policy tests (F-11)
 *
 * One shared precedence + validation policy so Node/Bun/Deno/Edge resolve
 * `ctx.ip` identically for a given header set. Typed proxy-trust selection
 * matrix (hop count / CIDR peer list) lives in `proxy-trust.test.ts`
 * (RFC-030) — this file covers the base lookup/validation primitives and
 * the `trust: false` / single-hop precedence paths.
 */

import { describe, expect, it } from 'vitest';
import { getClientIp, getEdgeClientIp, isValidClientIp, resolveClientIp } from '../headers.js';

describe('isValidClientIp', () => {
  it('accepts IPv4 and IPv6 literals', () => {
    expect(isValidClientIp('203.0.113.5')).toBe('203.0.113.5');
    expect(isValidClientIp(' 2001:db8::1 ')).toBe('2001:db8::1');
  });

  it('rejects malformed / injected values and empties', () => {
    expect(isValidClientIp('<script>')).toBeUndefined();
    expect(isValidClientIp('not an ip')).toBeUndefined();
    expect(isValidClientIp('')).toBeUndefined();
    expect(isValidClientIp('   ')).toBeUndefined();
    expect(isValidClientIp(undefined)).toBeUndefined();
  });
});

describe('resolveClientIp', () => {
  const lookup = (headers: Record<string, string>) => (name: string) => headers[name];

  it('returns directIp when trust is false', () => {
    const ip = resolveClientIp(lookup({ 'x-forwarded-for': '1.1.1.1' }), {
      trust: false,
      directIp: '10.0.0.1',
    });
    expect(ip).toBe('10.0.0.1');
  });

  it('prefers the trusted hop from x-forwarded-for then x-real-ip when trusted', () => {
    expect(
      resolveClientIp(lookup({ 'x-forwarded-for': '203.0.113.7, 10.0.0.2' }), {
        trust: 1,
        directIp: '10.0.0.1',
        peerIp: '10.0.0.2',
      })
    ).toBe('10.0.0.2');

    expect(
      resolveClientIp(lookup({ 'x-real-ip': '198.51.100.9' }), {
        trust: ['10.0.0.0/8'],
        directIp: '10.0.0.1',
        peerIp: '10.0.0.1',
      })
    ).toBe('198.51.100.9');
  });

  it('skips a malformed x-forwarded-for and falls through to x-real-ip', () => {
    expect(
      resolveClientIp(
        lookup({ 'x-forwarded-for': 'evil"header', 'x-real-ip': '198.51.100.9' }),
        { trust: ['10.0.0.0/8'], directIp: '10.0.0.1', peerIp: '10.0.0.1' }
      )
    ).toBe('198.51.100.9');
  });

  it('consults cf-connecting-ip first only when cloudflare option is set', () => {
    const headers = { 'cf-connecting-ip': '203.0.113.10', 'x-forwarded-for': '10.0.0.9, 203.0.113.20' };
    expect(
      resolveClientIp(lookup(headers), { trust: 1, directIp: '10.0.0.9', cloudflare: true })
    ).toBe('203.0.113.10');
    expect(resolveClientIp(lookup(headers), { trust: 1, directIp: '10.0.0.9' })).toBe(
      '203.0.113.20'
    );
  });
});

describe('getClientIp (web)', () => {
  it('validates x-forwarded-for and falls back to x-real-ip', () => {
    const req = new Request('http://x/', {
      headers: { 'x-forwarded-for': 'bogus header', 'x-real-ip': '198.51.100.1' },
    });
    expect(getClientIp(req, '10.0.0.1', ['10.0.0.0/8'])).toBe('198.51.100.1');
    expect(getClientIp(req, '10.0.0.1', false)).toBe('10.0.0.1');
  });
});

describe('getEdgeClientIp', () => {
  it('trusts cf-connecting-ip first when a hop-count trust is set', () => {
    const req = new Request('http://x/', {
      headers: { 'cf-connecting-ip': '203.0.113.3', 'x-forwarded-for': '203.0.113.9' },
    });
    expect(getEdgeClientIp(req, 1)).toBe('203.0.113.3');
    expect(getEdgeClientIp(req, false)).toBe('');
  });
});
