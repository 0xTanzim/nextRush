/**
 * @nextrush/rate-limit - Constants
 *
 * Centralized configuration defaults and magic values.
 *
 * @packageDocumentation
 */

import type { RateLimitAlgorithm } from './types';

/**
 * Default rate limiting algorithm
 * Token bucket allows controlled bursts while maintaining average rate
 */
export const DEFAULT_ALGORITHM: RateLimitAlgorithm = 'token-bucket';

/**
 * Default maximum requests per window
 */
export const DEFAULT_MAX = 100;

/**
 * Default time window (1 minute)
 */
export const DEFAULT_WINDOW = '1m';

/**
 * Default window in milliseconds
 */
export const DEFAULT_WINDOW_MS = 60_000;

/**
 * HTTP status code for rate-limited responses
 * 429 Too Many Requests (RFC 6585)
 */
export const DEFAULT_STATUS_CODE = 429;

/**
 * Default error message for rate-limited responses
 */
export const DEFAULT_MESSAGE = 'Too many requests, please try again later.';

/**
 * Default multiplier for blacklisted IPs
 * 0.5 means blacklisted IPs get half the normal limit
 */
export const DEFAULT_BLACKLIST_MULTIPLIER = 0.5;

/**
 * Default cleanup interval for expired entries (1 minute)
 */
export const DEFAULT_CLEANUP_INTERVAL = 60_000;

/**
 * Default maximum entries in memory store
 * Prevents DoS via key exhaustion
 */
export const DEFAULT_MAX_ENTRIES = 100_000;

/**
 * Maximum info cache entries in rateLimit middleware
 * Prevents unbounded memory growth from unique client keys
 */
export const INFO_CACHE_MAX = 10_000;

/**
 * Rate limit key prefix
 */
export const DEFAULT_KEY_PREFIX = 'rl:';

/**
 * Headers to check for real client IP (in order of preference)
 * Order matters: CDN-specific headers are checked first
 */
export const PROXY_HEADERS = [
  'cf-connecting-ip', // Cloudflare
  'x-real-ip', // Nginx
  'x-forwarded-for', // Standard proxy header
  'x-client-ip', // Apache
  'true-client-ip', // Akamai
  'x-cluster-client-ip', // Rackspace
  'forwarded-for', // Variation
  'forwarded', // RFC 7239
] as const;

/**
 * Standard IETF RateLimit header names
 * @see https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/
 */
export const STANDARD_HEADERS = {
  LIMIT: 'RateLimit-Limit',
  REMAINING: 'RateLimit-Remaining',
  RESET: 'RateLimit-Reset',
  POLICY: 'RateLimit-Policy',
} as const;

/**
 * Legacy X-RateLimit header names (widely used)
 */
export const LEGACY_HEADERS = {
  LIMIT: 'X-RateLimit-Limit',
  REMAINING: 'X-RateLimit-Remaining',
  RESET: 'X-RateLimit-Reset',
} as const;

/**
 * Retry-After header name
 */
export const RETRY_AFTER_HEADER = 'Retry-After';

/**
 * Time unit multipliers in milliseconds
 */
export const TIME_UNITS: Record<string, number> = {
  s: 1_000,
  sec: 1_000,
  second: 1_000,
  seconds: 1_000,
  m: 60_000,
  min: 60_000,
  minute: 60_000,
  minutes: 60_000,
  h: 3_600_000,
  hr: 3_600_000,
  hour: 3_600_000,
  hours: 3_600_000,
  d: 86_400_000,
  day: 86_400_000,
  days: 86_400_000,
} as const;

/**
 * Regular expression for parsing window duration strings
 */
export const WINDOW_PATTERN =
  /^(\d+(?:\.\d+)?)\s*(s|sec|second|seconds|m|min|minute|minutes|h|hr|hour|hours|d|day|days)$/i;

/**
 * IPv4 octet count
 */
export const IPV4_OCTET_COUNT = 4;

/**
 * Maximum valid IPv4 octet value
 */
export const IPV4_MAX_OCTET = 255;

/**
 * IPv4-mapped IPv6 prefix
 */
export const IPV4_MAPPED_PREFIX = '::ffff:';

/**
 * IPv6 validation pattern (simplified but comprehensive)
 */
export const IPV6_PATTERN =
  /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$|^::1$|^::$|^::ffff:\d+\.\d+\.\d+\.\d+$/;

/**
 * CIDR notation pattern
 */
export const CIDR_PATTERN = /^(.+)\/(\d{1,3})$/;

/**
 * Maximum CIDR prefix for IPv4
 */
export const CIDR_MAX_IPV4 = 32;

/**
 * Maximum CIDR prefix for IPv6
 */
export const CIDR_MAX_IPV6 = 128;
