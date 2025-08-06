/**
 * Configuration Validation System for NextRush v2
 *
 * Provides type-safe configuration validation to prevent runtime errors
 * and ensure proper application initialization.
 *
 * @packageDocumentation
 */

import type { ApplicationOptions } from '@/types/http';

/**
 * Configuration validation errors
 */
export class ConfigurationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: unknown
  ) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Validation rules for application options
 */
export interface ValidationRule<T = unknown> {
  validate: (value: T) => boolean;
  message: string;
}

/**
 * Built-in validation rules
 */
export const ValidationRules = {
  /**
   * Validate port number
   */
  port: {
    validate: (port: number) =>
      Number.isInteger(port) && port >= 0 && port <= 65535,
    message: 'Port must be an integer between 0 and 65535',
  } as ValidationRule<number>,

  /**
   * Validate host string
   */
  host: {
    validate: (host: string) => typeof host === 'string' && host.length > 0,
    message: 'Host must be a non-empty string',
  } as ValidationRule<string>,

  /**
   * Validate timeout
   */
  timeout: {
    validate: (timeout: number) =>
      Number.isInteger(timeout) && timeout > 0 && timeout <= 300000, // Max 5 minutes
    message: 'Timeout must be a positive integer (max 300000ms)',
  } as ValidationRule<number>,

  /**
   * Validate maxBodySize
   */
  maxBodySize: {
    validate: (size: number) =>
      Number.isInteger(size) && size > 0 && size <= 100 * 1024 * 1024, // Max 100MB
    message: 'MaxBodySize must be a positive integer (max 100MB)',
  } as ValidationRule<number>,

  /**
   * Validate keepAlive
   */
  keepAlive: {
    validate: (keepAlive: number) =>
      Number.isInteger(keepAlive) && keepAlive >= 0 && keepAlive <= 300000, // Max 5 minutes
    message: 'KeepAlive must be a non-negative integer (max 300000ms)',
  } as ValidationRule<number>,

  /**
   * Validate boolean values
   */
  boolean: {
    validate: (value: boolean) => typeof value === 'boolean',
    message: 'Value must be a boolean',
  } as ValidationRule<boolean>,

  /**
   * Validate string values
   */
  string: {
    validate: (value: string) => typeof value === 'string',
    message: 'Value must be a string',
  } as ValidationRule<string>,

  /**
   * Validate template engine configuration
   */
  template: {
    validate: (template: { engine: string; directory: string }) =>
      typeof template === 'object' &&
      template !== null &&
      typeof template.engine === 'string' &&
      typeof template.directory === 'string' &&
      template.engine.length > 0 &&
      template.directory.length > 0,
    message:
      'Template must be an object with non-empty engine and directory strings',
  } as ValidationRule<{ engine: string; directory: string }>,
};

/**
 * Configuration schema definition
 */
const CONFIG_SCHEMA: Record<string, ValidationRule<unknown>> = {
  port: ValidationRules.port as ValidationRule<unknown>,
  host: ValidationRules.host as ValidationRule<unknown>,
  debug: ValidationRules.boolean as ValidationRule<unknown>,
  trustProxy: ValidationRules.boolean as ValidationRule<unknown>,
  maxBodySize: ValidationRules.maxBodySize as ValidationRule<unknown>,
  timeout: ValidationRules.timeout as ValidationRule<unknown>,
  cors: ValidationRules.boolean as ValidationRule<unknown>,
  static: ValidationRules.string as ValidationRule<unknown>,
  template: ValidationRules.template as ValidationRule<unknown>,
  keepAlive: ValidationRules.keepAlive as ValidationRule<unknown>,
};

/**
 * Validate a single configuration field
 */
export function validateField<T>(
  fieldName: string,
  value: T,
  rule: ValidationRule<T>
): void {
  if (!rule.validate(value)) {
    throw new ConfigurationError(
      `Invalid ${fieldName}: ${rule.message}`,
      fieldName,
      value
    );
  }
}

/**
 * Validate complete application options
 */
export function validateApplicationOptions(
  options: Partial<ApplicationOptions>
): void {
  const errors: ConfigurationError[] = [];

  // Validate each provided option
  for (const [key, value] of Object.entries(options)) {
    const rule = CONFIG_SCHEMA[key as keyof ApplicationOptions];

    if (!rule) {
      errors.push(
        new ConfigurationError(
          `Unknown configuration option: ${key}`,
          key,
          value
        )
      );
      continue;
    }

    try {
      validateField(key, value, rule as ValidationRule);
    } catch (error) {
      if (error instanceof ConfigurationError) {
        errors.push(error);
      }
    }
  }

  if (errors.length > 0) {
    const messages = errors.map(e => e.message).join(', ');
    throw new ConfigurationError(
      `Configuration validation failed: ${messages}`,
      'multiple',
      options
    );
  }
}

/**
 * Create safe configuration with defaults and validation
 */
export function createSafeConfiguration(
  options: Partial<ApplicationOptions> = {}
): Required<ApplicationOptions> {
  // Validate provided options first
  validateApplicationOptions(options);

  // Merge with safe defaults
  const safeDefaults: Required<ApplicationOptions> = {
    port: 3000,
    host: 'localhost',

    debug: false,
    trustProxy: false,
    maxBodySize: 1024 * 1024, // 1MB
    timeout: 30000, // 30 seconds
    cors: true,
    static: 'public',
    template: {
      engine: 'simple',
      directory: 'views',
    },
    keepAlive: 10000, // 10 seconds
  };

  const mergedOptions = { ...safeDefaults, ...options };

  // Validate final configuration
  validateApplicationOptions(mergedOptions);

  return mergedOptions;
}

/**
 * Configuration validation utilities
 */
export const ConfigUtils = {
  /**
   * Check if a value is a valid port
   */
  isValidPort: (value: unknown): value is number =>
    ValidationRules.port.validate(value as number),

  /**
   * Check if a value is a valid host
   */
  isValidHost: (value: unknown): value is string =>
    ValidationRules.host.validate(value as string),

  /**
   * Check if a value is a valid timeout
   */
  isValidTimeout: (value: unknown): value is number =>
    ValidationRules.timeout.validate(value as number),

  /**
   * Sanitize configuration by removing invalid fields
   */
  sanitize: (options: Record<string, unknown>): Partial<ApplicationOptions> => {
    const sanitized: Partial<ApplicationOptions> = {};

    for (const [key, value] of Object.entries(options)) {
      const rule = CONFIG_SCHEMA[key as keyof ApplicationOptions];
      if (rule && rule.validate(value)) {
        (sanitized as Record<string, unknown>)[key] = value;
      }
    }

    return sanitized;
  },
};
