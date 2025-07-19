/**
 * 🚀 Log Transports - NextRush Framework
 *
 * High-performance transport implementations for different output destinations
 */

import { createWriteStream, existsSync, WriteStream } from 'fs';
import { appendFile, mkdir, stat } from 'fs/promises';
import { dirname } from 'path';
import {
  COLOR_RESET,
  ConsoleTransportOptions,
  FileTransportOptions,
  HttpTransportOptions,
  LOG_COLORS,
  LOG_LEVELS,
  LogEntry,
  LogFormat,
  LogLevel,
  LogTransport,
} from './types';

/**
 * 🖥️ Console Transport - Optimized console logging with colors
 */
export class ConsoleTransport implements LogTransport {
  name = 'console';
  type = 'console' as const;
  level: LogLevel;
  format: LogFormat;
  private colorize: boolean;
  private timestamp: boolean;

  constructor(options: ConsoleTransportOptions = {}) {
    this.level = options.level || 'info';
    this.format = options.format || 'simple';
    this.colorize = options.colorize !== false;
    this.timestamp = options.timestamp !== false;
  }

  write(entry: LogEntry): void {
    if (LOG_LEVELS[entry.level] < LOG_LEVELS[this.level]) {
      return;
    }

    const formatted = this.formatMessage(entry);
    const output = this.colorize
      ? this.colorizeMessage(formatted, entry.level)
      : formatted;

    // Use appropriate console method based on log level
    switch (entry.level) {
      case 'debug':
        console.debug(output);
        break;
      case 'info':
        console.info(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
      case 'fatal':
        console.error(output);
        break;
      default:
        console.log(output);
    }
  }

  private formatMessage(entry: LogEntry): string {
    switch (this.format) {
      case 'json':
        return JSON.stringify({
          timestamp: entry.timestamp.toISOString(),
          level: entry.level,
          message: entry.message,
          ...entry.metadata,
        });

      case 'detailed':
        return `[${entry.timestamp.toISOString()}] [${entry.level.toUpperCase()}] ${
          entry.metadata.requestId || 'N/A'
        } ${entry.metadata.method || ''} ${entry.metadata.url || ''} - ${
          entry.message
        }`;

      case 'simple':
      default:
        const timestamp = this.timestamp
          ? `[${entry.timestamp.toISOString()}] `
          : '';
        return `${timestamp}[${entry.level.toUpperCase()}] ${entry.message}`;
    }
  }

  private colorizeMessage(message: string, level: LogLevel): string {
    if (!this.colorize) return message;
    return `${LOG_COLORS[level]}${message}${COLOR_RESET}`;
  }
}

/**
 * 📁 File Transport - High-performance file logging with rotation
 */
export class FileTransport implements LogTransport {
  name = 'file';
  type = 'file' as const;
  level: LogLevel;
  format: LogFormat;

  private filename: string;
  private maxSize: number;
  private maxFiles: number;
  private rotate: boolean;
  private compress: boolean;
  private writeStream: WriteStream | undefined;
  private currentSize = 0;

  constructor(options: FileTransportOptions) {
    this.level = options.level || 'info';
    this.format = options.format || 'json';
    this.filename = options.filename;
    this.maxSize = options.maxSize || 10 * 1024 * 1024; // 10MB
    this.maxFiles = options.maxFiles || 5;
    this.rotate = options.rotate !== false;
    this.compress = options.compress || false;

    this.initializeFile();
  }

  async write(entry: LogEntry): Promise<void> {
    if (LOG_LEVELS[entry.level] < LOG_LEVELS[this.level]) {
      return;
    }

    const formatted = this.formatMessage(entry);
    const logLine = `${formatted}\n`;

    // Check if we need to rotate
    if (this.rotate && this.currentSize + logLine.length > this.maxSize) {
      await this.rotateFile();
    }

    // Write to file
    if (this.writeStream) {
      this.writeStream.write(logLine);
      this.currentSize += logLine.length;
    } else {
      await appendFile(this.filename, logLine);
    }
  }

  async close(): Promise<void> {
    if (this.writeStream) {
      return new Promise((resolve) => {
        this.writeStream!.end(() => {
          this.writeStream = undefined;
          resolve();
        });
      });
    }
  }

  private async initializeFile(): Promise<void> {
    try {
      // Ensure directory exists
      const dir = dirname(this.filename);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }

      // Get current file size
      try {
        const stats = await stat(this.filename);
        this.currentSize = stats.size;
      } catch {
        this.currentSize = 0;
      }

      // Create write stream for better performance
      this.writeStream = createWriteStream(this.filename, { flags: 'a' });
    } catch (error) {
      console.error('Failed to initialize file transport:', error);
    }
  }

