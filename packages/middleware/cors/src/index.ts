/**
 * @nextrush/cors - CORS Middleware
 *
 * Cross-Origin Resource Sharing middleware for NextRush.
 *
 * @packageDocumentation
 */

/**
 * Minimal context interface for CORS middleware
 */
export interface CorsContext {
  method: string;
  path: string;
  status: number;
  get: (name: string) => string | undefined;
  set: (name: string, value: string) => void;
  send: (data: unknown) => void;
}

/**
 * CORS middleware function type
 */
export type CorsMiddleware = (
  ctx: CorsContext,
  next?: () => Promise<void>
) => Promise<void>;

/**
 * Origin validator function type
 */
export type OriginValidator = (origin: string, ctx: CorsContext) => boolean | string | Promise<boolean | string>;

/**
 * CORS configuration options
 */
export interface CorsOptions {
  /**
   * Configures the Access-Control-Allow-Origin header.
   * - `true`: Reflect the request origin (Access-Control-Allow-Origin: <origin>)
   * - `false`: Disable CORS
   * - `'*'`: Allow any origin
   * - `string`: Specific origin (e.g., 'https://example.com')
   * - `string[]`: Array of allowed origins
   * - `RegExp`: Pattern to match allowed origins
   * - `Function`: Custom validator function
   *
   * @default '*'
   */
  origin?: boolean | string | string[] | RegExp | OriginValidator;

  /**
   * Configures the Access-Control-Allow-Methods header.
   * @default ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE']
   */
  methods?: string | string[];

  /**
   * Configures the Access-Control-Allow-Headers header.
   * If not specified, reflects the Access-Control-Request-Headers header.
   */
  allowedHeaders?: string | string[];

  /**
   * Configures the Access-Control-Expose-Headers header.
   * Headers that browsers are allowed to access.
   */
  exposedHeaders?: string | string[];

  /**
   * Configures the Access-Control-Allow-Credentials header.
   * Set to true to pass the header, otherwise it is omitted.
   * @default false
   */
  credentials?: boolean;

  /**
   * Configures the Access-Control-Max-Age header.
   * Maximum number of seconds the results can be cached.
   */
  maxAge?: number;

  /**
   * Whether to pass the CORS preflight response to the next handler.
   * @default false
   */
  preflightContinue?: boolean;

  /**
   * Provides a status code to use for successful OPTIONS requests.
   * @default 204
   */
  optionsSuccessStatus?: number;
}

const DEFAULT_METHODS = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'];

/**
 * Convert string or array to comma-separated string
 */
function toHeaderValue(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value.join(', ') : value;
}

/**
 * Check if origin matches the allowed origins
 */
async function isOriginAllowed(
  origin: string,
  allowed: CorsOptions['origin'],
  ctx: CorsContext
): Promise<string | false> {
  if (allowed === true) {
    return origin;
  }

  if (allowed === false) {
    return false;
  }

  if (allowed === '*') {
    return '*';
  }

  if (typeof allowed === 'string') {
    return allowed === origin ? origin : false;
  }

  if (Array.isArray(allowed)) {
    return allowed.includes(origin) ? origin : false;
  }

  if (allowed instanceof RegExp) {
    return allowed.test(origin) ? origin : false;
  }

  if (typeof allowed === 'function') {
    const result = await allowed(origin, ctx);
    if (typeof result === 'string') return result;
    return result ? origin : false;
  }

  return false;
}

/**
 * Create CORS middleware
 *
 * @example
 * ```typescript
 * import { createApp } from '@nextrush/core';
 * import { cors } from '@nextrush/cors';
 *
 * const app = createApp();
 *
 * // Allow all origins
 * app.use(cors());
 *
 * // Allow specific origin
 * app.use(cors({ origin: 'https://example.com' }));
 *
 * // Allow multiple origins
 * app.use(cors({
 *   origin: ['https://app.example.com', 'https://admin.example.com'],
 *   credentials: true,
 * }));
 *
 * // Dynamic origin validation
 * app.use(cors({
 *   origin: (origin, ctx) => {
 *     return origin.endsWith('.example.com');
 *   },
 * }));
 * ```
 */
export function cors(options: CorsOptions = {}): CorsMiddleware {
  const {
    origin: allowedOrigin = '*',
    methods = DEFAULT_METHODS,
    allowedHeaders,
    exposedHeaders,
    credentials = false,
    maxAge,
    preflightContinue = false,
    optionsSuccessStatus = 204,
  } = options;

  const methodsValue = toHeaderValue(methods);
  const allowedHeadersValue = toHeaderValue(allowedHeaders);
  const exposedHeadersValue = toHeaderValue(exposedHeaders);

  return async (ctx: CorsContext, next?: () => Promise<void>): Promise<void> => {
    const origin = ctx.get('origin');

    // No origin header means same-origin or non-browser request
    if (!origin) {
      if (next) await next();
      return;
    }

    // Check if origin is allowed
    const allowedOriginValue = await isOriginAllowed(origin, allowedOrigin, ctx);

    if (allowedOriginValue === false) {
      // Origin not allowed - proceed without CORS headers
      if (next) await next();
      return;
    }

    // Set Access-Control-Allow-Origin
    ctx.set('Access-Control-Allow-Origin', allowedOriginValue);

    // Vary by Origin when not using wildcard
    if (allowedOriginValue !== '*') {
      ctx.set('Vary', 'Origin');
    }

    // Set credentials header
    if (credentials) {
      ctx.set('Access-Control-Allow-Credentials', 'true');
    }

    // Set exposed headers
    if (exposedHeadersValue) {
      ctx.set('Access-Control-Expose-Headers', exposedHeadersValue);
    }

    // Handle preflight request
    if (ctx.method === 'OPTIONS') {
      // Set allowed methods
      if (methodsValue) {
        ctx.set('Access-Control-Allow-Methods', methodsValue);
      }

      // Set allowed headers - reflect request headers if not specified
      const requestHeaders = ctx.get('access-control-request-headers');
      if (allowedHeadersValue) {
        ctx.set('Access-Control-Allow-Headers', allowedHeadersValue);
      } else if (requestHeaders) {
        ctx.set('Access-Control-Allow-Headers', requestHeaders);
        // Add Vary for request headers
        const vary = ctx.get('vary');
        const varyHeaders = vary ? `${vary}, Access-Control-Request-Headers` : 'Origin, Access-Control-Request-Headers';
        ctx.set('Vary', varyHeaders);
      }

      // Set max age
      if (maxAge !== undefined) {
        ctx.set('Access-Control-Max-Age', String(maxAge));
      }

      // Respond to preflight
      if (!preflightContinue) {
        ctx.status = optionsSuccessStatus;
        ctx.send('');
        return;
      }
    }

    // Continue to next middleware
    if (next) await next();
  };
}

/**
 * Simple CORS middleware that allows all origins
 *
 * @example
 * ```typescript
 * app.use(simpleCors());
 * ```
 */
export function simpleCors(): CorsMiddleware {
  return cors({ origin: '*' });
}

/**
 * Strict CORS middleware for production
 *
 * @example
 * ```typescript
 * app.use(strictCors({
 *   origin: 'https://myapp.com',
 *   credentials: true,
 * }));
 * ```
 */
export function strictCors(options: Omit<CorsOptions, 'origin'> & { origin: string | string[] }): CorsMiddleware {
  return cors({
    ...options,
    credentials: options.credentials ?? true,
    maxAge: options.maxAge ?? 86400, // 24 hours
  });
}

// Default export for convenience
export default cors;
