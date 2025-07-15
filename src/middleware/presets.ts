/**
 * Preset Mean it is a predefined set of middleware that can be used for specific use cases and configurations . It allows developers to quickly apply a standard set of middleware without having to configure each one individually.
 * Middleware presets for common use cases
 * This file defines various middleware presets
 * that can be used to quickly set up middleware stacks
 * for different environments and applications.
 */

import { ExpressMiddleware } from '../types/express';
import {
  compression,
  cors,
  helmet,
  json,
  logger,
  requestId,
  requestTimer,
} from './built-in';

export interface MiddlewarePreset {
  name: string;
  description: string;
  middlewares: ExpressMiddleware[];
}

/**
 * Security preset - essential security middleware
 */
export function securityPreset(
  options: {
    cors?: any;
    helmet?: any;
  } = {}
): MiddlewarePreset {
  return {
    name: 'security',
    description: 'Essential security middleware for production',
    middlewares: [helmet(options.helmet), cors(options.cors)],
  };
}

/**
 * API preset - common middleware for REST APIs
 */
export function apiPreset(
  options: {
    cors?: any;
    json?: any;
    compression?: any;
  } = {}
): MiddlewarePreset {
  return {
    name: 'api',
    description: 'Common middleware for REST APIs',
    middlewares: [
      cors(options.cors),
      json(options.json),
      compression(options.compression),
      requestId(),
      requestTimer(),
    ],
  };
}

/**
 * Development preset - helpful middleware for development
 */
export function developmentPreset(
  options: {
    logger?: any;
  } = {}
): MiddlewarePreset {
  return {
    name: 'development',
    description: 'Development-friendly middleware with detailed logging',
    middlewares: [
      logger({ format: 'detailed', ...options.logger }),
      requestTimer(),
    ],
  };
}

/**
 * Production preset - optimized for production
 */
export function productionPreset(
  options: {
    cors?: any;
    helmet?: any;
    compression?: any;
    json?: any;
  } = {}
): MiddlewarePreset {
  return {
    name: 'production',
    description: 'Production-optimized middleware stack',
    middlewares: [
      helmet(options.helmet),
      cors(options.cors),
      compression(options.compression),
      json(options.json),
      logger({ format: 'json' }),
      requestId(),
    ],
  };
}

/**
 * Minimal preset - just the basics
 */
export function minimalPreset(): MiddlewarePreset {
  return {
    name: 'minimal',
    description: 'Minimal middleware for simple applications',
    middlewares: [logger({ format: 'simple' })],
  };
}

/**
 * Full-featured preset - everything included
 */
export function fullFeaturedPreset(options: any = {}): MiddlewarePreset {
  return {
    name: 'full-featured',
    description: 'Complete middleware stack with all features',
    middlewares: [
      helmet(options.helmet),
      cors(options.cors),
      compression(options.compression),
      json(options.json),
      logger({ format: 'detailed', ...options.logger }),
      requestId(),
      requestTimer(),
    ],
  };
}

export const presets = {
  security: securityPreset,
  api: apiPreset,
  development: developmentPreset,
  production: productionPreset,
  minimal: minimalPreset,
  fullFeatured: fullFeaturedPreset,
};

export const presetNames = Object.keys(presets) as Array<keyof typeof presets>;
