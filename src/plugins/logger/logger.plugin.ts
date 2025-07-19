/**
 * 📊 Logger Plugin - NextRush Framework
 *
 * Enterprise-grade logging plugin with multiple transports and middleware support
 */

import { Application } from '../../core/app/application';
import {
  ExpressMiddleware,
  NextRushRequest,
  NextRushResponse,
} from '../../types/express';
import { BasePlugin, PluginRegistry } from '../core/base-plugin';
import { ChildLogger, Logger, LoggerFactory } from './logger';
import {
  LogFormat,
  LoggerOptions,
  LogLevel,
  RequestLogData,
  RequestLoggerOptions,
} from './types';

/**
 * 📊 Logger Plugin - Unified logging system
 */
export class LoggerPlugin extends BasePlugin {
  name = 'Logger';

  private logger: Logger;
  private requestLoggers = new Map<string, ChildLogger>();

  constructor(registry: PluginRegistry) {
    super(registry);

    // Initialize with default logger
    this.logger = LoggerFactory.getDefault();
  }

  /**
   * Install logger capabilities into the application
   */
  install(app: Application): void {
    // Add logger instance to app
    (app as any).logger = this.logger;

    // Install request logging middleware
    this.installRequestLogging(app);

    // Install logger creation methods
    this.installLoggerMethods(app);

    // Add convenience logging methods to app
    this.installConvenienceMethods(app);

    this.emit('logger:installed');
    this.logger.info('Logger plugin installed', { plugin: 'LoggerPlugin' });
  }

  /**
   * Start the logger plugin
   */
  start(): void {
    this.emit('logger:started');
    this.logger.info('Logger plugin started', { plugin: 'LoggerPlugin' });
  }

  /**
   * Stop the logger plugin
   */
  async stop(): Promise<void> {
    this.emit('logger:stopped');
    this.logger.info('Logger plugin stopped', { plugin: 'LoggerPlugin' });

    // Close all transports
    await this.logger.close();
  }

  /**
   * Install request logging middleware
   */
  private installRequestLogging(app: Application): void {
    // Request logger middleware factory
    (app as any).requestLogger = (options: RequestLoggerOptions = {}) => {
      return this.createRequestLoggerMiddleware(options);
    };

    // Auto-install basic request logging
    app.use(
      this.createRequestLoggerMiddleware({
        level: 'info',
        format: process.env.NODE_ENV === 'development' ? 'dev' : 'combined',
      })
    );
  }

  /**
   * Install logger creation methods
   */
  private installLoggerMethods(app: Application): void {
    // Create custom logger
    (app as any).createLogger = (options: LoggerOptions) => {
      return new Logger(options);
    };

    // Get logger for specific component
    (app as any).getLogger = (component: string) => {
      if (!this.requestLoggers.has(component)) {
        const childLogger = this.logger.child({ component });
        this.requestLoggers.set(component, childLogger);
      }
      return this.requestLoggers.get(component)!;
    };

    // Create development logger
    (app as any).createDevLogger = () => {
      return LoggerFactory.createDevelopment();
    };

    // Create production logger
    (app as any).createProdLogger = (
      options: { logFile?: string; httpEndpoint?: string } = {}
    ) => {
      return LoggerFactory.createProduction(options);
    };
  }

  /**
   * Install convenience logging methods
   */
  private installConvenienceMethods(app: Application): void {
    // Direct logging methods
    (app as any).log = {
      debug: (message: string, metadata?: any) =>
        this.logger.debug(message, metadata),
      info: (message: string, metadata?: any) =>
        this.logger.info(message, metadata),
      warn: (message: string, metadata?: any) =>
        this.logger.warn(message, metadata),
      error: (message: string, error?: Error, metadata?: any) =>
        this.logger.error(message, error, metadata),
      fatal: (message: string, error?: Error, metadata?: any) =>
        this.logger.fatal(message, error, metadata),
    };
  }

