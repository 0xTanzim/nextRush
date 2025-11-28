/**
 * IP Detection Utility for NextRush v2
 *
 * Extracts client IP address from HTTP requests with support
 * for proxy headers (X-Forwarded-For, X-Real-IP).
 *
 * @packageDocumentation
 */

import type { IncomingHttpHeaders } from 'node:http';
import type { Socket } from 'node:net';
import { DEFAULT_IP } from '../constants';

/**
 * IP detection options
 */
export interface IPDetectionOptions {
  /** Trust proxy headers (default: true) */
  readonly trustProxy?: boolean;

  /** Custom proxy header to check first */
  readonly customHeader?: string;
}

/**
 * IP detection result with metadata
 */
export interface IPDetectionResult {
  /** Detected client IP address */
  readonly ip: string;

  /** Source of the IP (header name or 'socket') */
  readonly source: string;

  /** Whether the IP came from a proxy header */
  readonly fromProxy: boolean;

  /** All IPs in the forwarding chain (if X-Forwarded-For) */
  readonly forwardChain?: readonly string[];
}

/**
 * Detect client IP address from HTTP request
 *
 * Priority order:
 * 1. Custom header (if specified)
 * 2. X-Forwarded-For (first IP in chain)
 * 3. X-Real-IP
 * 4. Socket remote address
 * 5. Default fallback (127.0.0.1)
 *
 * @param headers - HTTP request headers
 * @param socket - Socket connection (optional)
 * @param options - Detection options
 * @returns Detected IP address
 *
 * @example
 * ```typescript
 * const ip = detectClientIP(req.headers, req.socket);
 * console.log(ip); // '192.168.1.1'
 * ```
 */
export function detectClientIP(
  headers: IncomingHttpHeaders,
  socket?: Socket | null,
  options: IPDetectionOptions = {}
): string {
  const { trustProxy = true, customHeader } = options;

  // Check custom header first
  if (trustProxy && customHeader) {
    const customValue = headers[customHeader.toLowerCase()];
    if (customValue && typeof customValue === 'string') {
      return customValue.trim();
    }
  }

  // Check X-Forwarded-For header
  if (trustProxy) {
    const forwardedFor = headers['x-forwarded-for'];
    if (forwardedFor) {
      const forwardedValue =
        typeof forwardedFor === 'string' ? forwardedFor : forwardedFor[0];
      if (forwardedValue) {
        // Extract first IP from comma-separated list
        const firstIP = forwardedValue.split(',')[0]?.trim();
        if (firstIP && isValidIP(firstIP)) {
          return firstIP;
        }
      }
    }

    // Check X-Real-IP header
    const realIP = headers['x-real-ip'];
    if (realIP) {
      const realIPValue = typeof realIP === 'string' ? realIP : realIP[0];
      if (realIPValue && isValidIP(realIPValue.trim())) {
        return realIPValue.trim();
      }
    }
  }

  // Fall back to socket remote address
  const socketAddress = socket?.remoteAddress;
  if (socketAddress) {
    // Handle IPv6 mapped IPv4 addresses (::ffff:127.0.0.1)
    const cleanedIP = socketAddress.replace(/^::ffff:/, '');
    if (isValidIP(cleanedIP)) {
      return cleanedIP;
    }
  }

  return DEFAULT_IP;
}

/**
 * Detect client IP with detailed metadata
 *
 * @param headers - HTTP request headers
 * @param socket - Socket connection
 * @param options - Detection options
 * @returns Detection result with metadata
 *
 * @example
 * ```typescript
 * const result = detectClientIPDetailed(req.headers, req.socket);
 * console.log(result.ip);         // '192.168.1.1'
 * console.log(result.source);     // 'x-forwarded-for'
 * console.log(result.fromProxy);  // true
 * ```
 */
export function detectClientIPDetailed(
  headers: IncomingHttpHeaders,
  socket?: Socket | null,
  options: IPDetectionOptions = {}
): IPDetectionResult {
  const { trustProxy = true, customHeader } = options;

  // Check custom header first
  if (trustProxy && customHeader) {
    const customValue = headers[customHeader.toLowerCase()];
    if (customValue && typeof customValue === 'string') {
      return {
        ip: customValue.trim(),
        source: customHeader,
        fromProxy: true,
      };
    }
  }

  // Check X-Forwarded-For header
  if (trustProxy) {
    const forwardedFor = headers['x-forwarded-for'];
    if (forwardedFor) {
      const forwardedValue =
        typeof forwardedFor === 'string' ? forwardedFor : forwardedFor[0];
      if (forwardedValue) {
        const forwardChain = forwardedValue
          .split(',')
          .map(ip => ip.trim())
          .filter(isValidIP);

        const firstIP = forwardChain[0];
        if (firstIP) {
          return {
            ip: firstIP,
            source: 'x-forwarded-for',
            fromProxy: true,
            forwardChain,
          };
        }
      }
    }

    // Check X-Real-IP header
    const realIP = headers['x-real-ip'];
    if (realIP) {
      const realIPValue = typeof realIP === 'string' ? realIP : realIP[0];
      if (realIPValue && isValidIP(realIPValue.trim())) {
        return {
          ip: realIPValue.trim(),
          source: 'x-real-ip',
          fromProxy: true,
        };
      }
    }
  }

  // Fall back to socket remote address
  const socketAddress = socket?.remoteAddress;
  if (socketAddress) {
    const cleanedIP = socketAddress.replace(/^::ffff:/, '');
    if (isValidIP(cleanedIP)) {
      return {
        ip: cleanedIP,
        source: 'socket',
        fromProxy: false,
      };
    }
  }

  return {
    ip: DEFAULT_IP,
    source: 'default',
    fromProxy: false,
  };
}

/**
 * Basic IP address validation (IPv4 and IPv6)
 *
 * @param ip - IP address to validate
 * @returns True if valid IP format
 */
export function isValidIP(ip: string): boolean {
  if (!ip || typeof ip !== 'string') {
    return false;
  }

  // IPv4 validation
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.');
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }

  // Basic IPv6 validation (simplified)
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  if (ipv6Regex.test(ip)) {
    return true;
  }

  // Loopback and special addresses
  if (ip === '::1' || ip === '::') {
    return true;
  }

  return false;
}

/**
 * Check if IP is a private/internal address
 *
 * @param ip - IP address to check
 * @returns True if private address
 */
export function isPrivateIP(ip: string): boolean {
  if (!ip) return false;

  // Private IPv4 ranges
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^169\.254\./, // Link-local
  ];

  return privateRanges.some(range => range.test(ip));
}

/**
 * Check if IP is a loopback address
 *
 * @param ip - IP address to check
 * @returns True if loopback address
 */
export function isLoopbackIP(ip: string): boolean {
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === 'localhost' ||
    ip.startsWith('127.')
  );
}
