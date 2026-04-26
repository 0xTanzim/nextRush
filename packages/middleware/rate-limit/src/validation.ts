/**
 * @nextrush/rate-limit - Validation
 *
 * Input validation for rate limit options.
 *
 * @packageDocumentation
 */

import {
  DEFAULT_BLACKLIST_MULTIPLIER,
  DEFAULT_MAX,
  DEFAULT_MAX_ENTRIES,
  DEFAULT_STATUS_CODE,
} from './constants';
import type { RateLimitOptions, TieredRateLimitOptions } from './types';
import { parseWindow } from './utils/parse-window';

/**
 * Validation error for rate limit options
 */
export class RateLimitValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitValidationError';
  }
}

/**
 * Validate rate limit options
 *
 * @throws {RateLimitValidationError} If options are invalid
 */
export function validateOptions(options: RateLimitOptions): void {
  if (options.max !== undefined) {
    if (typeof options.max !== 'number' || !Number.isFinite(options.max)) {
      throw new RateLimitValidationError('max must be a finite number');
    }
    if (options.max <= 0) {
      throw new RateLimitValidationError('max must be greater than 0');
    }
    if (!Number.isInteger(options.max)) {
      throw new RateLimitValidationError('max must be an integer');
    }
  }

  if (options.burstLimit !== undefined) {
    if (typeof options.burstLimit !== 'number' || !Number.isFinite(options.burstLimit)) {
      throw new RateLimitValidationError('burstLimit must be a finite number');
    }
    if (options.burstLimit <= 0) {
      throw new RateLimitValidationError('burstLimit must be greater than 0');
    }
    if (!Number.isInteger(options.burstLimit)) {
      throw new RateLimitValidationError('burstLimit must be an integer');
    }
  }

  if (options.statusCode !== undefined) {
    if (typeof options.statusCode !== 'number' || !Number.isInteger(options.statusCode)) {
      throw new RateLimitValidationError('statusCode must be an integer');
    }
    if (options.statusCode < 100 || options.statusCode > 599) {
      throw new RateLimitValidationError('statusCode must be between 100 and 599');
    }
  }

  if (options.blacklistMultiplier !== undefined) {
    if (
      typeof options.blacklistMultiplier !== 'number' ||
      !Number.isFinite(options.blacklistMultiplier)
    ) {
      throw new RateLimitValidationError('blacklistMultiplier must be a finite number');
    }
    if (options.blacklistMultiplier < 0 || options.blacklistMultiplier > 1) {
      throw new RateLimitValidationError('blacklistMultiplier must be between 0 and 1');
    }
  }

  if (options.cleanupInterval !== undefined) {
    if (typeof options.cleanupInterval !== 'number' || !Number.isFinite(options.cleanupInterval)) {
      throw new RateLimitValidationError('cleanupInterval must be a finite number');
    }
    if (options.cleanupInterval < 0) {
      throw new RateLimitValidationError('cleanupInterval must be non-negative');
    }
  }

  if (options.whitelist !== undefined && !Array.isArray(options.whitelist)) {
    throw new RateLimitValidationError('whitelist must be an array');
  }

  if (options.blacklist !== undefined && !Array.isArray(options.blacklist)) {
    throw new RateLimitValidationError('blacklist must be an array');
  }

  if (options.keyGenerator !== undefined && typeof options.keyGenerator !== 'function') {
    throw new RateLimitValidationError('keyGenerator must be a function');
  }

  if (options.skip !== undefined && typeof options.skip !== 'function') {
    throw new RateLimitValidationError('skip must be a function');
  }

  if (options.handler !== undefined && typeof options.handler !== 'function') {
    throw new RateLimitValidationError('handler must be a function');
  }

  if (options.onRateLimited !== undefined && typeof options.onRateLimited !== 'function') {
    throw new RateLimitValidationError('onRateLimited must be a function');
  }

  if (options.window !== undefined) {
    const windowMs = parseWindow(options.window);
    if (!Number.isFinite(windowMs) || windowMs <= 0) {
      throw new RateLimitValidationError('window must resolve to a positive finite duration');
    }
  }

  if (options.algorithm !== undefined) {
    const validAlgorithms = ['token-bucket', 'sliding-window', 'fixed-window'];
    if (!validAlgorithms.includes(options.algorithm)) {
      throw new RateLimitValidationError(`algorithm must be one of: ${validAlgorithms.join(', ')}`);
    }
  }
}

/**
 * Validate tiered rate limit options
 *
 * @throws {RateLimitValidationError} If options are invalid
 */
export function validateTieredOptions(options: TieredRateLimitOptions): void {
  if (!options.tiers || typeof options.tiers !== 'object') {
    throw new RateLimitValidationError('tiers must be an object');
  }

  const tierNames = Object.keys(options.tiers);
  if (tierNames.length === 0) {
    throw new RateLimitValidationError('At least one tier must be defined');
  }

  for (const [name, config] of Object.entries(options.tiers)) {
    if (!config || typeof config !== 'object') {
      throw new RateLimitValidationError(`Tier "${name}" must be an object`);
    }

    if (typeof config.max !== 'number' || config.max <= 0) {
      throw new RateLimitValidationError(`Tier "${name}" max must be a positive number`);
    }

    if (!config.window) {
      throw new RateLimitValidationError(`Tier "${name}" window is required`);
    }

    if (config.burstLimit !== undefined) {
      if (typeof config.burstLimit !== 'number' || config.burstLimit <= 0) {
        throw new RateLimitValidationError(`Tier "${name}" burstLimit must be a positive number`);
      }
    }

    const tierWindowMs = parseWindow(config.window);
    if (!Number.isFinite(tierWindowMs) || tierWindowMs <= 0) {
      throw new RateLimitValidationError(
        `Tier "${name}" window must resolve to a positive finite duration`
      );
    }
  }

  if (typeof options.tierResolver !== 'function') {
    throw new RateLimitValidationError('tierResolver must be a function');
  }

  if (options.defaultTier !== undefined) {
    if (typeof options.defaultTier !== 'string') {
      throw new RateLimitValidationError('defaultTier must be a string');
    }
    if (!tierNames.includes(options.defaultTier)) {
      throw new RateLimitValidationError(
        `defaultTier "${options.defaultTier}" must be one of: ${tierNames.join(', ')}`
      );
    }
  }
}

/**
 * Validate IP address format (basic check)
 *
 * @returns true if the IP appears to be a valid format
 */
export function isValidIpFormat(ip: string): boolean {
  const trimmed = ip.trim();
  if (!trimmed) return false;

  // IPv4
  if (trimmed.includes('.')) {
    const parts = trimmed.split('.');
    if (parts.length !== 4) return false;
    return parts.every((part) => {
      const num = parseInt(part, 10);
      return !isNaN(num) && num >= 0 && num <= 255 && String(num) === part;
    });
  }

  // IPv6 (simplified check)
  if (trimmed.includes(':')) {
    const clean = trimmed.replace(/^\[|\]$/g, '');
    // Basic IPv6 pattern check
    return (
      /^([0-9a-fA-F]{0,4}:){1,7}[0-9a-fA-F]{0,4}$|^::1$|^::$/.test(clean) ||
      /^::ffff:\d+\.\d+\.\d+\.\d+$/i.test(clean)
    );
  }

  return false;
}

/**
 * Safe defaults for options
 */
export const SAFE_DEFAULTS = {
  max: DEFAULT_MAX,
  statusCode: DEFAULT_STATUS_CODE,
  blacklistMultiplier: DEFAULT_BLACKLIST_MULTIPLIER,
  maxEntries: DEFAULT_MAX_ENTRIES,
} as const;
