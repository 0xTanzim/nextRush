import type { Context } from '@nextrush/types';
import {
  CIDR_MAX_IPV4,
  CIDR_MAX_IPV6,
  CIDR_PATTERN,
  DEFAULT_KEY_PREFIX,
  IPV4_MAPPED_PREFIX,
  IPV4_MAX_OCTET,
  IPV4_OCTET_COUNT,
  PROXY_HEADERS,
} from '../constants';

/**
 * Extract client IP from context
 * Handles proxies and load balancers
 *
 * @security When `trustProxy` is `true`, ALL proxy headers are trusted.
 * Only enable this behind a trusted reverse proxy (nginx, cloudflare, etc.).
 * Untrusted clients can spoof their IP via headers like X-Forwarded-For.
 * For production, consider using a custom `keyGenerator` that validates
 * proxy source IPs against a known allowlist.
 */
export function extractClientIp(ctx: Context, trustProxy: boolean): string {
  if (trustProxy) {
    for (const header of PROXY_HEADERS) {
      const value = ctx.get(header);
      if (value) {
        const ip = parseProxyHeader(value, header);
        if (ip && isValidIp(ip)) {
          return normalizeIp(ip);
        }
      }
    }
  }

  return normalizeIp(ctx.ip || '127.0.0.1');
}

/**
 * Parse proxy header value to extract first IP
 */
function parseProxyHeader(value: string, header: string): string | null {
  if (header === 'forwarded') {
    const match = value.match(/for=["']?([^"',;\s]+)/i);
    return match?.[1] ?? null;
  }

  const firstIp = value.split(',')[0]?.trim();
  return firstIp || null;
}

/**
 * Validate IP address format
 */
function isValidIp(ip: string): boolean {
  const cleanIp = ip.replace(/^\[|\]$/g, '');
  return isValidIpv4(cleanIp) || isValidIpv6(cleanIp);
}

/**
 * Check if string is valid IPv4
 */
export function isValidIpv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== IPV4_OCTET_COUNT) return false;

  return parts.every((part) => {
    const num = parseInt(part, 10);
    return !isNaN(num) && num >= 0 && num <= IPV4_MAX_OCTET && part === String(num);
  });
}

/**
 * Check if string is valid IPv6
 */
export function isValidIpv6(ip: string): boolean {
  const cleanIp = ip.replace(/^\[|\]$/g, '');
  const pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$|^::1$|^::$/;
  return pattern.test(cleanIp);
}

/**
 * Normalize IP address for consistent key generation
 * - Removes port numbers
 * - Handles IPv6 brackets
 * - Converts IPv4-mapped IPv6 to IPv4
 */
export function normalizeIp(ip: string): string {
  let normalized = ip.trim();

  normalized = normalized.replace(/^\[|\]$/g, '');

  const portMatch = normalized.match(/^(.+):(\d+)$/);
  if (portMatch?.[1] && isValidIpv4(portMatch[1])) {
    normalized = portMatch[1];
  }

  const ipv4MappedRegex = new RegExp(`^${IPV4_MAPPED_PREFIX}(\\d+\\.\\d+\\.\\d+\\.\\d+)$`, 'i');
  const ipv4Mapped = normalized.match(ipv4MappedRegex);
  if (ipv4Mapped?.[1]) {
    normalized = ipv4Mapped[1];
  }

  return normalized.toLowerCase();
}

/**
 * Default key generator using IP address
 */
export function defaultKeyGenerator(ctx: Context, trustProxy: boolean): string {
  return `${DEFAULT_KEY_PREFIX}${extractClientIp(ctx, trustProxy)}`;
}

/**
 * Convert IPv4 address to 32-bit integer for CIDR matching
 */
function ipv4ToInt(ip: string): number {
  const parts = ip.split('.');
  return parts.reduce((acc, part) => (acc << 8) + parseInt(part, 10), 0) >>> 0;
}

/**
 * Check if IPv4 is in CIDR range
 */
