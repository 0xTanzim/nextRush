/**
 * @nextrush/rate-limit - Public API surface test
 *
 * Locks the exported symbol set from `src/index.ts`. If this test fails, the
 * public API has changed. Intentional changes require an explicit update to
 * the expected list below, plus a changeset for a published package.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as rateLimitApi from '../index';
import {
  algorithms,
  CIDR_MAX_IPV4,
  CIDR_MAX_IPV6,
  CIDR_PATTERN,
  DEFAULT_ALGORITHM,
  DEFAULT_BLACKLIST_MULTIPLIER,
  DEFAULT_CLEANUP_INTERVAL,
  DEFAULT_KEY_PREFIX,
  DEFAULT_MAX,
  DEFAULT_MAX_ENTRIES,
  DEFAULT_MESSAGE,
  DEFAULT_STATUS_CODE,
  DEFAULT_WINDOW,
  DEFAULT_WINDOW_MS,
  fixedWindow,
  getAlgorithm,
  INFO_CACHE_MAX,
  IPV4_MAPPED_PREFIX,
  IPV4_MAX_OCTET,
  IPV4_OCTET_COUNT,
  IPV6_PATTERN,
  LEGACY_HEADERS,
  LEGACY_RATE_LIMIT_HEADERS,
  PROXY_HEADERS,
  RETRY_AFTER_HEADER,
  SAFE_DEFAULTS,
  slidingWindow,
  STANDARD_HEADERS,
  STANDARD_RATE_LIMIT_HEADERS,
  TIME_UNITS,
  tokenBucket,
  WINDOW_PATTERN,
} from '../index';
import type { Algorithm, KeyGenerator, MemoryStoreOptions, OnRateLimited, RateLimitAlgorithm, RateLimitHandler, RateLimitInfo, RateLimitMiddleware, RateLimitOptions, RateLimitStore, SkipFunction, StoreEntry, TierConfig, TieredRateLimitOptions, TierResolver } from '../index';

describe('Public API surface (runtime exports)', () => {
  it('exports exactly the intended runtime symbols (default export excluded — vitest module namespace)', () => {
    const actualExports = Object.keys(rateLimitApi).filter((k) => k !== 'default').sort();

    // SEALED: intentional public runtime API surface.
    const expectedRuntime = [
      'rateLimit',
      'tieredRateLimit',
      'algorithms',
      'fixedWindow',
      'getAlgorithm',
      'slidingWindow',
      'tokenBucket',
      'CIDR_MAX_IPV4',
      'CIDR_MAX_IPV6',
      'CIDR_PATTERN',
      'DEFAULT_ALGORITHM',
      'DEFAULT_BLACKLIST_MULTIPLIER',
      'DEFAULT_CLEANUP_INTERVAL',
      'DEFAULT_KEY_PREFIX',
      'DEFAULT_MAX',
      'DEFAULT_MAX_ENTRIES',
      'DEFAULT_MESSAGE',
      'DEFAULT_STATUS_CODE',
      'DEFAULT_WINDOW',
      'DEFAULT_WINDOW_MS',
      'INFO_CACHE_MAX',
      'IPV4_MAPPED_PREFIX',
      'IPV4_MAX_OCTET',
      'IPV4_OCTET_COUNT',
      'IPV6_PATTERN',
      'LEGACY_HEADERS',
      'PROXY_HEADERS',
      'RETRY_AFTER_HEADER',
      'STANDARD_HEADERS',
      'TIME_UNITS',
      'WINDOW_PATTERN',
      'createMemoryStore',
      'MemoryStore',
      'LEGACY_RATE_LIMIT_HEADERS',
      'setRateLimitHeaders',
      'STANDARD_RATE_LIMIT_HEADERS',
      'defaultKeyGenerator',
      'isIpInList',
      'isValidIpv4',
      'isValidIpv6',
      'normalizeIp',
      'parseCidr',
      'formatDuration',
      'parseWindow',
      'isValidIpFormat',
      'RateLimitValidationError',
      'SAFE_DEFAULTS',
      'validateOptions',
      'validateTieredOptions',
    ].sort();

    expect(actualExports).toEqual(expectedRuntime);
    expect(rateLimitApi.default).toBeDefined();
    expect(typeof algorithms).toBe('object');
    expect(typeof CIDR_MAX_IPV4).toBe('number');
    expect(typeof CIDR_MAX_IPV6).toBe('number');
    expect(typeof DEFAULT_ALGORITHM).toBe('string');
    expect(typeof DEFAULT_MAX).toBe('number');
    expect(typeof LEGACY_HEADERS).toBe('object');
    expect(typeof STANDARD_HEADERS).toBe('object');
    expect(typeof LEGACY_RATE_LIMIT_HEADERS).toBe('object');
    expect(typeof STANDARD_RATE_LIMIT_HEADERS).toBe('object');
    expect(typeof SAFE_DEFAULTS).toBe('object');
    expect(typeof CIDR_PATTERN.test).toBe('function');
    expect(typeof IPV6_PATTERN.test).toBe('function');
    expect(typeof WINDOW_PATTERN.test).toBe('function');
    expect(typeof fixedWindow).toBe('object');
    expect(typeof slidingWindow).toBe('object');
    expect(typeof tokenBucket).toBe('object');
    expect(typeof getAlgorithm).toBe('function');
    expect(typeof PROXY_HEADERS === 'object' || Array.isArray(PROXY_HEADERS)).toBe(true);
    expect(typeof IPV4_MAPPED_PREFIX).toBe('string');
    expect(typeof IPV4_MAX_OCTET).toBe('number');
    expect(typeof IPV4_OCTET_COUNT).toBe('number');
    expect(typeof RETRY_AFTER_HEADER).toBe('string');
    expect(typeof TIME_UNITS).toBe('object');
    expect(typeof INFO_CACHE_MAX).toBe('number');
    expect(typeof DEFAULT_MAX_ENTRIES).toBe('number');
    expect(typeof DEFAULT_WINDOW_MS).toBe('number');
  });
});

describe('Public API surface (type-only exports)', () => {
  it('the type-only surface stays importable from the barrel', () => {
    // Compile-time only: removing/renaming any of these in src/index.ts fails
    // this file to type-check.
    type Surface = [
      Algorithm,
      KeyGenerator,
      OnRateLimited,
      RateLimitAlgorithm,
      RateLimitHandler,
      RateLimitInfo,
      RateLimitMiddleware,
      RateLimitOptions,
      RateLimitStore,
      SkipFunction,
      StoreEntry,
      TierConfig,
      TieredRateLimitOptions,
      TierResolver,
      MemoryStoreOptions,
    ];
    expectTypeOf<Surface>().not.toBeNever();
  });
});
