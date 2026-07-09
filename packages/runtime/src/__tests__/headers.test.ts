/**
 * @nextrush/runtime - Client IP policy tests (F-11)
 *
 * One shared precedence + validation policy so Node/Bun/Deno/Edge resolve
 * `ctx.ip` identically for a given header set.
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

  it('returns directIp when trustProxy is false', () => {
    const ip = resolveClientIp(lookup({ 'x-forwarded-for': '1.1.1.1' }), {
      trustProxy: false,
      directIp: '10.0.0.1',
    });
    expect(ip).toBe('10.0.0.1');
  });

  it('prefers x-forwarded-for (first entry) then x-real-ip when trusted', () => {
    expect(
      resolveClientIp(lookup({ 'x-forwarded-for': '203.0.113.7, 10.0.0.2' }), {
        trustProxy: true,
        directIp: '10.0.0.1',
      })
    ).toBe('203.0.113.7');

    expect(
      resolveClientIp(lookup({ 'x-real-ip': '198.51.100.9' }), {
        trustProxy: true,
        directIp: '10.0.0.1',
      })
    ).toBe('198.51.100.9');
  });

  it('skips a malformed x-forwarded-for and falls through', () => {
    expect(
      resolveClientIp(lookup({ 'x-forwarded-for': 'evil"header', 'x-real-ip': '198.51.100.9' }), {
        trustProxy: true,
        directIp: '10.0.0.1',
      })
    ).toBe('198.51.100.9');
  });

  it('consults cf-connecting-ip first only when cloudflare option is set', () => {
    const headers = { 'cf-connecting-ip': '203.0.113.10', 'x-forwarded-for': '203.0.113.20' };
    expect(
      resolveClientIp(lookup(headers), { trustProxy: true, directIp: '', cloudflare: true })
    ).toBe('203.0.113.10');
    expect(resolveClientIp(lookup(headers), { trustProxy: true, directIp: '' })).toBe(
      '203.0.113.20'
    );
  });
});

describe('getClientIp (web)', () => {
  it('validates x-forwarded-for and falls back to x-real-ip', () => {
    const req = new Request('http://x/', {
      headers: { 'x-forwarded-for': 'bogus header', 'x-real-ip': '198.51.100.1' },
    });
    expect(getClientIp(req, '10.0.0.1', true)).toBe('198.51.100.1');
    expect(getClientIp(req, '10.0.0.1', false)).toBe('10.0.0.1');
  });
});

describe('getEdgeClientIp', () => {
  it('trusts cf-connecting-ip first when trustProxy is on', () => {
    const req = new Request('http://x/', {
      headers: { 'cf-connecting-ip': '203.0.113.3', 'x-forwarded-for': '203.0.113.9' },
    });
    expect(getEdgeClientIp(req, true)).toBe('203.0.113.3');
    expect(getEdgeClientIp(req, false)).toBe('');
  });
});
