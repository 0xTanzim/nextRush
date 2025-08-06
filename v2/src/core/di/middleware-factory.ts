/**
 * Middleware Factory for NextRush v2
 *
 * Uses DI container to create middleware instances with proper dependency injection.
 * This separates middleware creation from the Application class, following SRP and OCP.
 *
 * @packageDocumentation
 */

import type { DIContainer } from '@/core/di/container';
import { SERVICE_TOKENS } from '@/core/di/container';
import type { Middleware } from '@/types/context';

// Import middleware creation functions
import { compression } from '@/core/middleware/compression';
import { cors } from '@/core/middleware/cors';
import { enhancedBodyParser } from '@/core/middleware/enhanced-body-parser';
import { helmet } from '@/core/middleware/helmet';
import { logger } from '@/core/middleware/logger';
import { rateLimit } from '@/core/middleware/rate-limiter';
import { requestId } from '@/core/middleware/request-id';
import { timer } from '@/core/middleware/timer';

// Import middleware option types
import type { EnhancedBodyParserOptions } from '@/core/middleware/enhanced-body-parser';
import type {
  CompressionOptions,
  CorsOptions,
  HelmetOptions,
  LoggerOptions,
  RateLimiterOptions,
  RequestIdOptions,
  TimerOptions,
} from '@/core/middleware/types';

/**
 * Middleware factory interface
 */
export interface MiddlewareFactory {
  /** Create CORS middleware */
  createCors(options?: CorsOptions): Middleware;

  /** Create Helmet security middleware */
  createHelmet(options?: HelmetOptions): Middleware;

  /** Create JSON body parser middleware */
  createJson(options?: EnhancedBodyParserOptions): Middleware;

  /** Create URL-encoded body parser middleware */
  createUrlencoded(options?: EnhancedBodyParserOptions): Middleware;

  /** Create text body parser middleware */
  createText(options?: EnhancedBodyParserOptions): Middleware;

  /** Create smart body parser middleware */
  createSmartBodyParser(options?: EnhancedBodyParserOptions): Middleware;

  /** Create rate limiter middleware */
  createRateLimit(options?: RateLimiterOptions): Middleware;

  /** Create logger middleware */
  createLogger(options?: LoggerOptions): Middleware;

  /** Create compression middleware */
  createCompression(options?: CompressionOptions): Middleware;

  /** Create request ID middleware */
  createRequestId(options?: RequestIdOptions): Middleware;

  /** Create timer middleware */
  createTimer(options?: TimerOptions): Middleware;
}

/**
 * Default middleware factory implementation using DI container
 */
export class DefaultMiddlewareFactory implements MiddlewareFactory {
  constructor(private container: DIContainer) {}

  /**
   * Create CORS middleware
   */
  createCors(options: CorsOptions = {}): Middleware {
    // Try to resolve from container first, fallback to direct creation
    try {
      const corsFactory = this.container.resolve<
        (options: CorsOptions) => Middleware
      >(SERVICE_TOKENS.CORS_MIDDLEWARE);
      return corsFactory(options);
    } catch {
      return cors(options);
    }
  }

  /**
   * Create Helmet security middleware
   */
  createHelmet(options: HelmetOptions = {}): Middleware {
    try {
      const helmetFactory = this.container.resolve<
        (options: HelmetOptions) => Middleware
      >(SERVICE_TOKENS.HELMET_MIDDLEWARE);
      return helmetFactory(options);
    } catch {
      return helmet(options);
    }
  }

  /**
   * Create JSON body parser middleware
   */
  createJson(options: EnhancedBodyParserOptions = {}): Middleware {
    try {
      const bodyParserFactory = this.container.resolve<
        (options: EnhancedBodyParserOptions) => Middleware
      >(SERVICE_TOKENS.BODY_PARSER_MIDDLEWARE);
      return bodyParserFactory({ ...options, autoDetectContentType: false });
    } catch {
      return enhancedBodyParser({ ...options, autoDetectContentType: false });
    }
  }

