/**
 * 🔥 Optimized Custom Error Classes for NextRush Framework
 * Zero memory leaks, performance-optimized, enterprise-grade error handling
 */

// 🚀 Error severity levels for better categorization
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// 🚀 Error category for better organization
export enum ErrorCategory {
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  NETWORK = 'network',
  DATABASE = 'database',
  FILESYSTEM = 'filesystem',
  BUSINESS_LOGIC = 'business_logic',
  SYSTEM = 'system',
  EXTERNAL_SERVICE = 'external_service',
}

/**
 * 🔥 High-Performance Base Error Class
 * - Memory-optimized with object pooling
 * - Conditional stack capture for performance
 * - Immutable properties for thread safety
 * - Rich metadata for debugging
 */
export abstract class NextRushError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details: Readonly<Record<string, unknown>>;
  public readonly timestamp: number; // Use timestamp for performance
  public readonly severity: ErrorSeverity;
  public readonly category: ErrorCategory;
  public readonly correlationId?: string;
  public readonly retryable: boolean;

  // 🚀 Static error pool for memory optimization
  private static readonly errorPool = new Map<string, NextRushError>();
  private static readonly maxPoolSize = 1000;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    details?: Record<string, unknown>,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    category: ErrorCategory = ErrorCategory.SYSTEM,
    retryable: boolean = false,
    correlationId?: string
  ) {
    super(message);

    // 🚀 Performance: Use constructor name directly
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;

    // 🚀 Memory optimization: Freeze details to prevent mutations
    this.details = Object.freeze(details ?? {});
    this.timestamp = Date.now(); // Use timestamp for better performance
    this.severity = severity;
    this.category = category;
    this.retryable = retryable;
    this.correlationId = correlationId || this.generateCorrelationId();

    // 🚀 Conditional stack capture - only in development or for critical errors
    if (this.shouldCaptureStack()) {
      Error.captureStackTrace?.(this, this.constructor);
    }
  }

  /**
   * 🚀 High-performance JSON serialization
   */
  toJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
      severity: this.severity,
      category: this.category,
      retryable: this.retryable,
      correlationId: this.correlationId,
    };

    // 🚀 Only include stack in development or critical errors
    if (this.shouldIncludeStack()) {
      result.stack = this.stack;
    }

    return result;
  }

  /**
   * 🚀 Smart stack capture decision
   */
  private shouldCaptureStack(): boolean {
    return (
      process.env.NODE_ENV !== 'production' ||
      this.severity === ErrorSeverity.CRITICAL ||
      this.statusCode >= 500
    );
  }

  /**
   * 🚀 Smart stack inclusion decision
   */
  private shouldIncludeStack(): boolean {
    return (
      process.env.NODE_ENV === 'development' ||
      this.severity === ErrorSeverity.CRITICAL
    );
  }

  /**
   * 🚀 Generate correlation ID for error tracking
   */
  private generateCorrelationId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 🚀 Static factory method with error pooling
   */
  static create<T extends NextRushError>(
    this: new (...args: any[]) => T,
    ...args: any[]
  ): T {
    const key = `${this.name}_${args.join('_')}`;

    if (
      NextRushError.errorPool.has(key) &&
      NextRushError.errorPool.size < NextRushError.maxPoolSize
    ) {
      return NextRushError.errorPool.get(key) as T;
    }

    const error = new this(...args);

    if (NextRushError.errorPool.size < NextRushError.maxPoolSize) {
      NextRushError.errorPool.set(key, error);
    }

    return error;
  }

  /**
   * 🚀 Check if error is retryable
   */
  isRetryable(): boolean {
    return this.retryable;
  }

  /**
   * 🚀 Check if error is critical
   */
  isCritical(): boolean {
    return this.severity === ErrorSeverity.CRITICAL;
  }

  /**
   * 🚀 Get user-friendly message (sanitized for production)
   */
  getUserMessage(): string {
    if (process.env.NODE_ENV === 'production' && this.statusCode >= 500) {
      return 'An internal error occurred. Please try again later.';
    }
    return this.message;
  }
}

// 🔥 OPTIMIZED SPECIFIC ERROR CLASSES

/**
 * 🚀 Client Errors (4xx)
 */
export class ValidationError extends NextRushError {
  constructor(
    message: string,
    details?: Record<string, unknown>,
    correlationId?: string
  ) {
    super(
      message,
      'VALIDATION_ERROR',
      400,
      details,
      ErrorSeverity.LOW,
      ErrorCategory.VALIDATION,
      false, // Not retryable
      correlationId
    );
  }

  static field(
    fieldName: string,
    value: unknown,
    expected: string,
    correlationId?: string
  ): ValidationError {
    return new ValidationError(
      `Invalid field '${fieldName}': expected ${expected}`,
      { field: fieldName, value, expected },
      correlationId
    );
  }

  static schema(
    errors: Array<{ field: string; message: string }>,
    correlationId?: string
  ): ValidationError {
    return new ValidationError(
      'Schema validation failed',
      { errors, count: errors.length },
      correlationId
    );
  }
}