function isIpv4InCidr(ip: string, cidr: string, prefix: number): boolean {
  const ipInt = ipv4ToInt(ip);
  const cidrInt = ipv4ToInt(cidr);
  const mask = prefix === 0 ? 0 : (~0 << (CIDR_MAX_IPV4 - prefix)) >>> 0;

  return (ipInt & mask) === (cidrInt & mask);
}

/**
 * Expand an IPv6 address to an array of 8 uint16 groups
 */
function expandIpv6(ip: string): number[] {
  // Handle IPv4-mapped IPv6
  if (ip.toLowerCase().startsWith('::ffff:') && ip.includes('.')) {
    const v4Parts = ip.slice(7).split('.').map(Number);
    if (v4Parts.length !== 4) return [];
    return [0, 0, 0, 0, 0, 0xffff, (v4Parts[0] << 8) | v4Parts[1], (v4Parts[2] << 8) | v4Parts[3]];
  }

  const parts = ip.split('::');
  let groups: number[];

  if (parts.length === 2) {
    const left = parts[0] ? parts[0].split(':').map((h) => parseInt(h, 16)) : [];
    const right = parts[1] ? parts[1].split(':').map((h) => parseInt(h, 16)) : [];
    const fill = 8 - left.length - right.length;
    if (fill < 0) return [];
    groups = [...left, ...(Array(fill).fill(0) as number[]), ...right];
  } else if (parts.length === 1) {
    groups = ip.split(':').map((h) => parseInt(h, 16));
  } else {
    return [];
  }

  if (groups.length !== 8) return [];
  if (groups.some((g) => isNaN(g) || g < 0 || g > 0xffff)) return [];

  return groups;
}

/**
 * Check if IPv6 is in CIDR range
 */
function isIpv6InCidr(ip: string, cidr: string, prefix: number): boolean {
  const ipGroups = expandIpv6(ip);
  const cidrGroups = expandIpv6(cidr);

  if (ipGroups.length !== 8 || cidrGroups.length !== 8) return false;

  let bitsRemaining = prefix;
  for (let i = 0; i < 8 && bitsRemaining > 0; i++) {
    const bits = Math.min(16, bitsRemaining);
    const mask = bits === 16 ? 0xffff : (0xffff << (16 - bits)) & 0xffff;
    if ((ipGroups[i] & mask) !== (cidrGroups[i] & mask)) return false;
    bitsRemaining -= bits;
  }
  return true;
}

/**
 * Parse CIDR notation and extract IP and prefix
 */
export function parseCidr(entry: string): { ip: string; prefix: number } | null {
  const match = entry.match(CIDR_PATTERN);
  if (!match?.[1] || !match[2]) return null;

  const ip = match[1];
  const prefix = parseInt(match[2], 10);

  if (isValidIpv4(ip)) {
    if (prefix < 0 || prefix > CIDR_MAX_IPV4) return null;
    return { ip, prefix };
  }

  if (isValidIpv6(ip)) {
    if (prefix < 0 || prefix > CIDR_MAX_IPV6) return null;
    return { ip, prefix };
  }

  return null;
}

/**
 * Check if IP is in a list (supports CIDR notation)
 *
 * @example
 * ```typescript
 * isIpInList('192.168.1.50', ['192.168.1.0/24']); // true
 * isIpInList('192.168.2.1', ['192.168.1.0/24']);  // false
 * isIpInList('10.0.0.1', ['10.0.0.1']);           // true (exact match)
 * ```
 */
export function isIpInList(ip: string, list: string[]): boolean {
  const normalizedIp = normalizeIp(ip);

  return list.some((entry) => {
    // Check for CIDR notation
    const cidr = parseCidr(entry);
    if (cidr) {
      if (isValidIpv4(normalizedIp) && isValidIpv4(cidr.ip)) {
        return isIpv4InCidr(normalizedIp, cidr.ip, cidr.prefix);
      }
      if (isValidIpv6(normalizedIp) && isValidIpv6(cidr.ip)) {
        return isIpv6InCidr(normalizedIp, cidr.ip, cidr.prefix);
      }
      return false;
    }

    // Exact match
    return normalizeIp(entry) === normalizedIp;
  });
}
