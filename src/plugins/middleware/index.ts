/**
 * 🔧 Middleware System Index - NextRush Framework
 *
 * Centralized exports for middleware system with optimized imports
 */

// Core plugin
export { MiddlewarePlugin } from './middleware.plugin';

// Composition utilities - optimized for direct use
export { compose, group, named, unless, when } from './composition';

// Built-in middleware functions - optimized standalone functions
export {
  compression,
  cors,
  helmet,
  logger,
  rateLimit,
  requestId,
  requestTimer,
} from './built-in';

// Presets - performance-optimized preset configurations
export {
  apiPreset,
  developmentPreset,
  fullFeaturedPreset,
  getPreset,
  productionPreset,
  type PresetName,
  type PresetOptions,
} from './presets';

// Validation plugin - enterprise-grade input validation
export { ValidationPlugin } from './validation.plugin';

// Type definitions for middleware system
export type { MiddlewareMetrics } from './middleware.plugin';

export type {
  SanitizationOptions,
  ValidationResult,
  ValidationRule,
  ValidationSchema,
} from './validation.plugin';