export class NotFoundError extends NextRushError {
  constructor(
    resource: string = 'Resource',
    identifier?: string | number,
    correlationId?: string
  ) {
    super(
      `${resource} not found${identifier ? ` (ID: ${identifier})` : ''}`,
      'NOT_FOUND',
      404,
      { resource, identifier },
      ErrorSeverity.LOW,
      ErrorCategory.BUSINESS_LOGIC,
      false,
      correlationId
    );
  }
}

export class UnauthorizedError extends NextRushError {
  constructor(
    message: string = 'Authentication required',
    correlationId?: string
  ) {
    super(
      message,
      'UNAUTHORIZED',
      401,
      {},
      ErrorSeverity.MEDIUM,
      ErrorCategory.AUTHENTICATION,
      false,
      correlationId
    );
  }
}

export class ForbiddenError extends NextRushError {
  constructor(resource?: string, action?: string, correlationId?: string) {
    const message =
      resource && action
        ? `Forbidden: Cannot ${action} ${resource}`
        : 'Access forbidden';

    super(
      message,
      'FORBIDDEN',
      403,
      { resource, action },
      ErrorSeverity.MEDIUM,
      ErrorCategory.AUTHORIZATION,
      false,
      correlationId
    );
  }
}

export class MethodNotAllowedError extends NextRushError {
  constructor(
    method: string,
    allowedMethods: string[] = [],
    correlationId?: string
  ) {
    super(
      `Method ${method} not allowed`,
      'METHOD_NOT_ALLOWED',
      405,
      { method, allowedMethods },
      ErrorSeverity.LOW,
      ErrorCategory.NETWORK,
      false,
      correlationId
    );
  }
}

export class ConflictError extends NextRushError {
  constructor(message: string, resource?: string, correlationId?: string) {
    super(
      message,
      'CONFLICT',
      409,
      { resource },
      ErrorSeverity.MEDIUM,
      ErrorCategory.BUSINESS_LOGIC,
      false,
      correlationId
    );
  }
}

export class RequestTimeoutError extends NextRushError {
  constructor(timeout: number, correlationId?: string) {
    super(
      `Request timeout after ${timeout}ms`,
      'REQUEST_TIMEOUT',
      408,
      { timeout },
      ErrorSeverity.MEDIUM,
      ErrorCategory.NETWORK,
      true, // Retryable
      correlationId
    );
  }
}

export class PayloadTooLargeError extends NextRushError {
  constructor(maxSize: number, actualSize?: number, correlationId?: string) {
    super(
      `Payload too large. Max: ${maxSize} bytes${
        actualSize ? `, received: ${actualSize} bytes` : ''
      }`,
      'PAYLOAD_TOO_LARGE',
      413,
      { maxSize, actualSize },
      ErrorSeverity.LOW,
      ErrorCategory.VALIDATION,
      false,
      correlationId
    );
  }
}

export class UnsupportedMediaTypeError extends NextRushError {
  constructor(
    contentType: string,
    supportedTypes: string[] = [],
    correlationId?: string
  ) {
    super(
      `Unsupported content type: ${contentType}`,
      'UNSUPPORTED_MEDIA_TYPE',
      415,
      { contentType, supportedTypes },
      ErrorSeverity.LOW,
      ErrorCategory.VALIDATION,
      false,
      correlationId
    );
  }
}

export class TooManyRequestsError extends NextRushError {
  constructor(retryAfter?: number, correlationId?: string) {
    super(
      'Too many requests',
      'TOO_MANY_REQUESTS',
      429,
      { retryAfter },
      ErrorSeverity.MEDIUM,
      ErrorCategory.NETWORK,
      true, // Retryable after delay
      correlationId
    );
  }
}

/**
 * 🚀 Server Errors (5xx)
 */
export class InternalServerError extends NextRushError {
  constructor(
    message: string = 'Internal server error',
    details?: Record<string, unknown>,
    correlationId?: string
  ) {
    super(
      message,
      'INTERNAL_SERVER_ERROR',
      500,
      details,
      ErrorSeverity.HIGH,
      ErrorCategory.SYSTEM,
      true, // May be retryable
      correlationId
    );
  }
}

export class NotImplementedError extends NextRushError {
  constructor(feature: string, correlationId?: string) {
    super(
      `Feature not implemented: ${feature}`,
      'NOT_IMPLEMENTED',
      501,
      { feature },
      ErrorSeverity.MEDIUM,
      ErrorCategory.SYSTEM,
      false,
      correlationId
    );
  }
}

export class BadGatewayError extends NextRushError {
  constructor(service?: string, correlationId?: string) {
    super(
      `Bad gateway${service ? ` from ${service}` : ''}`,
      'BAD_GATEWAY',
      502,
      { service },
      ErrorSeverity.HIGH,
      ErrorCategory.EXTERNAL_SERVICE,
      true, // Retryable
      correlationId
    );
  }
}

export class ServiceUnavailableError extends NextRushError {
  constructor(retryAfter?: number, correlationId?: string) {
    super(
      'Service temporarily unavailable',
      'SERVICE_UNAVAILABLE',
      503,
      { retryAfter },
      ErrorSeverity.HIGH,
      ErrorCategory.SYSTEM,
      true, // Retryable
      correlationId
    );
  }
}

