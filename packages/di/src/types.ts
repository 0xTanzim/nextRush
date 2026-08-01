/**
 * @nextrush/di - Types
 *
 * The container contract now lives in `@nextrush/types` (shared, lowest
 * package). This module re-exports it and adds the DI-specific metadata types.
 */

export type {
  ClassProvider,
  Constructor,
  Container,
  FactoryProvider,
  Provider,
  RegisterOptions,
  Scope,
  ServiceOptions,
  Token,
  ValueProvider,
} from '@nextrush/types';

/**
 * Metadata key constants.
 */
export const METADATA_KEYS = {
  SERVICE_TYPE: 'di:type',
  SERVICE_SCOPE: 'di:scope',
  INJECT_TOKEN: 'di:inject',
  PARAM_TYPES: 'design:paramtypes',
  CONFIG_PREFIX: 'di:config:prefix',
  OPTIONAL_PARAMS: 'di:optional',
} as const;

/**
 * Options for @Config decorator.
 */
export interface ConfigOptions {
  /**
   * Environment variable prefix.
   *
   * @example
   * ```typescript
   * @Config({ prefix: 'DB' })
   * class DatabaseConfig {
   *   readonly host = 'localhost';  // reads DB_HOST
   *   readonly port = 5432;         // reads DB_PORT
   * }
   * ```
   */
  prefix?: string;
}

/**
 * Service types for metadata.
 */
export type ServiceType = 'service' | 'repository' | 'controller' | 'config';
