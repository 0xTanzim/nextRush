/**
 * Configuration Service for NextRush v2
 * 
 * @packageDocumentation
 */

import { injectable, inject } from 'tsyringe';
import type { ApplicationOptions } from '@/types/http';

/**
 * Configuration validation error
 */
export class ConfigurationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Default application configuration
 */
export const DEFAULT_CONFIG: Required<ApplicationOptions> = {
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

/**
 * Configuration validation schema
 */
export interface ConfigValidationSchema {
  port: {
    type: 'number';
    min: number;
    max: number;
    default: number;
  };
  host: {
    type: 'string';
    pattern: RegExp;
    default: string;
  };
  maxBodySize: {
    type: 'number';
    min: number;
    max: number;
    default: number;
  };
  timeout: {
    type: 'number';
    min: number;
    max: number;
    default: number;
  };
  keepAlive: {
    type: 'number';
    min: number;
    max: number;
    default: number;
  };
}

/**
 * Configuration Service
 * Manages application configuration with validation and type safety
 */
@injectable()
export class ConfigurationService {
  private config: Required<ApplicationOptions>;
  private validationSchema: ConfigValidationSchema = {
    port: {
      type: 'number',
      min: 1,
      max: 65535,
      default: 3000,
    },
    host: {
      type: 'string',
      pattern: /^[a-zA-Z0-9.-]+$/,
      default: 'localhost',
    },
    maxBodySize: {
      type: 'number',
      min: 1024, // 1KB
      max: 100 * 1024 * 1024, // 100MB
      default: 1024 * 1024, // 1MB
    },
    timeout: {
      type: 'number',
      min: 1000, // 1 second
      max: 300000, // 5 minutes
      default: 30000, // 30 seconds
    },
    keepAlive: {
      type: 'number',
      min: 1000, // 1 second
      max: 60000, // 1 minute
      default: 10000, // 10 seconds
    },
  };

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Configure the application with validated options
   */
  public configure(options: ApplicationOptions = {}): void {
    const validatedOptions = this.validateAndMerge(options);
    this.config = { ...this.config, ...validatedOptions };
  }

  /**
   * Get the current configuration
   */
  public getConfig(): Required<ApplicationOptions> {
    return { ...this.config };
  }

  /**
   * Get a specific configuration value
   */
  public get<K extends keyof ApplicationOptions>(key: K): ApplicationOptions[K] {
    return this.config[key];
  }

  /**
   * Validate and merge configuration options
   */
  private validateAndMerge(options: ApplicationOptions): Partial<ApplicationOptions> {
    const validated: Partial<ApplicationOptions> = {};

    // Validate port
    if (options.port !== undefined) {
      validated.port = this.validateNumber('port', options.port, this.validationSchema.port);
    }

    // Validate host
    if (options.host !== undefined) {
      validated.host = this.validateString('host', options.host, this.validationSchema.host);
    }

    // Validate maxBodySize
    if (options.maxBodySize !== undefined) {
      validated.maxBodySize = this.validateNumber('maxBodySize', options.maxBodySize, this.validationSchema.maxBodySize);
    }

    // Validate timeout
    if (options.timeout !== undefined) {
      validated.timeout = this.validateNumber('timeout', options.timeout, this.validationSchema.timeout);
    }

    // Validate keepAlive
    if (options.keepAlive !== undefined) {
      validated.keepAlive = this.validateNumber('keepAlive', options.keepAlive, this.validationSchema.keepAlive);
    }

    // Validate template configuration
    if (options.template !== undefined) {
      validated.template = this.validateTemplateConfig(options.template);
    }

    // Validate other boolean options
    if (options.debug !== undefined) {
      validated.debug = this.validateBoolean('debug', options.debug);
    }

    if (options.trustProxy !== undefined) {
      validated.trustProxy = this.validateBoolean('trustProxy', options.trustProxy);
    }

    if (options.cors !== undefined) {
      validated.cors = this.validateBoolean('cors', options.cors);
    }

    // Validate static directory
    if (options.static !== undefined) {
      validated.static = this.validateString('static', options.static, {
        type: 'string',
        pattern: /^[a-zA-Z0-9._/-]+$/,
        default: 'public',
      });
    }

    return validated;
  }

  /**
   * Validate a number configuration value
   */
  private validateNumber(
    field: string,
    value: unknown,
    schema: { min: number; max: number; default: number }
  ): number {
    if (typeof value !== 'number') {
      throw new ConfigurationError(
        `Configuration field '${field}' must be a number, got ${typeof value}`,
        field
      );
    }

    if (value < schema.min || value > schema.max) {
      throw new ConfigurationError(
        `Configuration field '${field}' must be between ${schema.min} and ${schema.max}, got ${value}`,
        field
      );
    }

    return value;
  }

  /**
   * Validate a string configuration value
   */
  private validateString(
    field: string,
    value: unknown,
    schema: { pattern: RegExp; default: string }
  ): string {
    if (typeof value !== 'string') {
      throw new ConfigurationError(
        `Configuration field '${field}' must be a string, got ${typeof value}`,
        field
      );
    }

    if (!schema.pattern.test(value)) {
      throw new ConfigurationError(
        `Configuration field '${field}' has invalid format: ${value}`,
        field
      );
    }

    return value;
  }

  /**
   * Validate a boolean configuration value
   */
  private validateBoolean(field: string, value: unknown): boolean {
    if (typeof value !== 'boolean') {
      throw new ConfigurationError(
        `Configuration field '${field}' must be a boolean, got ${typeof value}`,
        field
      );
    }

    return value;
  }

  /**
   * Validate template configuration
   */
  private validateTemplateConfig(template: any): ApplicationOptions['template'] {
    if (typeof template !== 'object' || template === null) {
      throw new ConfigurationError('Template configuration must be an object');
    }

    const validated: ApplicationOptions['template'] = {};

    if (template.engine !== undefined) {
      if (typeof template.engine !== 'string') {
        throw new ConfigurationError('Template engine must be a string');
      }
      validated.engine = template.engine;
    }

    if (template.directory !== undefined) {
      if (typeof template.directory !== 'string') {
        throw new ConfigurationError('Template directory must be a string');
      }
      validated.directory = template.directory;
    }

    return validated;
  }

  /**
   * Reset configuration to defaults
   */
  public reset(): void {
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Check if configuration is valid
   */
  public isValid(): boolean {
    try {
      this.validateAndMerge(this.config);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get configuration as environment variables
   */
  public toEnvironmentVariables(): Record<string, string> {
    return {
      PORT: this.config.port.toString(),
      HOST: this.config.host,
      DEBUG: this.config.debug.toString(),
      TRUST_PROXY: this.config.trustProxy.toString(),
      MAX_BODY_SIZE: this.config.maxBodySize.toString(),
      TIMEOUT: this.config.timeout.toString(),
      CORS: this.config.cors.toString(),
      STATIC_DIR: this.config.static,
      KEEP_ALIVE: this.config.keepAlive.toString(),
    };
  }
} 