  private async rotateFile(): Promise<void> {
    try {
      // Close current stream
      if (this.writeStream) {
        await this.close();
      }

      // Rotate existing files
      for (let i = this.maxFiles - 1; i > 0; i--) {
        const oldFile = `${this.filename}.${i}`;
        const newFile = `${this.filename}.${i + 1}`;

        if (existsSync(oldFile)) {
          const { rename } = await import('fs/promises');
          await rename(oldFile, newFile);
        }
      }

      // Move current file to .1
      if (existsSync(this.filename)) {
        const { rename } = await import('fs/promises');
        await rename(this.filename, `${this.filename}.1`);
      }

      // Reset size and recreate stream
      this.currentSize = 0;
      this.writeStream = createWriteStream(this.filename, { flags: 'a' });
    } catch (error) {
      console.error('Failed to rotate file:', error);
    }
  }

  private formatMessage(entry: LogEntry): string {
    switch (this.format) {
      case 'json':
        return JSON.stringify({
          timestamp: entry.timestamp.toISOString(),
          level: entry.level,
          message: entry.message,
          ...entry.metadata,
          ...(entry.stack && { stack: entry.stack }),
        });

      case 'detailed':
        return `[${entry.timestamp.toISOString()}] [${entry.level.toUpperCase()}] ${
          entry.metadata.requestId || 'N/A'
        } - ${entry.message}`;

      default:
        return `[${entry.timestamp.toISOString()}] [${entry.level.toUpperCase()}] ${
          entry.message
        }`;
    }
  }
}

/**
 * 🌐 HTTP Transport - Remote logging to external services
 */
export class HttpTransport implements LogTransport {
  name = 'http';
  type = 'http' as const;
  level: LogLevel;
  format: LogFormat;

  private url: string;
  private method: 'POST' | 'PUT';
  private headers: Record<string, string>;
  private auth: { username: string; password: string } | undefined;
  private timeout: number;
  private buffer: LogEntry[] = [];
  private batchSize = 10;
  private flushInterval = 5000; // 5 seconds
  private timer: NodeJS.Timeout | undefined;

  constructor(options: HttpTransportOptions) {
    this.level = options.level || 'info';
    this.format = options.format || 'json';
    this.url = options.url;
    this.method = options.method || 'POST';
    this.headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    this.auth = options.auth;
    this.timeout = options.timeout || 5000;

    // Start periodic flush
    this.timer = setInterval(() => this.flush(), this.flushInterval);
  }

  async write(entry: LogEntry): Promise<void> {
    if (LOG_LEVELS[entry.level] < LOG_LEVELS[this.level]) {
      return;
    }

    this.buffer.push(entry);

    // Flush if buffer is full
    if (this.buffer.length >= this.batchSize) {
      await this.flush();
    }
  }

  async close(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    // Flush remaining logs
    if (this.buffer.length > 0) {
      await this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    try {
      const payload = entries.map((entry) => ({
        timestamp: entry.timestamp.toISOString(),
        level: entry.level,
        message: entry.message,
        ...entry.metadata,
        ...(entry.stack && { stack: entry.stack }),
      }));

      const response = await fetch(this.url, {
        method: this.method,
        headers: this.headers,
        body: JSON.stringify({ logs: payload }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        console.error(
          `HTTP transport failed: ${response.status} ${response.statusText}`
        );
      }
    } catch (error) {
      console.error('Failed to send logs to HTTP transport:', error);
      // Optionally re-queue failed entries
      this.buffer.unshift(...entries);
    }
  }
}

/**
 * 🔧 Custom Transport - User-defined transport function
 */
export class CustomTransport implements LogTransport {
  name: string;
  type = 'custom' as const;
  level: LogLevel;
  format: LogFormat;
  private handler: (entry: LogEntry) => Promise<void> | void;

  constructor(
    name: string,
    handler: (entry: LogEntry) => Promise<void> | void,
    options: { level?: LogLevel; format?: LogFormat } = {}
  ) {
    this.name = name;
    this.level = options.level || 'info';
    this.format = options.format || 'json';
    this.handler = handler;
  }

  async write(entry: LogEntry): Promise<void> {
    if (LOG_LEVELS[entry.level] < LOG_LEVELS[this.level]) {
      return;
    }

    try {
      await this.handler(entry);
    } catch (error) {
      console.error(`Custom transport "${this.name}" failed:`, error);
    }
  }
}
