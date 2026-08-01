/**
 * @nextrush/runtime - Typed proxy-trust boundary (RFC-030, SEC-01)
 *
 * CIDR matching and the trust-gated `X-Forwarded-For` chain walk that
 * {@link resolveClientIp} in `./headers.ts` delegates to. Relocated here
 * (rather than duplicated in `@nextrush/rate-limit`) so the trust policy and
 * `ctx.ip` resolution share exactly one implementation.
 *
 * @packageDocumentation
 */

import { isValidClientIp } from './headers';

const CIDR_PATTERN = /^(.+)\/(\d{1,3})$/;
const CIDR_MAX_IPV4 = 32;
const CIDR_MAX_IPV6 = 128;
const IPV4_MAPPED_PREFIX = /^::ffff:/i;

/** Strip a `::ffff:`-mapped IPv4 prefix so a mapped and a bare IPv4 literal compare equal. */
function normalizeForCidr(ip: string): string {
  return ip.replace(IPV4_MAPPED_PREFIX, '');
}

function isIPv4Literal(value: string): boolean {
  const parts = value.split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0);
}

function isIpv4InCidr(ip: string, cidr: string, prefix: number): boolean {
  const mask = prefix === 0 ? 0 : (~0 << (CIDR_MAX_IPV4 - prefix)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(cidr) & mask);
}

function expandIpv6(ip: string): number[] | undefined {
  const parts = ip.split('::');
  let groups: string[];
  if (parts.length === 2) {
    const head = parts[0] ? parts[0].split(':') : [];
    const tail = parts[1] ? parts[1].split(':') : [];
    const fill = 8 - head.length - tail.length;
    if (fill < 0) return undefined;
    groups = [...head, ...Array<string>(fill).fill('0'), ...tail];
  } else if (parts.length === 1) {
    groups = ip.split(':');
  } else {
    return undefined;
  }
  if (groups.length !== 8) return undefined;
  const nums = groups.map((g) => parseInt(g, 16));
  return nums.some((n) => isNaN(n) || n < 0 || n > 0xffff) ? undefined : nums;
}

function isIpv6InCidr(ip: string, cidr: string, prefix: number): boolean {
  const ipGroups = expandIpv6(ip);
  const cidrGroups = expandIpv6(cidr);
  if (!ipGroups || !cidrGroups) return false;

  let bitsRemaining = prefix;
  for (let i = 0; i < 8 && bitsRemaining > 0; i += 1) {
    const bits = Math.min(16, bitsRemaining);
    const mask = bits === 16 ? 0xffff : (0xffff << (16 - bits)) & 0xffff;
    const ipGroup = ipGroups[i] ?? 0;
    const cidrGroup = cidrGroups[i] ?? 0;
    if ((ipGroup & mask) !== (cidrGroup & mask)) return false;
    bitsRemaining -= bits;
  }
  return true;
}

function parseCidr(entry: string): { ip: string; prefix: number } | undefined {
  const match = CIDR_PATTERN.exec(entry);
  if (!match?.[1] || !match[2]) return undefined;
  const prefix = parseInt(match[2], 10);
  const ip = match[1];
  if (isIPv4Literal(ip)) {
    return prefix >= 0 && prefix <= CIDR_MAX_IPV4 ? { ip, prefix } : undefined;
  }
  return prefix >= 0 && prefix <= CIDR_MAX_IPV6 ? { ip, prefix } : undefined;
}

/**
 * Whether `ip` falls within any entry of `list` (each entry a bare IP or CIDR).
 *
 * @remarks
 * IPv4-mapped IPv6 literals (`::ffff:10.0.0.5`) are normalized before
 * comparison so a trusted IPv4 peer list still matches when a runtime
 * reports its socket address in mapped form (RFC-030 §8.6).
 */
export function isTrustedPeer(ip: string, list: readonly string[]): boolean {
  const normalized = normalizeForCidr(ip);
  return list.some((entry) => {
    const cidr = parseCidr(entry);
    if (cidr) {
      const cidrIp = normalizeForCidr(cidr.ip);
      if (isIPv4Literal(normalized) && isIPv4Literal(cidrIp)) {
        return isIpv4InCidr(normalized, cidrIp, cidr.prefix);
      }
      return isIpv6InCidr(normalized, cidrIp, cidr.prefix);
    }
    return normalizeForCidr(entry) === normalized;
  });
}

/** Split a raw `X-Forwarded-For` value into its comma-separated entries, trimmed. */
function splitChain(forwarded: string): string[] {
  return forwarded.split(',').map((entry) => entry.trim());
}

/**
 * Resolve the trusted client IP from an `X-Forwarded-For` chain under a hop-count trust.
 *
 * @remarks
/**
 * Resolve the trusted client IP from an `X-Forwarded-For` chain under a hop-count trust.
 *
 * @remarks
 * The resolved entry is `chain.length - hopCount` positions from the left
 * (equivalently, the `hopCount`-th entry counting from the right): hop
 * count 1 means the direct peer is the one trusted proxy, and the
 * *rightmost* chain entry is what that proxy itself observed as its own
 * peer (tasks.md 4.2: `proxy: 1` with `'203.0.113.9, 10.0.0.5'` resolves
 * `10.0.0.5`). The chain is walked further left past a malformed entry
 * rather than trusting it. Returns `undefined` (never a fallback value)
 * when no valid entry remains, so the caller can still try `x-real-ip`
 * before giving up.
 */
export function resolveByHopCount(forwarded: string, hopCount: number): string | undefined {
  const chain = splitChain(forwarded);
  for (let index = chain.length - hopCount; index >= 0; index -= 1) {
    const candidate = isValidClientIp(chain[index]);
    if (candidate) return candidate;
  }
  return undefined;
}

/**
 * Resolve the trusted client IP from an `X-Forwarded-For` chain under a
 * trusted-peer CIDR list.
 *
 * @remarks
 * The immediate connecting peer must itself be in `trustedPeers` or
 * resolution is refused outright — a forged header from an untrusted peer
 * is never consulted, including its `x-real-ip`. Once the peer is trusted,
 * the chain is walked right to left while each successive entry is also in
 * `trustedPeers`; the first entry outside the set is the resolved client
 * IP. Returns `undefined` when the peer is untrusted or the chain is
 * trusted end to end with no client-claim entry found.
 */
export function resolveByPeerList(
  forwarded: string,
  trustedPeers: readonly string[],
  peerIp: string
): string | undefined {
  if (!isTrustedPeer(peerIp, trustedPeers)) return undefined;

  const chain = splitChain(forwarded);
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    const candidate = isValidClientIp(chain[index]);
    if (!candidate) continue;
    if (!isTrustedPeer(candidate, trustedPeers)) return candidate;
  }
  return undefined;
}
