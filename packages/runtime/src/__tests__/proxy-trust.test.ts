/**
 * @nextrush/runtime - Typed proxy-trust boundary tests (RFC-030, SEC-01)
 *
 * `resolveClientIp()`'s `trust` option replaces the boolean `trustProxy` with
 * `false | number | string[]` (hop count or trusted-peer CIDR list) and walks
 * `X-Forwarded-For` right-to-left, trust-gated, instead of trusting the
 * leftmost (client-authored) entry.
 */

import { describe, expect, it } from 'vitest';
import { resolveClientIp } from '../headers.js';

describe('resolveClientIp — typed proxy trust (RFC-030)', () => {
  const lookup = (headers: Record<string, string>) => (name: string) => headers[name];

  describe('4.2: chain selection', () => {
    it('proxy: 1 (hop count) resolves the rightmost trusted entry (tasks.md 4.2)', () => {
      const ip = resolveClientIp(lookup({ 'x-forwarded-for': '203.0.113.9, 10.0.0.5' }), {
        trust: 1,
        directIp: '10.0.0.5',
        peerIp: '10.0.0.5',
      });
      expect(ip).toBe('10.0.0.5');
    });

    it('proxy: [cidr] with a three-entry chain from a trusted peer stops at the first untrusted address', () => {
      const ip = resolveClientIp(
        lookup({ 'x-forwarded-for': '198.51.100.1, 203.0.113.9, 10.0.0.5' }),
        {
          trust: ['10.0.0.0/8'],
          directIp: '10.0.0.5',
          peerIp: '10.0.0.5',
        }
      );
      expect(ip).toBe('203.0.113.9');
    });

    it('a forged header from an untrusted peer resolves to the direct peer, chain never consulted', () => {
      const ip = resolveClientIp(lookup({ 'x-forwarded-for': '203.0.113.9, 10.0.0.5' }), {
        trust: ['10.0.0.0/8'],
        directIp: '198.51.100.200',
        peerIp: '198.51.100.200',
      });
      expect(ip).toBe('198.51.100.200');
    });
  });

  describe('4.10: edge cases', () => {
    it('an IPv6 CIDR trust list matches a peer inside the range', () => {
      const ip = resolveClientIp(lookup({ 'x-forwarded-for': '203.0.113.9, 2001:db8::5' }), {
        trust: ['2001:db8::/32'],
        directIp: '2001:db8::5',
        peerIp: '2001:db8::5',
      });
      expect(ip).toBe('203.0.113.9');
    });

    it('an IPv6 CIDR trust list rejects a peer outside the range', () => {
      const ip = resolveClientIp(lookup({ 'x-forwarded-for': '203.0.113.9' }), {
        trust: ['2001:db8::/32'],
        directIp: '2001:db9::5',
        peerIp: '2001:db9::5',
      });
      expect(ip).toBe('2001:db9::5');
    });

    it('a malformed entry in a trusted chain never becomes the resolved value', () => {
      const ip = resolveClientIp(
        lookup({ 'x-forwarded-for': '203.0.113.9, not-an-ip, 10.0.0.5' }),
        { trust: 2, directIp: '10.0.0.5', peerIp: '10.0.0.5' }
      );
      expect(ip).not.toBe('not-an-ip');
    });

    it('4.10: an unbracketed IPv6 literal with a trailing port is treated as malformed, not a valid entry', () => {
      const ip = resolveClientIp(
        lookup({ 'x-forwarded-for': '2001:db8::1:8080, 10.0.0.5' }),
        { trust: 1, directIp: '10.0.0.5', peerIp: '10.0.0.5' }
      );
      // '2001:db8::1:8080' is not a well-formed IPv6 literal (the trailing
      // ':8080' is an unbracketed port, not part of the address) — it must
      // never be trusted as-is.
      expect(ip).not.toBe('2001:db8::1:8080');
    });

    it('a hop count larger than the chain length falls back to the direct peer', () => {
      const ip = resolveClientIp(lookup({ 'x-forwarded-for': '203.0.113.9, 10.0.0.5' }), {
        trust: 10,
        directIp: '10.0.0.5',
        peerIp: '10.0.0.5',
      });
      expect(ip).toBe('10.0.0.5');
    });

    it('cf-connecting-ip from an untrusted peer is ignored', () => {
      const ip = resolveClientIp(
        lookup({ 'cf-connecting-ip': '203.0.113.10', 'x-forwarded-for': '203.0.113.9' }),
        {
          trust: ['10.0.0.0/8'],
          directIp: '198.51.100.200',
          peerIp: '198.51.100.200',
          cloudflare: true,
        }
      );
      expect(ip).not.toBe('203.0.113.10');
    });

    it('an IPv4-mapped IPv6 peer matches a trusted IPv4 CIDR after normalization', () => {
      const ip = resolveClientIp(lookup({ 'x-forwarded-for': '203.0.113.9, 10.0.0.5' }), {
        trust: ['10.0.0.0/8'],
        directIp: '::ffff:10.0.0.5',
        peerIp: '::ffff:10.0.0.5',
      });
      expect(ip).toBe('203.0.113.9');
    });
  });

  describe('trust: false — unchanged from today', () => {
    it('returns directIp, chain never consulted', () => {
      const ip = resolveClientIp(lookup({ 'x-forwarded-for': '1.1.1.1' }), {
        trust: false,
        directIp: '10.0.0.1',
      });
      expect(ip).toBe('10.0.0.1');
    });
  });
});