  /**
   * Create URL-encoded body parser middleware
   */
  createUrlencoded(options: EnhancedBodyParserOptions = {}): Middleware {
    try {
      const bodyParserFactory = this.container.resolve<
        (options: EnhancedBodyParserOptions) => Middleware
      >(SERVICE_TOKENS.BODY_PARSER_MIDDLEWARE);
      return bodyParserFactory({ ...options, autoDetectContentType: false });
    } catch {
      return enhancedBodyParser({ ...options, autoDetectContentType: false });
    }
  }

  /**
   * Create text body parser middleware
   */
  createText(options: EnhancedBodyParserOptions = {}): Middleware {
    try {
      const bodyParserFactory = this.container.resolve<
        (options: EnhancedBodyParserOptions) => Middleware
      >(SERVICE_TOKENS.BODY_PARSER_MIDDLEWARE);
      return bodyParserFactory({ ...options, autoDetectContentType: false });
    } catch {
      return enhancedBodyParser({ ...options, autoDetectContentType: false });
    }
  }

  /**
   * Create smart body parser middleware
   */
  createSmartBodyParser(options: EnhancedBodyParserOptions = {}): Middleware {
    try {
      const bodyParserFactory = this.container.resolve<
        (options: EnhancedBodyParserOptions) => Middleware
      >(SERVICE_TOKENS.BODY_PARSER_MIDDLEWARE);
      return bodyParserFactory(options);
    } catch {
      return enhancedBodyParser(options);
    }
  }

  /**
   * Create rate limiter middleware
   */
  createRateLimit(options: RateLimiterOptions = {}): Middleware {
    try {
      const rateLimitFactory = this.container.resolve<
        (options: RateLimiterOptions) => Middleware
      >(SERVICE_TOKENS.RATE_LIMITER_MIDDLEWARE);
      return rateLimitFactory(options);
    } catch {
      return rateLimit(options);
    }
  }

  /**
   * Create logger middleware
   */
  createLogger(options: LoggerOptions = {}): Middleware {
    try {
      const loggerFactory = this.container.resolve<
        (options: LoggerOptions) => Middleware
      >(SERVICE_TOKENS.LOGGER);
      return loggerFactory(options);
    } catch {
      return logger(options);
    }
  }

  /**
   * Create compression middleware
   */
  createCompression(options: CompressionOptions = {}): Middleware {
    try {
      const compressionFactory = this.container.resolve<
        (options: CompressionOptions) => Middleware
      >(SERVICE_TOKENS.COMPRESSION_MIDDLEWARE);
      return compressionFactory(options);
    } catch {
      return compression(options);
    }
  }

  /**
   * Create request ID middleware
   */
  createRequestId(options: RequestIdOptions = {}): Middleware {
    return requestId(options);
  }

  /**
   * Create timer middleware
   */
  createTimer(options: TimerOptions = {}): Middleware {
    return timer(options);
  }
}

/**
 * Register default middleware factories with the DI container
 */
export function registerDefaultMiddleware(container: DIContainer): void {
  // Register middleware factories
  container.singleton(SERVICE_TOKENS.CORS_MIDDLEWARE, () => cors);
  container.singleton(SERVICE_TOKENS.HELMET_MIDDLEWARE, () => helmet);
  container.singleton(
    SERVICE_TOKENS.BODY_PARSER_MIDDLEWARE,
    () => enhancedBodyParser
  );
  container.singleton(SERVICE_TOKENS.COMPRESSION_MIDDLEWARE, () => compression);
  container.singleton(SERVICE_TOKENS.RATE_LIMITER_MIDDLEWARE, () => rateLimit);

  // Register middleware factory itself
  container.singleton(
    'MIDDLEWARE_FACTORY',
    (container: DIContainer) => new DefaultMiddlewareFactory(container),
    ['CONTAINER']
  );
}

/**
 * Create a middleware factory instance
 */
export function createMiddlewareFactory(
  container: DIContainer
): MiddlewareFactory {
  return new DefaultMiddlewareFactory(container);
}
