/**
 * 📊 Logger Core - NextRush Framework
 *
 * High-performance, enterprise-grade logging system with multiple transports
 */

import { ConsoleTransport, FileTransport, HttpTransport } from './transports';
import {
  LOG_LEVELS,
  LogEntry,
  LoggerOptions,
  LogLevel,
  LogMetadata,
  LogTransport,
} from './types';

/**
 * 🚀 Core Logger Class - High-performance logging with multiple transports
 */
export class Logger {
  private level: LogLevel;
  private transports: LogTransport[];
  private silent: boolean;
  private exitOnError: boolean;
  private handleExceptions: boolean;
  private handleRejections: boolean;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level || 'info';
    this.silent = options.silent || false;
    this.exitOnError = options.exitOnError !== false;
    this.handleExceptions = options.handleExceptions || false;
    this.handleRejections = options.handleRejections || false;

    // Initialize with default console transport if none provided
    this.transports = options.transports || [new ConsoleTransport()];

    // Setup global error handling if enabled
    if (this.handleExceptions) {
      this.setupExceptionHandling();
    }

    if (this.handleRejections) {
      this.setupRejectionHandling();
    }
  }

  /**
   * 🐛 Debug level logging
   */
  debug(message: string, metadata: LogMetadata = {}): void {
    this.log('debug', message, metadata);
  }

  /**
   * ℹ️ Info level logging
   */
  info(message: string, metadata: LogMetadata = {}): void {
    this.log('info', message, metadata);
  }

  /**
   * ⚠️ Warning level logging
   */
  warn(message: string, metadata: LogMetadata = {}): void {
    this.log('warn', message, metadata);
  }

  /**
   * ❌ Error level logging
   */
  error(message: string, error?: Error, metadata: LogMetadata = {}): void {
    const meta = error
      ? { ...metadata, error: error.message, stack: error.stack }
      : metadata;
    this.log('error', message, meta);
  }

  /**
   * 💀 Fatal level logging
   */
  fatal(message: string, error?: Error, metadata: LogMetadata = {}): void {
    const meta = error
      ? { ...metadata, error: error.message, stack: error.stack }
      : metadata;
    this.log('fatal', message, meta);

    if (this.exitOnError) {
      process.exit(1);
    }
  }

  /**
   * 📝 Core logging method
   */
  private async log(
    level: LogLevel,
    message: string,
    metadata: LogMetadata = {}
  ): Promise<void> {
    if (this.silent || LOG_LEVELS[level] < LOG_LEVELS[this.level]) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
      },
    };

    // Write to all transports concurrently for performance
    const writePromises = this.transports.map(async (transport) => {
      try {
        await transport.write(entry);
      } catch (error) {
        console.error(`Transport "${transport.name}" failed:`, error);
      }
    });

    await Promise.allSettled(writePromises);
  }

  /**
   * 🔌 Add a transport
   */
  addTransport(transport: LogTransport): void {
    this.transports.push(transport);
  }

  /**
   * 🗑️ Remove a transport
   */
  removeTransport(name: string): boolean {
    const index = this.transports.findIndex((t) => t.name === name);
    if (index > -1) {
      this.transports.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * 📊 Get transport by name
   */
  getTransport(name: string): LogTransport | undefined {
    return this.transports.find((t) => t.name === name);
  }

  /**
   * 📋 List all transports
   */
  listTransports(): LogTransport[] {
    return [...this.transports];
  }

  /**
   * 🔧 Update log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * 📏 Get current log level
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * 🔇 Enable/disable silent mode
   */
  setSilent(silent: boolean): void {
    this.silent = silent;
  }

  /**
   * 🎯 Create child logger with additional metadata
   */
  child(metadata: LogMetadata): ChildLogger {
    return new ChildLogger(this, metadata);
  }

  /**
   * 🏁 Close all transports
   */
  async close(): Promise<void> {
    const closePromises = this.transports.map(async (transport) => {
      if (transport.close) {
        try {
          await transport.close();
        } catch (error) {
          console.error(
            `Failed to close transport "${transport.name}":`,
            error
          );
        }
      }
    });

    await Promise.allSettled(closePromises);
  }

  /**
   * 🚨 Setup global exception handling
   */
  private setupExceptionHandling(): void {
    process.on('uncaughtException', (error) => {
      this.error('Uncaught Exception', error, { type: 'uncaughtException' });
      if (this.exitOnError) {
        process.exit(1);
      }
    });
  }

  /**
   * 🚨 Setup global promise rejection handling
   */
  private setupRejectionHandling(): void {
    process.on('unhandledRejection', (reason, promise) => {
      const error =
        reason instanceof Error ? reason : new Error(String(reason));
      this.error('Unhandled Promise Rejection', error, {
        type: 'unhandledRejection',
        promise: promise.toString(),
      });
    });
  }
}

/**
 * 👶 Child Logger - Logger with pre-configured metadata
 */
export class ChildLogger {
  constructor(private parent: Logger, private defaultMetadata: LogMetadata) {}

  debug(message: string, metadata: LogMetadata = {}): void {
    this.parent.debug(message, { ...this.defaultMetadata, ...metadata });
  }

  info(message: string, metadata: LogMetadata = {}): void {
    this.parent.info(message, { ...this.defaultMetadata, ...metadata });
  }

  warn(message: string, metadata: LogMetadata = {}): void {
    this.parent.warn(message, { ...this.defaultMetadata, ...metadata });
  }

  error(message: string, error?: Error, metadata: LogMetadata = {}): void {
    this.parent.error(message, error, { ...this.defaultMetadata, ...metadata });
  }

  fatal(message: string, error?: Error, metadata: LogMetadata = {}): void {
    this.parent.fatal(message, error, { ...this.defaultMetadata, ...metadata });
  }

  child(metadata: LogMetadata): ChildLogger {
    return new ChildLogger(this.parent, {
      ...this.defaultMetadata,
      ...metadata,
    });
  }
}

/**
 * 🏭 Logger Factory - Create pre-configured loggers
 */
export class LoggerFactory {
  private static defaultLogger: Logger;

  /**
   * Get or create default logger
   */
  static getDefault(): Logger {
    if (!this.defaultLogger) {
      this.defaultLogger = new Logger({
        level: (process.env.LOG_LEVEL as LogLevel) || 'info',
        transports: [
          new ConsoleTransport({
            format: process.env.NODE_ENV === 'development' ? 'simple' : 'json',
            colorize: process.env.NODE_ENV === 'development',
          }),
        ],
        handleExceptions: true,
        handleRejections: true,
      });
    }
    return this.defaultLogger;
  }

  /**
   * Create development logger
   */
  static createDevelopment(): Logger {
    return new Logger({
      level: 'debug',
      transports: [
        new ConsoleTransport({
          format: 'simple',
          colorize: true,
          timestamp: true,
        }),
      ],
    });
  }

  /**
   * Create production logger
   */
  static createProduction(
    options: { logFile?: string; httpEndpoint?: string } = {}
  ): Logger {
    const transports: LogTransport[] = [
      new ConsoleTransport({
        format: 'json',
        colorize: false,
        level: 'info',
      }),
    ];

    if (options.logFile) {
      transports.push(
        new FileTransport({
          filename: options.logFile,
          level: 'info',
          format: 'json',
          maxSize: 50 * 1024 * 1024, // 50MB
          maxFiles: 10,
          rotate: true,
        })
      );
    }

    if (options.httpEndpoint) {
      transports.push(
        new HttpTransport({
          url: options.httpEndpoint,
          level: 'warn',
          format: 'json',
        })
      );
    }

    return new Logger({
      level: 'info',
      transports,
      handleExceptions: true,
      handleRejections: true,
      exitOnError: true,
    });
  }

  /**
   * Create testing logger
   */
  static createTesting(): Logger {
    return new Logger({
      level: 'error',
      silent: process.env.NODE_ENV === 'test',
      transports: [
        new ConsoleTransport({
          format: 'simple',
          colorize: false,
        }),
      ],
    });
  }
}

// Export default logger instance
export const logger = LoggerFactory.getDefault();
