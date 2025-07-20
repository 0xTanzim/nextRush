/**
 * 🔥 CORS Presets - Production-Ready Configurations
 * Optimized CORS configurations for different environments and use cases
 */

import { CorsOptions, CorsPresetType } from './types';

/**
 * 🚀 CORS Presets Factory
 */
export class CorsPresets {
  /**
   * Allow all origins - suitable for public APIs (use with caution)
   */
  static allowAll(): CorsOptions {
    return {
      origin: true,
      credentials: false,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['*'],
      exposedHeaders: ['X-Total-Count', 'X-Request-ID'],
      maxAge: 3600, // 1 hour
      cacheOrigins: false, // No need to cache when allowing all
      enableMetrics: true,
    };
  }

  /**
   * Strict CORS - only specified origins with credentials
   */
  static strict(allowedOrigins: string[]): CorsOptions {
    return {
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['X-Total-Count'],
      maxAge: 86400, // 24 hours
      cacheOrigins: true,
      cacheTtl: 300000, // 5 minutes
      enableMetrics: true,
    };
  }

  /**
   * Development-friendly CORS - very permissive for testing
   */
  static development(): CorsOptions {
    return {
      origin: true,
      credentials: true,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['*'],
      exposedHeaders: [
        'X-Total-Count',
        'X-Request-ID',
        'X-Response-Time',
        'X-Debug-Info',
      ],
      maxAge: 3600, // 1 hour
      cacheOrigins: false, // No caching in development
      enableMetrics: true,
    };
  }

  /**
   * Production-safe CORS with security focus
   */
  static production(allowedOrigins: string[]): CorsOptions {
    return {
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-CSRF-Token',
      ],
      exposedHeaders: ['X-Total-Count', 'X-Request-ID'],
      maxAge: 86400, // 24 hours - aggressive caching for performance
      preflightContinue: false,
      optionsSuccessStatus: 204,
      cacheOrigins: true,
      cacheTtl: 600000, // 10 minutes
      enableMetrics: true,
    };
  }

  /**
   * API-only CORS (no credentials, suitable for public APIs)
   */
  static apiOnly(allowedOrigins?: string[]): CorsOptions {
    return {
      origin: allowedOrigins || true,
      credentials: false,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-API-Key',
        'X-Client-Version',
      ],
      exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
      maxAge: 3600, // 1 hour
      cacheOrigins: Boolean(allowedOrigins),
      cacheTtl: 300000, // 5 minutes
      enableMetrics: true,
    };
  }

  /**
   * Microservice CORS - for service-to-service communication
   */
  static microservice(serviceOrigins: string[]): CorsOptions {
    return {
      origin: serviceOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Service-Token',
        'X-Request-ID',
        'X-Correlation-ID',
        'X-Forwarded-For',
      ],
      exposedHeaders: [
        'X-Request-ID',
        'X-Response-Time',
        'X-Service-Version',
        'X-Rate-Limit-Remaining',
      ],
      maxAge: 7200, // 2 hours - long caching for stable service communication
      cacheOrigins: true,
      cacheTtl: 900000, // 15 minutes
      enableMetrics: true,
    };
  }

  /**
   * WebApp CORS - for traditional web applications
   */
  static webApp(allowedOrigins: string[]): CorsOptions {
    return {
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-CSRF-Token',
        'X-Client-Version',
      ],
      exposedHeaders: ['X-CSRF-Token', 'X-Request-ID'],
      maxAge: 86400, // 24 hours
      preflightContinue: false,
      optionsSuccessStatus: 200, // Some older browsers prefer 200
      cacheOrigins: true,
      cacheTtl: 300000, // 5 minutes
      enableMetrics: true,
    };
  }

  /**
   * SPA (Single Page Application) CORS
   */
  static spa(allowedOrigins: string[]): CorsOptions {
    return {
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Cache-Control',
        'X-Client-Version',
      ],
      exposedHeaders: [
        'X-Total-Count',
        'X-Request-ID',
        'X-Rate-Limit-Remaining',
        'X-Rate-Limit-Reset',
      ],
      maxAge: 43200, // 12 hours
      cacheOrigins: true,
      cacheTtl: 600000, // 10 minutes
      enableMetrics: true,
    };
  }

  /**
   * Get preset by type
   */
  static getPreset(type: CorsPresetType, origins?: string[]): CorsOptions {
    switch (type) {
      case CorsPresetType.ALLOW_ALL:
        return this.allowAll();

      case CorsPresetType.STRICT:
        if (!origins?.length) {
          throw new Error('Strict CORS preset requires origins');
        }
        return this.strict(origins);

      case CorsPresetType.DEVELOPMENT:
        return this.development();

      case CorsPresetType.PRODUCTION:
        if (!origins?.length) {
          throw new Error('Production CORS preset requires origins');
        }
        return this.production(origins);

      case CorsPresetType.API_ONLY:
        return this.apiOnly(origins);

      case CorsPresetType.MICROSERVICE:
        if (!origins?.length) {
          throw new Error('Microservice CORS preset requires origins');
        }
        return this.microservice(origins);

      default:
        throw new Error(`Unknown CORS preset type: ${type}`);
    }
  }

  /**
   * Get environment-based preset
   */
  static getEnvironmentPreset(
    env: string = process.env.NODE_ENV || 'development',
    origins?: string[]
  ): CorsOptions {
    switch (env.toLowerCase()) {
      case 'development':
      case 'dev':
        return this.development();

      case 'test':
      case 'testing':
        return this.allowAll(); // Permissive for testing

      case 'staging':
      case 'stage':
        return origins?.length ? this.strict(origins) : this.development();

      case 'production':
      case 'prod':
        if (!origins?.length) {
          throw new Error('Production environment requires allowed origins');
        }
        return this.production(origins);

      default:
        console.warn(`Unknown environment '${env}', using development preset`);
        return this.development();
    }
  }

  /**
   * Merge multiple CORS options (later options override earlier ones)
   */
  static merge(...optionsArray: CorsOptions[]): CorsOptions {
    return optionsArray.reduce((merged, current) => {
      return {
        ...merged,
        ...current,
      };
    }, {} as CorsOptions);
  }
}