export class GatewayTimeoutError extends NextRushError {
  constructor(timeout: number, service?: string, correlationId?: string) {
    super(
      `Gateway timeout after ${timeout}ms${service ? ` from ${service}` : ''}`,
      'GATEWAY_TIMEOUT',
      504,
      { timeout, service },
      ErrorSeverity.HIGH,
      ErrorCategory.EXTERNAL_SERVICE,
      true, // Retryable
      correlationId
    );
  }
}

/**
 * 🚀 Database-Specific Errors
 */
export class DatabaseError extends NextRushError {
  constructor(
    message: string,
    operation?: string,
    table?: string,
    correlationId?: string
  ) {
    super(
      message,
      'DATABASE_ERROR',
      500,
      { operation, table },
      ErrorSeverity.HIGH,
      ErrorCategory.DATABASE,
      true, // May be retryable
      correlationId
    );
  }
}

export class DatabaseConnectionError extends NextRushError {
  constructor(database: string, host?: string, correlationId?: string) {
    super(
      `Failed to connect to database: ${database}`,
      'DATABASE_CONNECTION_ERROR',
      503,
      { database, host },
      ErrorSeverity.CRITICAL,
      ErrorCategory.DATABASE,
      true, // Retryable
      correlationId
    );
  }
}

/**
 * 🚀 File System Errors
 */
export class FileNotFoundError extends NextRushError {
  constructor(filePath: string, correlationId?: string) {
    super(
      `File not found: ${filePath}`,
      'FILE_NOT_FOUND',
      404,
      { filePath },
      ErrorSeverity.MEDIUM,
      ErrorCategory.FILESYSTEM,
      false,
      correlationId
    );
  }
}

export class FilePermissionError extends NextRushError {
  constructor(filePath: string, operation: string, correlationId?: string) {
    super(
      `Permission denied: Cannot ${operation} file ${filePath}`,
      'FILE_PERMISSION_ERROR',
      403,
      { filePath, operation },
      ErrorSeverity.MEDIUM,
      ErrorCategory.FILESYSTEM,
      false,
      correlationId
    );
  }
}

/**
 * 🚀 Network-Specific Errors
 */
export class NetworkError extends NextRushError {
  constructor(
    message: string,
    host?: string,
    port?: number,
    correlationId?: string
  ) {
    super(
      message,
      'NETWORK_ERROR',
      502,
      { host, port },
      ErrorSeverity.HIGH,
      ErrorCategory.NETWORK,
      true, // Retryable
      correlationId
    );
  }
}

export class ConnectionRefusedError extends NextRushError {
  constructor(host: string, port: number, correlationId?: string) {
    super(
      `Connection refused to ${host}:${port}`,
      'CONNECTION_REFUSED',
      502,
      { host, port },
      ErrorSeverity.HIGH,
      ErrorCategory.NETWORK,
      true, // Retryable
      correlationId
    );
  }
}

/**
 * 🚀 Plugin-Specific Errors
 */
export class PluginError extends NextRushError {
  constructor(
    pluginName: string,
    message: string,
    details?: Record<string, unknown>,
    correlationId?: string
  ) {
    super(
      `Plugin ${pluginName}: ${message}`,
      'PLUGIN_ERROR',
      500,
      { plugin: pluginName, ...details },
      ErrorSeverity.HIGH,
      ErrorCategory.SYSTEM,
      false,
      correlationId
    );
  }
}

export class PluginNotFoundError extends NextRushError {
  constructor(pluginName: string, correlationId?: string) {
    super(
      `Plugin not found: ${pluginName}`,
      'PLUGIN_NOT_FOUND',
      404,
      { plugin: pluginName },
      ErrorSeverity.MEDIUM,
      ErrorCategory.SYSTEM,
      false,
      correlationId
    );
  }
}

/**
 * 🚀 Utility Functions for Error Creation
 */
export class ErrorFactory {
  /**
   * Create error with automatic correlation ID
   */
  static create<T extends NextRushError>(
    ErrorClass: new (...args: any[]) => T,
    ...args: any[]
  ): T {
    return new ErrorClass(...args);
  }

  /**
   * Convert unknown error to NextRushError
   */
  static normalize(error: unknown, correlationId?: string): NextRushError {
    if (error instanceof NextRushError) {
      return error;
    }

    if (error instanceof Error) {
      return new InternalServerError(
        error.message,
        { originalError: error.name, originalStack: error.stack },
        correlationId
      );
    }

    return new InternalServerError(
      'Unknown error occurred',
      { originalError: String(error) },
      correlationId
    );
  }

  /**
   * Check if error is retryable
   */
  static isRetryable(error: Error): boolean {
    return error instanceof NextRushError && error.isRetryable();
  }

  /**
   * Get retry delay for retryable errors
   */
  static getRetryDelay(error: NextRushError, attempt: number = 1): number {
    if (!error.isRetryable()) return 0;

    // Exponential backoff with jitter
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    const jitter = Math.random() * 0.1 * delay; // 10% jitter

    return Math.round(delay + jitter);
  }
}
