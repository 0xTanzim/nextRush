/**
 * Enhanced error handling and developer experience utilities
 * Provides helpful error messages and development warnings
 */

import { Context, Next } from '@/types/context';

/**
 * Developer-friendly error messages
 */
export const DEV_ERROR_MESSAGES = {
  MIDDLEWARE_ASYNC: `
🚨 Middleware Error: Non-async middleware detected

Your middleware function must be async and await next():

❌ Wrong:
app.use((ctx, next) => {
  console.log('Hello');
  next(); // Missing await
});

✅ Correct:
app.use(async (ctx, next) => {
  console.log('Hello');
  await next();
});
`,

  CONTEXT_MODIFICATION: `
🚨 Context Error: Attempted to modify readonly context property

Context properties are managed by NextRush. Use ctx.state for custom data:

❌ Wrong:
ctx.customProperty = 'value';

✅ Correct:
ctx.state.customProperty = 'value';
`,

  DI_RESOLUTION_FAILED: (serviceName: string) => `
🚨 Dependency Injection Error: Service '${serviceName}' not found

Make sure to register the service before resolving:

✅ Register first:
const container = app.getContainer();
container.register('${serviceName}', ${serviceName}Service);

✅ Then resolve:
const service = container.resolve('${serviceName}');
`,

  ROUTE_HANDLER_ERROR: `
🚨 Route Handler Error: Route handler must be async

Route handlers in NextRush v2 must be async functions:

❌ Wrong:
app.get('/users', (ctx) => {
  ctx.res.json({ users: [] });
});

✅ Correct:
app.get('/users', async (ctx) => {
  ctx.res.json({ users: [] });
});
`,

  BODY_PARSER_ERROR: `
🚨 Body Parser Error: Request body parsing failed

Common causes and solutions:

1. Content-Type mismatch:
   ✅ Ensure client sends correct Content-Type header

2. Body size limit exceeded:
   ✅ Increase maxSize in bodyParser options

3. Invalid JSON:
   ✅ Validate JSON on client side before sending
`,

  CORS_CONFIGURATION: `
🚨 CORS Configuration Warning: Insecure CORS settings detected

Current setting allows all origins. For production, specify allowed origins:

❌ Development only:
app.use(cors({ origin: true }));

✅ Production ready:
app.use(cors({
  origin: ['https://yourdomain.com', 'https://app.yourdomain.com'],
  credentials: true
}));
`,

  PERFORMANCE_WARNING: (responseTime: number) => `
⚠️  Performance Warning: Slow response detected (${responseTime}ms)

Consider these optimizations:

1. Database query optimization
2. Caching frequently accessed data
3. Using async/await properly
4. Avoiding synchronous operations in handlers
`,

  MEMORY_WARNING: (memoryUsage: number) => `
⚠️  Memory Warning: High memory usage detected (${memoryUsage}MB)

Consider these optimizations:

1. Implement proper cleanup in middleware
2. Use streaming for large responses
3. Enable garbage collection optimization
4. Check for memory leaks
`,
} as const;

/**
 * CORS configuration options interface
 */
interface CorsOptions {
  origin?: boolean | string | string[];
  credentials?: boolean;
}

/**
 * Development warning system
 */
export class DevWarningSystem {
  private static warnings = new Set<string>();
  private static isDevelopment = process.env['NODE_ENV'] !== 'production';

  /**
   * Show warning once per process
   */
  static warnOnce(key: string, message: string): void {
    if (!this.isDevelopment || this.warnings.has(key)) return;

    this.warnings.add(key);
    // eslint-disable-next-line no-console
    console.warn(`\n${message}\n`);
  }

  /**
   * Check for common developer mistakes
   */
  static checkMiddleware(middleware: (...args: unknown[]) => unknown): void {
    if (!this.isDevelopment) return;

    const middlewareStr = middleware.toString();

    // Check if middleware is async
    if (
      !middlewareStr.startsWith('async') &&
      !middlewareStr.includes('Promise')
    ) {
      this.warnOnce('middleware-async', DEV_ERROR_MESSAGES.MIDDLEWARE_ASYNC);
    }

    // Check if next() is awaited
    if (
      middlewareStr.includes('next()') &&
      !middlewareStr.includes('await next()')
    ) {
      this.warnOnce('middleware-next', DEV_ERROR_MESSAGES.MIDDLEWARE_ASYNC);
    }
  }