  /**
   * Create request logger middleware
   */
  private createRequestLoggerMiddleware(
    options: RequestLoggerOptions = {}
  ): ExpressMiddleware {
    const level = options.level || 'info';
    const format = options.format || 'combined';
    const skip = options.skip;
    const immediate = options.immediate || false;
    const colorize =
      options.colorize !== false && process.env.NODE_ENV === 'development';

    return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      // Skip logging if skip function returns true
      if (skip && skip(req, res)) {
        return next();
      }

      const startTime = Date.now();
      const requestId = this.generateRequestId();

      // Enhance request with logger
      (req as any).requestId = requestId;
      (req as any).logger = this.logger.child({ requestId });

      // Log immediate if enabled
      if (immediate) {
        this.logRequest(req, res, { format, level, colorize, duration: 0 });
      }

      // Hook into response.end to calculate duration
      const originalEnd = (res as any).end;
      const self = this;
      (res as any).end = function (
        this: any,
        chunk?: any,
        encoding?: BufferEncoding | (() => void),
        cb?: () => void
      ) {
        const duration = Date.now() - startTime;
        self.logRequest(req, res, { format, level, colorize, duration });

        // Call original end method with proper arguments
        if (typeof encoding === 'function') {
          return originalEnd.call(this, chunk, undefined, encoding);
        }
        return originalEnd.call(this, chunk, encoding, cb);
      };

      next();
    };
  }

  /**
   * Log HTTP request details
   */
  private logRequest(
    req: any,
    res: any,
    options: {
      format?: LogFormat;
      level?: LogLevel;
      colorize?: boolean;
      duration?: number;
    }
  ): void {
    const {
      format = 'simple',
      level = 'info',
      colorize = true,
      duration,
    } = options;

    const logData: RequestLogData = {
      method: req.method || 'UNKNOWN',
      url: req.url || '/',
      status: res.statusCode,
      ...(duration !== undefined && { duration }),
      userAgent: req.headers['user-agent'],
      ip: (req as any).ip || req.connection.remoteAddress,
      requestId: (req as any).requestId,
      timestamp: new Date(),
    };

    const message = this.formatRequestLog(logData, format, colorize);

    // Convert logData to metadata format
    const metadata = {
      ...logData,
      timestamp: logData.timestamp.toISOString(),
    };

    // Use appropriate log level based on status code
    const logLevel = this.getLogLevelFromStatus(res.statusCode || 200);

    switch (logLevel) {
      case 'error':
        this.logger.error(message, undefined, metadata);
        break;
      case 'warn':
        this.logger.warn(message, metadata);
        break;
      default:
        this.logger.info(message, metadata);
    }
  }

  /**
   * Format request log message
   */
  private formatRequestLog(
    data: RequestLogData,
    format: LogFormat,
    colorize: boolean
  ): string {
    const statusColor = colorize ? this.getStatusColor(data.status || 200) : '';
    const resetColor = colorize ? '\x1b[0m' : '';
    const methodColor = colorize ? this.getMethodColor(data.method) : '';

    switch (format) {
      case 'dev':
        return `${methodColor}${data.method}${resetColor} ${data.url} ${statusColor}${data.status}${resetColor} ${data.duration}ms`;

      case 'tiny':
        return `${data.method} ${data.url} ${data.status} ${data.duration}ms`;

      case 'combined':
        return `${data.ip} - ${data.method} ${data.url} ${data.status} ${data.duration}ms "${data.userAgent}"`;

      case 'detailed':
        return `[${data.timestamp.toISOString()}] ${data.requestId} ${
          data.method
        } ${data.url} - ${data.status} - ${data.duration}ms`;

      case 'json':
        return JSON.stringify(data);

      default:
        return `${data.method} ${data.url} ${data.status} ${data.duration}ms`;
    }
  }

  /**
   * Get log level based on HTTP status code
   */
  private getLogLevelFromStatus(status: number): LogLevel {
    if (status >= 500) return 'error';
    if (status >= 400) return 'warn';
    return 'info';
  }

  /**
   * Get status code color for console output
   */
  private getStatusColor(status: number): string {
    if (status >= 500) return '\x1b[31m'; // Red
    if (status >= 400) return '\x1b[33m'; // Yellow
    if (status >= 300) return '\x1b[36m'; // Cyan
    if (status >= 200) return '\x1b[32m'; // Green
    return '\x1b[0m'; // Reset
  }

  /**
   * Get HTTP method color for console output
   */
  private getMethodColor(method: string): string {
    switch (method) {
      case 'GET':
        return '\x1b[32m'; // Green
      case 'POST':
        return '\x1b[34m'; // Blue
      case 'PUT':
        return '\x1b[33m'; // Yellow
      case 'DELETE':
        return '\x1b[31m'; // Red
      case 'PATCH':
        return '\x1b[35m'; // Magenta
      default:
        return '\x1b[0m'; // Reset
    }
  }

  /**
   * Get client IP address
   */
  private getClientIp(req: NextRushRequest): string {
    return (
      (req.headers['x-forwarded-for'] as string) ||
      (req.headers['x-real-ip'] as string) ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get the main logger instance
   */
  public getLogger(): Logger {
    return this.logger;
  }

  /**
   * Set a new logger instance
   */
  public setLogger(logger: Logger): void {
    this.logger = logger;
  }

  /**
   * Create logger for specific component
   */
  public createComponentLogger(component: string): ChildLogger {
    return this.logger.child({ component });
  }
}

// Export transport classes for easy access
export {
  ConsoleTransport,
  CustomTransport,
  FileTransport,
  HttpTransport,
} from './transports';

export { ChildLogger, Logger, LoggerFactory } from './logger';

export * from './types';
