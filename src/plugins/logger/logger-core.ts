/**
 * Core Logger Plugin for NextRush v2
 *
 * @packageDocumentation
 */

import { BasePlugin } from '@/plugins/core/base-plugin';
import { Application } from '@/types/context';
import { ConsoleTransport } from './logger-transports';
import {
  LogLevel,
  type LogEntry,
  type LoggerConfig,
  type Transport,
} from './logger-types';

// Re-export types for convenience
export {
  LogLevel,
  type LogEntry,
  type LoggerConfig,
  type Transport,
} from './logger-types';

export class LoggerPlugin extends BasePlugin {
  public name = 'Logger';
  public version = '1.0.0';

  public override config: LoggerConfig;
  private entries: LogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;
  private _transports: Transport[] = [];
  private eventListeners: Map<string, Array<(entry: LogEntry) => void>> =
    new Map();

  constructor(config: LoggerConfig = {}) {
    super();
    this.config = {
      level: LogLevel.INFO,
      format: 'text',
      timestamp: true,
      colors: true,
      maxEntries: 1000,
      flushInterval: 5000,
      maxMemoryUsage: 50, // 50MB default
      asyncFlush: true, // Enable async flushing by default
      transports: [{ type: 'console' }],
      ...config,
    };

    // Initialize default console transport
    this._transports.push(new ConsoleTransport(this.config.level));
  }

  override onInstall(app: Application): void {
    // Add logger methods to the application
    app.loggerInstance = {
      error: this.error.bind(this),
      warn: this.warn.bind(this),
      info: this.info.bind(this),
      debug: this.debug.bind(this),
      trace: this.trace.bind(this),
      log: this.info.bind(this),
    };

    // Also add a simple alias for better DX
    (app as any).logger = app.loggerInstance;

    // Add logging middleware
    app.use(async (ctx, next) => {
      const startTime = Date.now();
      const requestId = ctx.id || 'unknown';

      this.info(`Request started: ${ctx.req.method} ${ctx.req.url}`, {
        requestId,
        method: ctx.req.method,
        url: ctx.req.url,
        userAgent: ctx.req.headers['user-agent'],
        ip: ctx.ip,
      });

      try {
        await next();
      } catch (error) {
        this.error('Request failed', {
          requestId,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime,
        });
        throw error;
      }

      this.info(`Request completed: ${ctx.res.statusCode}`, {
        requestId,
        statusCode: ctx.res.statusCode,
        duration: Date.now() - startTime,
      });
    });

    // Start flush timer
    this.startFlushTimer();

    this.isInstalled = true;
    this.log('Logger plugin installed');
  }