  /**
   * Check CORS configuration security
   */
  static checkCorsConfig(options: CorsOptions): void {
    if (!this.isDevelopment) return;

    if (options.origin === true || options.origin === '*') {
      this.warnOnce('cors-security', DEV_ERROR_MESSAGES.CORS_CONFIGURATION);
    }
  }

  /**
   * Check for performance issues
   */
  static checkPerformance(ctx: Context, responseTime: number): void {
    if (!this.isDevelopment) return;

    // Warn about slow responses
    if (responseTime > 100) {
      this.warnOnce(
        `perf-${ctx.path}`,
        DEV_ERROR_MESSAGES.PERFORMANCE_WARNING(responseTime)
      );
    }
  }

  /**
   * Check for memory usage issues
   */
  static checkMemoryUsage(): void {
    if (!this.isDevelopment) return;

    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);

    if (heapUsedMB > 100) {
      this.warnOnce(
        'memory-usage',
        DEV_ERROR_MESSAGES.MEMORY_WARNING(heapUsedMB)
      );
    }
  }
}

/**
 * Enhanced error class with developer-friendly messages
 */
export class NextRushError extends Error {
  public code: string;
  public statusCode: number;
  public originalError?: Error | undefined;
  public suggestions: string[];

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    suggestions: string[] = [],
    originalError?: Error
  ) {
    super(message);
    this.name = 'NextRushError';
    this.code = code;
    this.statusCode = statusCode;
    this.suggestions = suggestions;
    this.originalError = originalError;

    // Ensure stack trace points to the original error location
    if (originalError?.stack) {
      this.stack = originalError.stack;
    }
  }

  /**
   * Create a developer-friendly error message
   */
  toDeveloperString(): string {
    let msg = `\n🚨 ${this.name}: ${this.message}\n`;
    msg += `Code: ${this.code}\n`;
    msg += `Status: ${this.statusCode}\n`;

    if (this.suggestions.length > 0) {
      msg += '\n💡 Suggestions:\n';
      this.suggestions.forEach((suggestion, index) => {
        msg += `${index + 1}. ${suggestion}\n`;
      });
    }

    if (this.originalError) {
      msg += `\nOriginal Error: ${this.originalError.message}\n`;
    }

    return msg;
  }
}

/**
 * Middleware error with specific handling suggestions
 */
export class MiddlewareError extends NextRushError {
  constructor(message: string, middlewareName?: string, originalError?: Error) {
    const suggestions = [
      'Ensure middleware function is async',
      'Use await next() to call the next middleware',
      'Handle errors with try/catch blocks',
      'Check middleware order and dependencies',
    ];

    super(
      `Middleware error${middlewareName ? ` in ${middlewareName}` : ''}: ${message}`,
      'MIDDLEWARE_ERROR',
      500,
      suggestions,
      originalError
    );
  }
}

/**
 * Route handler error with specific suggestions
 */
export class RouteHandlerError extends NextRushError {
  constructor(path: string, method: string, originalError: Error) {
    const suggestions = [
      'Ensure route handler is async',
      'Handle database errors appropriately',
      'Validate request parameters and body',
      'Use proper HTTP status codes',
    ];

    super(
      `Route handler error for ${method.toUpperCase()} ${path}: ${originalError.message}`,
      'ROUTE_HANDLER_ERROR',
      500,
      suggestions,
      originalError
    );
  }
}

/**
 * DI container error with registration suggestions
 */
export class DIError extends NextRushError {
  constructor(serviceName: string, operation: string, originalError?: Error) {
    const suggestions = [
      `Register the service: container.register('${serviceName}', ${serviceName}Service)`,
      'Check service name spelling and case sensitivity',
      'Ensure service is registered before resolution',
      'Verify circular dependency chains',
    ];

    super(
      `DI Container error during ${operation} of '${serviceName}': ${originalError?.message || 'Unknown error'}`,
      'DI_ERROR',
      500,
      suggestions,
      originalError
    );
  }
}

/**
 * Body parser error with parsing suggestions
 */
export class BodyParserError extends NextRushError {
  constructor(contentType: string, originalError: Error) {
    const suggestions = [
      'Verify Content-Type header matches request body',
      'Check request body size limits',
      'Validate JSON structure before sending',
      'Ensure proper character encoding',
    ];

    super(
      `Body parsing error for ${contentType}: ${originalError.message}`,
      'BODY_PARSER_ERROR',
      400,
      suggestions,
      originalError
    );
  }
}

/**
 * Context validation error
 */
