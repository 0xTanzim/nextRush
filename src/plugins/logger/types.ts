/**
 * 📊 Logger Types - NextRush Framework
 *
 * Comprehensive type definitions for logging system
 */

/**
 * Log levels for different types of messages
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Log output formats
 */
export type LogFormat =
  | 'simple'
  | 'detailed'
  | 'json'
  | 'combined'
  | 'dev'
  | 'tiny';

/**
 * Transport types for log output
 */
export type TransportType = 'console' | 'file' | 'http' | 'custom';

/**
 * Log message metadata
 */
export interface LogMetadata {
  [key: string]: any;
  timestamp?: string;
  requestId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
}

/**
 * Structured log entry
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  metadata: LogMetadata;
  stack?: string;
}

/**
 * HTTP request log data
 */
export interface RequestLogData {
  method: string;
  url: string;
  status?: number;
  duration?: number;
  size?: number;
  userAgent?: string;
  ip?: string;
  requestId?: string;
  timestamp: Date;
}

/**
 * Log transport interface
 */
export interface LogTransport {
  name: string;
  type: TransportType;
  level: LogLevel;
  format: LogFormat;
  write(entry: LogEntry): Promise<void> | void;
  close?(): Promise<void> | void;
}

/**
 * Console transport options
 */
export interface ConsoleTransportOptions {
  level?: LogLevel;
  format?: LogFormat;
  colorize?: boolean;
  timestamp?: boolean;
}

/**
 * File transport options
 */
export interface FileTransportOptions {
  level?: LogLevel;
  format?: LogFormat;
  filename: string;
  maxSize?: number;
  maxFiles?: number;
  rotate?: boolean;
  compress?: boolean;
}

/**
 * HTTP transport options
 */
export interface HttpTransportOptions {
  level?: LogLevel;
  format?: LogFormat;
  url: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  auth?: {
    username: string;
    password: string;
  };
  timeout?: number;
}

/**
 * Custom transport function
 */
export interface CustomTransportFunction {
  (entry: LogEntry): Promise<void> | void;
}

/**
 * Logger configuration options
 */
export interface LoggerOptions {
  level?: LogLevel;
  format?: LogFormat;
  transports?: LogTransport[];
  silent?: boolean;
  exitOnError?: boolean;
  handleExceptions?: boolean;
  handleRejections?: boolean;
}

/**
 * Request logger middleware options
 */
export interface RequestLoggerOptions {
  level?: LogLevel;
  format?: LogFormat;
  skip?: (req: any, res: any) => boolean;
  immediate?: boolean;
  stream?: NodeJS.WritableStream;
  tokens?: Record<string, (req: any, res: any) => string>;
  colorize?: boolean;
}

/**
 * Log level priorities
 */
export const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
} as const;

/**
 * Log level colors for console output
 */
export const LOG_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m', // Green
  warn: '\x1b[33m', // Yellow
  error: '\x1b[31m', // Red
  fatal: '\x1b[35m', // Magenta
} as const;

/**
 * Color reset code
 */
export const COLOR_RESET = '\x1b[0m';

/**
 * Default log formats
 */
export const DEFAULT_FORMATS = {
  simple: '{{timestamp}} [{{level}}] {{message}}',
  detailed:
    '{{timestamp}} [{{level}}] {{requestId}} {{method}} {{url}} - {{message}}',
  json: 'JSON',
  combined:
    '{{ip}} - {{method}} {{url}} {{status}} {{duration}}ms "{{userAgent}}"',
  dev: '{{method}} {{url}} {{status}} {{duration}}ms',
  tiny: '{{method}} {{url}} {{status}} {{duration}}ms',
} as const;
