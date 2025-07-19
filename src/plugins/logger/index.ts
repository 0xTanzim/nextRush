/**
 * 📊 Logger Module - NextRush Framework
 *
 * Complete logging solution with transports, middleware, and enterprise features
 */

export { ChildLogger, Logger, LoggerFactory } from './logger';
export { LoggerPlugin } from './logger.plugin';
export {
  ConsoleTransport,
  CustomTransport,
  FileTransport,
  HttpTransport,
} from './transports';
export * from './types';

// Default logger instance for convenience
export { logger } from './logger';