export class ContextError extends NextRushError {
  constructor(property: string, operation: string) {
    const suggestions = [
      'Use ctx.state for custom properties',
      'Check property name spelling',
      'Ensure property is available in current middleware',
      'Review context documentation',
    ];

    super(
      `Context error: Cannot ${operation} property '${property}'`,
      'CONTEXT_ERROR',
      500,
      suggestions
    );
  }
}

/**
 * Enhanced error with status information
 */
interface ErrorWithStatus extends Error {
  statusCode?: number;
  status?: number;
}

/**
 * Enhanced error handler middleware
 */
export function createErrorHandler(
  options: {
    showStackTrace?: boolean;
    logErrors?: boolean;
    customErrorPages?: Record<number, string>;
  } = {}
) {
  const {
    showStackTrace = process.env['NODE_ENV'] === 'development',
    logErrors = true,
  } = options;

  return async (ctx: Context, next: Next) => {
    try {
      await next();
    } catch (error: unknown) {
      const err = error as ErrorWithStatus;

      // Log error if enabled
      if (logErrors) {
        if (error instanceof NextRushError) {
          // eslint-disable-next-line no-console
          console.error(error.toDeveloperString());
        } else {
          // eslint-disable-next-line no-console
          console.error('Unhandled error:', error);
        }
      }

      // Set response status and body
      if (error instanceof NextRushError) {
        ctx.status = error.statusCode;
        ctx.body = {
          error: error.message,
          code: error.code,
          ...(showStackTrace && {
            stack: error.stack,
            suggestions: error.suggestions,
          }),
        };
      } else {
        ctx.status = err.statusCode || err.status || 500;
        ctx.body = {
          error: err.message || 'Internal server error',
          ...(showStackTrace && { stack: err.stack }),
        };
      }
    }
  };
}

/**
 * Development middleware for helpful warnings
 */
export function createDevelopmentMiddleware() {
  if (process.env['NODE_ENV'] === 'production') {
    return async (_ctx: Context, next: Next) => {
      await next();
    };
  }

  return async (ctx: Context, next: Next) => {
    const start = Date.now();

    await next();

    // Check performance
    const responseTime = Date.now() - start;
    DevWarningSystem.checkPerformance(ctx, responseTime);

    // Check memory usage periodically
    if (Math.random() < 0.01) {
      // 1% chance
      DevWarningSystem.checkMemoryUsage();
    }
  };
}

/**
 * Debugging helper for context inspection
 */
export function debugContext(ctx: Context): void {
  if (process.env['NODE_ENV'] === 'production') return;

  // eslint-disable-next-line no-console
  console.log('\n🔍 Context Debug Info:');
  // eslint-disable-next-line no-console
  console.log('─'.repeat(40));
  // eslint-disable-next-line no-console
  console.log(`Method: ${ctx.method}`);
  // eslint-disable-next-line no-console
  console.log(`Path: ${ctx.path}`);
  // eslint-disable-next-line no-console
  console.log(`Status: ${ctx.status}`);
  // eslint-disable-next-line no-console
  console.log(`Headers:`, ctx.headers);
  // eslint-disable-next-line no-console
  console.log(`Query:`, ctx.query);
  // eslint-disable-next-line no-console
  console.log(`Params:`, ctx.params);
  // eslint-disable-next-line no-console
  console.log(`Body:`, ctx.body);
  // eslint-disable-next-line no-console
  console.log(`State:`, ctx.state);
  // eslint-disable-next-line no-console
  console.log('─'.repeat(40));
}

/**
 * Type-safe context property getter with helpful errors
 */
export function getContextProperty<T>(
  ctx: Context,
  property: string,
  defaultValue?: T
): T {
  if (!(property in ctx)) {
    throw new ContextError(property, 'access');
  }

  const value = (ctx as unknown as Record<string, unknown>)[property] as T;

  if (value === undefined && defaultValue === undefined) {
    // eslint-disable-next-line no-console
    console.warn(`Warning: Context property '${property}' is undefined`);
  }

  return value ?? (defaultValue as T);
}

/**
 * Middleware validation helper
 */
export function validateMiddleware(middleware: unknown): void {
  if (typeof middleware !== 'function') {
    throw new MiddlewareError('Middleware must be a function');
  }

  if (middleware.length !== 2) {
    throw new MiddlewareError(
      'Middleware must accept exactly 2 parameters (ctx, next)'
    );
  }

  // Additional validation in development
  DevWarningSystem.checkMiddleware(
    middleware as (...args: unknown[]) => unknown
  );
}
