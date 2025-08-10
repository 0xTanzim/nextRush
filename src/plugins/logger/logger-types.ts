/**
 * Logger Types and Interfaces for NextRush v2
 *
 * @packageDocumentation
 */

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

export interface LoggerConfig extends Record<string, unknown> {
  level?: LogLevel;
  format?: 'json' | 'text' | 'simple';
  timestamp?: boolean;
  colors?: boolean;
  maxEntries?: number;
  flushInterval?: number;
  maxMemoryUsage?: number; // Maximum memory usage in MB
  asyncFlush?: boolean; // Use async flushing
  transports?: Array<{
    type: 'console' | 'file' | 'stream';
    options?: Record<string, unknown>;
  }>;
}

/**
 * Transport interface
 */
export interface Transport {
  name: string;
  level: string;
  write(entry: LogEntry): void | Promise<void>;
}
