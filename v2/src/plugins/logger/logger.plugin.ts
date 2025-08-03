/**
 * Advanced Logger Plugin for NextRush v2
 *
 * @packageDocumentation
 */

import { BasePlugin } from '@/plugins/core/base-plugin';
import { Application } from '@/types/context';

// Define log levels
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}

export interface LogEntry {
  timestamp: Date | string;
  level: LogLevel | string;
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
}

export interface LoggerConfig {
  level?: LogLevel;
  format?: 'json' | 'text' | 'simple';
  timestamp?: boolean;
  colors?: boolean;
  maxEntries?: number;
  flushInterval?: number;
  transports?: Array<{
    type: 'console' | 'file' | 'stream';
    options?: Record<string, unknown>;
  }>;
}

export class LoggerPlugin extends BasePlugin {
  public name = 'Logger';
  public version = '1.0.0';

  private config: LoggerConfig;
  private entries: LogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;
  private isInstalled = false;
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
      transports: [{ type: 'console' }],
      ...config,
    };

    // Initialize default console transport
    this._transports.push(new ConsoleTransport(this.config.level));
  }

  onInstall(app: Application): void {
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

    // Limit entries
    if (this.entries.length > this.config.maxEntries!) {
      this.entries = this.entries.slice(-this.config.maxEntries!);
    }

    // Immediate flush for error and warn levels
    if (level <= LogLevel.WARN) {
      this.flush();
    }
  }

  private formatEntry(entry: LogEntry): string {
    const timestamp = this.config.timestamp
      ? (entry.timestamp as Date).toISOString()
      : '';

    const levelStr = LogLevel[entry.level as LogLevel];
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';

    switch (this.config.format) {
      case 'json':
        return JSON.stringify({
          timestamp: (entry.timestamp as Date).toISOString(),
          level: levelStr,
          message: entry.message,
          context: entry.context,
        });

      case 'simple':
        return `${levelStr}: ${entry.message}`;

      default:
        return `${timestamp} [${levelStr}] ${entry.message}${contextStr}`;
    }
  }

  private flush(): void {
    if (this.entries.length === 0) {
      return;
    }

    const entriesToFlush = [...this.entries];
    this.entries = [];

    // Write to all transports
    this._transports.forEach(transport => {
      this.writeToTransport(transport, entriesToFlush);
    });

    this.info('Logger plugin installed');
  }

  private writeToTransport(transport: Transport, entries: LogEntry[]): void {
    try {
      entries.forEach(entry => {
        transport.write(entry);
      });
    } catch (error) {
      console.error(`Failed to write to transport ${transport.name}:`, error);
    }
  }

  private writeToFile(
    options: Record<string, unknown> = {},
    entries: LogEntry[]
  ): void {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const logDir =
      (options.logDir as string) || path.join(process.cwd(), 'logs');
    const filename =
      (options.filename as string) ||
      `app-${new Date().toISOString().split('T')[0]}.log`;
    const logPath = path.join(logDir, filename);

    // Ensure log directory exists
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logContent =
      entries.map(entry => this.formatEntry(entry)).join(os.EOL) + os.EOL;

    fs.appendFileSync(logPath, logContent);
  }

  private writeToStream(
    options: Record<string, unknown> = {},
    entries: LogEntry[]
  ): void {
    const stream = options.stream as NodeJS.WritableStream;
    if (!stream || typeof stream.write !== 'function') {
      console.warn('Invalid stream transport');
      return;
    }

    for (const entry of entries) {
      stream.write(this.formatEntry(entry) + '\n');
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
          transport.write(latestEntry);
        }
      } catch (error) {
        console.error('Transport error error:', error);
      }
    });
  }

  // Public logging methods
  error(message: string, context?: Record<string, unknown>): void {
    this.addEntry(LogLevel.ERROR, message, context);
    this.writeToTransports();
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.addEntry(LogLevel.WARN, message, context);
    this.writeToTransports();
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.addEntry(LogLevel.INFO, message, context);
    this.writeToTransports();
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.addEntry(LogLevel.DEBUG, message, context);
    this.writeToTransports();
  }

  trace(message: string, context?: Record<string, unknown>): void {
    this.addEntry(LogLevel.TRACE, message, context);
    this.writeToTransports();
  }

  log(message: string, context?: Record<string, unknown>): void {
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
      if (
        transport instanceof ConsoleTransport ||
        transport instanceof FileTransport ||
        transport instanceof HttpTransport ||
        transport instanceof StreamTransport
      ) {
        transport.level =
          typeof level === 'string' ? level.toLowerCase() : LogLevel[logLevel].toLowerCase();
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

    // Emit event with string level for compatibility
    const entry = this.entries[this.entries.length - 1];
    const eventEntry = {
      ...entry,
      level: typeof level === 'string' ? level : LogLevel[level],
    };
    const listeners = this.eventListeners.get('log');
    if (listeners) {
      listeners.forEach(listener => listener(eventEntry as LogEntry));
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

/**
 * Transport interface
 */
export interface Transport {
  name: string;
  level: string;
  write(entry: LogEntry): void | Promise<void>;
}

/**
 * Console Transport
 */
export class ConsoleTransport implements Transport {
  public name = 'console';
  private _level: LogLevel;
  private _levelString: string;

  constructor(level: LogLevel | string = LogLevel.INFO) {
    if (typeof level === 'string') {
      this._level = LogLevel[level.toUpperCase() as keyof typeof LogLevel];
      this._levelString = level;
    } else {
      this._level = level;
      this._levelString = LogLevel[level];
    }
  }

  get levelString(): string {
    return this._levelString;
  }

  // For test compatibility
  get level(): string {
    return this._levelString;
  }

  set level(value: LogLevel | string) {
    if (typeof value === 'string') {
      this._level = LogLevel[value.toUpperCase() as keyof typeof LogLevel];
      this._levelString = value;
    } else {
      this._level = value;
      this._levelString = LogLevel[value];
    }
  }

  write(entry: LogEntry): void {
    const level =
      typeof entry.level === 'string'
        ? LogLevel[entry.level.toUpperCase() as keyof typeof LogLevel]
        : entry.level;

    if (level <= this._level) {
      const timestamp =
        typeof entry.timestamp === 'string'
          ? entry.timestamp
          : entry.timestamp.toISOString();
      const levelName =
        typeof entry.level === 'string'
          ? entry.level.toUpperCase()
          : LogLevel[entry.level];
      const message = `${timestamp} [${levelName}] ${entry.message}`;

      switch (level) {
        case LogLevel.ERROR:
          console.error(message);
          break;
        case LogLevel.WARN:
          console.warn(message);
          break;
        case LogLevel.INFO:
          console.info(message);
          break;
        case LogLevel.DEBUG:
          console.log(message);
          break;
        case LogLevel.TRACE:
          console.log(message);
          break;
      }
    }
  }
}

/**
 * File Transport
 */
export class FileTransport implements Transport {
  public name = 'file';
  private _level: LogLevel;
  private filePath: string;
  private _levelString: string;

  constructor(filePath: string, level: LogLevel | string = LogLevel.INFO) {
    this.filePath = filePath;
    if (typeof level === 'string') {
      this._level = LogLevel[level.toUpperCase() as keyof typeof LogLevel];
      this._levelString = level;
    } else {
      this._level = level;
      this._levelString = LogLevel[level];
    }
  }

  get levelString(): string {
    return this._levelString;
  }

  // For test compatibility
  get level(): string {
    return this._levelString;
  }

  set level(value: LogLevel | string) {
    if (typeof value === 'string') {
      this._level = LogLevel[value.toUpperCase() as keyof typeof LogLevel];
      this._levelString = value;
    } else {
      this._level = value;
      this._levelString = LogLevel[value];
    }
  }

  async write(entry: LogEntry): Promise<void> {
    const level =
      typeof entry.level === 'string'
        ? LogLevel[entry.level.toUpperCase() as keyof typeof LogLevel]
        : entry.level;

    if (level <= this._level) {
      const timestamp =
        typeof entry.timestamp === 'string'
          ? entry.timestamp
          : entry.timestamp.toISOString();
      const levelName =
        typeof entry.level === 'string'
          ? entry.level.toUpperCase()
          : LogLevel[entry.level];
      const message = `${timestamp} [${levelName}] ${entry.message}\n`;

      try {
        const fs = await import('node:fs/promises');
        await fs.appendFile(this.filePath, message);
      } catch (error) {
        console.error('Failed to write to log file:', error);
      }
    }
  }
}

/**
 * HTTP Transport
 */
export class HttpTransport implements Transport {
  public name = 'http';
  private _level: LogLevel;
  private url: string;
  private _levelString: string;

  constructor(url: string, level: LogLevel | string = LogLevel.INFO) {
    this.url = url;
    if (typeof level === 'string') {
      this._level = LogLevel[level.toUpperCase() as keyof typeof LogLevel];
      this._levelString = level;
    } else {
      this._level = level;
      this._levelString = LogLevel[level];
    }
  }

  get levelString(): string {
    return this._levelString;
  }

  // For test compatibility
  get level(): string {
    return this._levelString;
  }

  set level(value: LogLevel | string) {
    if (typeof value === 'string') {
      this._level = LogLevel[value.toUpperCase() as keyof typeof LogLevel];
      this._levelString = value;
    } else {
      this._level = value;
      this._levelString = LogLevel[value];
    }
  }

  async write(entry: LogEntry): Promise<void> {
    const level =
      typeof entry.level === 'string'
        ? LogLevel[entry.level.toUpperCase() as keyof typeof LogLevel]
        : entry.level;

    if (level <= this._level) {
      try {
        const response = await fetch(this.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(entry),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        console.error('Failed to send log to HTTP endpoint:', error);
      }
    }
  }
}

/**
 * Stream Transport
 */
export class StreamTransport implements Transport {
  public name = 'stream';
  private _level: LogLevel;
  private stream: NodeJS.WritableStream;
  private _levelString: string;

  constructor(
    stream: NodeJS.WritableStream,
    level: LogLevel | string = LogLevel.INFO
  ) {
    this.stream = stream;
    if (typeof level === 'string') {
      this._level = LogLevel[level.toUpperCase() as keyof typeof LogLevel];
      this._levelString = level;
    } else {
      this._level = level;
      this._levelString = LogLevel[level];
    }
  }

  get levelString(): string {
    return this._levelString;
  }

  // For test compatibility
  get level(): string {
    return this._levelString;
  }

  set level(value: LogLevel | string) {
    if (typeof value === 'string') {
      this._level = LogLevel[value.toUpperCase() as keyof typeof LogLevel];
      this._levelString = value;
    } else {
      this._level = value;
      this._levelString = LogLevel[value];
    }
  }

  write(entry: LogEntry): void {
    const level =
      typeof entry.level === 'string'
        ? LogLevel[entry.level.toUpperCase() as keyof typeof LogLevel]
        : entry.level;

    if (level <= this._level) {
      const timestamp =
        typeof entry.timestamp === 'string'
          ? entry.timestamp
          : entry.timestamp.toISOString();
      const levelName =
        typeof entry.level === 'string'
          ? entry.level.toUpperCase()
          : LogLevel[entry.level];
      const message = `${timestamp} [${levelName}] ${entry.message}\n`;

      this.stream.write(message);
    }
  }
}

/**
 * Create minimal logger for testing
 */
export function createMinimalLogger(): LoggerPlugin {
  return new LoggerPlugin({
    level: LogLevel.INFO,
    format: 'simple',
    timestamp: false,
    colors: false,
    maxEntries: 100,
    flushInterval: 1000,
    transports: [{ type: 'console' }],
  });
}

/**
 * Create development logger
 */
export function createDevLogger(): LoggerPlugin {
  return new LoggerPlugin({
    level: LogLevel.DEBUG,
    format: 'text',
    timestamp: true,
    colors: true,
    maxEntries: 1000,
    flushInterval: 5000,
    transports: [{ type: 'console' }],
  });
}

/**
 * Create production logger
 */
export function createProdLogger(): LoggerPlugin {
  return new LoggerPlugin({
    level: LogLevel.INFO,
    format: 'json',
    timestamp: true,
    colors: false,
    maxEntries: 10000,
    flushInterval: 10000,
    transports: [
      { type: 'console' },
      { type: 'file', options: { path: 'logs/app.log' } },
    ],
  });
}

/**
 * Create test logger
 */
export function createTestLogger(): LoggerPlugin {
  return new LoggerPlugin({
    level: LogLevel.ERROR,
    format: 'simple',
    timestamp: false,
    colors: false,
    maxEntries: 10,
    flushInterval: 100,
    transports: [{ type: 'console' }],
  });
}