  private startFlushTimer(): void {
    if (this.config.flushInterval && this.config.flushInterval > 0) {
      this.flushTimer = setInterval(() => {
        this.flush();
      }, this.config.flushInterval);
    }
  }

  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined as any;
    }
  }

  private addEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context: context || {},
    };

    this.entries.push(entry);

    // Check memory usage and flush if necessary
    this.checkMemoryUsage();

    // Limit entries
    if (this.entries.length > this.config.maxEntries!) {
      this.entries = this.entries.slice(-this.config.maxEntries!);
    }

    // Immediate write for error and warn levels (don't remove from entries)
    if (level <= LogLevel.WARN) {
      this.writeToTransports();
    }
  }

  /**
   * Check memory usage and flush if necessary
   */
  private checkMemoryUsage(): void {
    if (!this.config.maxMemoryUsage) {
      return;
    }

    const memoryUsage = process.memoryUsage();
    const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;

    if (heapUsedMB > this.config.maxMemoryUsage) {
      // Force flush to free memory
      this.flush();

      // If still over limit, clear some entries
      if (this.entries.length > this.config.maxEntries! / 2) {
        this.entries = this.entries.slice(-this.config.maxEntries! / 2);
      }
    }
  }

  private flush(): void {
    if (this.entries.length === 0) {
      return;
    }

    const entriesToFlush = [...this.entries];

    if (this.config.asyncFlush) {
      // Async flush to prevent blocking
      setImmediate(() => {
        this._transports.forEach(transport => {
          this.writeToTransport(transport, entriesToFlush);
        });
        // Clear entries after writing
        if (this.entries.length === entriesToFlush.length) {
          this.entries = [];
        }
      });
    } else {
      // Synchronous flush
      this._transports.forEach(transport => {
        this.writeToTransport(transport, entriesToFlush);
      });
      // Clear entries after writing
      this.entries = [];
    }
  }

  private writeToTransport(transport: Transport, entries: LogEntry[]): void {
    try {
      entries.forEach(entry => {
        const result = transport.write(entry);
        if (result instanceof Promise) {
          result.catch(error => {
            console.error(
              `Failed to write to transport ${transport.name}:`,
              error
            );
          });
        }
      });
    } catch (error) {
      console.error(`Failed to write to transport ${transport.name}:`, error);
    }
  }

  /**
   * Write latest entry to all transports
   */
  private writeToTransports(): void {
    if (this.entries.length === 0) {
      return;
    }

    const latestEntry = this.entries[this.entries.length - 1];

    this._transports.forEach(transport => {
      try {
        if (latestEntry) {
          const result = transport.write(latestEntry);
          if (result instanceof Promise) {
            result.catch(error => {
              console.error('Transport error:', error);
            });
          }
        }
      } catch (error) {
        console.error('Transport error error:', error);
      }
    });
  }

  // Public logging methods
  error(message: string, context?: Record<string, unknown>): void {
    if (LogLevel.ERROR <= this.config.level!) {
      this.addEntry(LogLevel.ERROR, message, context);
    }
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (LogLevel.WARN <= this.config.level!) {
      this.addEntry(LogLevel.WARN, message, context);
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (LogLevel.INFO <= this.config.level!) {
      this.addEntry(LogLevel.INFO, message, context);
      this.writeToTransports();
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (LogLevel.DEBUG <= this.config.level!) {
      this.addEntry(LogLevel.DEBUG, message, context);
      this.writeToTransports();
    }
  }

  trace(message: string, context?: Record<string, unknown>): void {
    if (LogLevel.TRACE <= this.config.level!) {
      this.addEntry(LogLevel.TRACE, message, context);
      this.writeToTransports();
    }
  }

  override log(message: string, context?: Record<string, unknown>): void {
    this.info(message, context);
  }

  // Utility methods
  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
  }

  setLevel(level: LogLevel | string): void {
    const logLevel =
      typeof level === 'string'
        ? LogLevel[level.toUpperCase() as keyof typeof LogLevel]
        : level;
    this.config.level = logLevel;
    this._transports.forEach(transport => {
      if ('level' in transport) {
        const transportLevel =
          typeof level === 'string'
            ? level.toLowerCase()
            : LogLevel[logLevel].toLowerCase();
        (transport as any).level = transportLevel;
      }
    });
  }

  /**
   * Add a transport
   */
  addTransport(transport: Transport): void {
    this._transports.push(transport);
  }

  /**
   * Remove a transport by name
   */
  removeTransport(name: string): void {
    this._transports = this._transports.filter(t => t.name !== name);
  }

  /**
   * Add event listener
   */
  on(event: string, listener: (entry: LogEntry) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  /**
   * Remove event listener
   */
  off(event: string, listener: (entry: LogEntry) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Log a message (internal method for testing)
   */
  logMessage(
    level: LogLevel | string,
    message: string,
    context?: Record<string, unknown>
  ): void {
    const logLevel =
      typeof level === 'string'
        ? LogLevel[level.toUpperCase() as keyof typeof LogLevel]
        : level;
    this.addEntry(logLevel, message, context);

    // Write to transports to trigger error handling
    this.writeToTransports();

    // Emit event with complete entry data
    const entry = this.entries[this.entries.length - 1];
    if (entry) {
      const eventEntry = {
        ...entry,
        level: typeof level === 'string' ? level : LogLevel[logLevel],
        message: entry.message,
        context: entry.context,
        timestamp: entry.timestamp,
      };
      const listeners = this.eventListeners.get('log');
      if (listeners) {
        listeners.forEach(listener => listener(eventEntry as LogEntry));
      }
    }
  }

  /**
   * Get transports (for testing)
   */
  getTransports(): Transport[] {
    return this._transports;
  }

  /**
   * Get transports property (for testing)
   */
  get transports(): Transport[] {
    return this._transports;
  }

  // Cleanup
  cleanup(): void {
    this.stopFlushTimer();
    this.flush();
    this.entries = [];
  }
}
