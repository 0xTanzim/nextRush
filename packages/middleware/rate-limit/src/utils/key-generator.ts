import type { Context } from '@nextrush/types';

/**
 * Headers to check for real client IP (in order of preference)
 */
const PROXY_HEADERS = [
  'cf-connecting-ip',      // Cloudflare
  'x-real-ip',             // Nginx
  'x-forwarded-for',       // Standard proxy header
  'x-client-ip',           // Apache
  'true-client-ip',        // Akamai
  'x-cluster-client-ip',   // Rackspace
  'forwarded-for',         // Variation
  'forwarded',             // RFC 7239
] as const;

/**
 * Extract client IP from context
 * Handles proxies and load balancers
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
function isValidIpv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;

  return parts.every((part) => {
    const num = parseInt(part, 10);
    return !isNaN(num) && num >= 0 && num <= 255 && part === String(num);
  });
}

/**
 * Check if string is valid IPv6
 */
function isValidIpv6(ip: string): boolean {
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

  const ipv4Mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (ipv4Mapped?.[1]) {
    normalized = ipv4Mapped[1];
  }

  return normalized.toLowerCase();
}

/**
 * Default key generator using IP address
 */
export function defaultKeyGenerator(ctx: Context, trustProxy: boolean): string {
  return `rl:${extractClientIp(ctx, trustProxy)}`;
}

/**
 * Check if IP is in a list (supports CIDR notation in future)
 */
export function isIpInList(ip: string, list: string[]): boolean {
  const normalizedIp = normalizeIp(ip);
  return list.some((item) => normalizeIp(item) === normalizedIp);
}
