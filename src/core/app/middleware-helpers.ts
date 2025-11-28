/**
 * Middleware Factory Helpers for NextRush v2 Application
 *
 * Delegates middleware creation to the DI middleware factory.
 * Follows Facade pattern for cleaner Application API.
 *
 * @packageDocumentation
 */

import type { MiddlewareFactory } from '@/core/di';
import type { EnhancedBodyParserOptions } from '@/core/middleware/body-parser/types';
import type {
  CompressionOptions,
  CorsOptions,
  HelmetOptions,
  LoggerOptions,
  RateLimiterOptions,
  RequestIdOptions,
  TimerOptions,
} from '@/core/middleware/types';
import type { Middleware } from '@/types/context';

/**
 * Interface for middleware factory methods bound to application
 */
export interface MiddlewareHelpers {
  cors(options?: CorsOptions): Middleware;
  helmet(options?: HelmetOptions): Middleware;
  json(options?: EnhancedBodyParserOptions): Middleware;
  urlencoded(options?: EnhancedBodyParserOptions): Middleware;
  text(options?: EnhancedBodyParserOptions): Middleware;
  rateLimit(options?: RateLimiterOptions): Middleware;
  logger(options?: LoggerOptions): Middleware;
  compression(options?: CompressionOptions): Middleware;
  requestId(options?: RequestIdOptions): Middleware;
  timer(options?: TimerOptions): Middleware;
  smartBodyParser(options?: EnhancedBodyParserOptions): Middleware;
}

/**
 * Create middleware helper methods bound to a factory
 *
 * @param factory - MiddlewareFactory instance to bind to
 * @returns Object with middleware creation methods
 */
export function createMiddlewareHelpers(factory: MiddlewareFactory): MiddlewareHelpers {
  return {
    cors: (options: CorsOptions = {}) => factory.createCors(options),
    helmet: (options: HelmetOptions = {}) => factory.createHelmet(options),
    json: (options: EnhancedBodyParserOptions = {}) => factory.createJson(options),
    urlencoded: (options: EnhancedBodyParserOptions = {}) => factory.createUrlencoded(options),
    text: (options: EnhancedBodyParserOptions = {}) => factory.createText(options),
    rateLimit: (options: RateLimiterOptions = {}) => factory.createRateLimit(options),
    logger: (options: LoggerOptions = {}) => factory.createLogger(options),
    compression: (options: CompressionOptions = {}) => factory.createCompression(options),
    requestId: (options: RequestIdOptions = {}) => factory.createRequestId(options),
    timer: (options: TimerOptions = {}) => factory.createTimer(options),
    smartBodyParser: (options: EnhancedBodyParserOptions = {}) => factory.createSmartBodyParser(options),
  };
}

/**
 * Bind middleware factory methods to an application instance
 *
 * @param target - Application instance to bind methods to
 * @param factory - MiddlewareFactory instance providing the implementations
 */
export function bindMiddlewareFactoryMethods(
  target: Record<string, unknown>,
  factory: MiddlewareFactory
): void {
  const helpers = createMiddlewareHelpers(factory);

  target.cors = helpers.cors;
  target.helmet = helpers.helmet;
  target.json = helpers.json;
  target.urlencoded = helpers.urlencoded;
  target.text = helpers.text;
  target.rateLimit = helpers.rateLimit;
  target.logger = helpers.logger;
  target.compression = helpers.compression;
  target.requestId = helpers.requestId;
  target.timer = helpers.timer;
  target.smartBodyParser = helpers.smartBodyParser;
}
