/**
 * @nextrush/di - Decorators (Re-export Barrel)
 *
 * Public API combining service decorators, injection decorators, and metadata readers.
 * Internal implementations are split across focused modules for clarity and maintainability.
 */

// Service decorators
export { Config, Repository, Service } from './service-decorators.js';

// Injection decorators & adapters
export {
  Optional,
  delay,
  getOptionalParams,
  inject,
  isParameterOptional,
  markInjectable,
  Injectable,
} from './injection.js';

// Metadata readers
export { getConfigPrefix, getServiceScope, getServiceType, hasServiceMetadata } from './service-metadata.js';
