/**
 * Logger Formatters for NextRush v2
 *
 * @packageDocumentation
 */

import { LogLevel, type LogEntry } from './logger-types';

/**
 * Formatter interface
 */
export interface Formatter {
  format(entry: LogEntry): string;
}

/**
 * JSON Formatter
 */
export class JsonFormatter implements Formatter {
  format(entry: LogEntry): string {
    return JSON.stringify({
      timestamp:
        typeof entry.timestamp === 'string'
          ? entry.timestamp
          : entry.timestamp.toISOString(),
      level:
        typeof entry.level === 'string' ? entry.level : LogLevel[entry.level],
      message: entry.message,
      context: entry.context,
      error: entry.error
        ? {
            name: entry.error.name,
            message: entry.error.message,
            stack: entry.error.stack,
          }
        : undefined,
    });
  }
}

/**
 * Text Formatter
 */
export class TextFormatter implements Formatter {
  constructor(
    private options: {
      timestamp?: boolean;
      colors?: boolean;
    } = {}
  ) {}

  format(entry: LogEntry): string {
    const timestamp =
      typeof entry.timestamp === 'string'
        ? entry.timestamp
        : entry.timestamp.toISOString();

    const level =
      typeof entry.level === 'string'
        ? entry.level.toUpperCase()
        : LogLevel[entry.level];

    let formatted = '';

    if (this.options.timestamp) {
      formatted += `${timestamp} `;
    }

    if (this.options.colors) {
      formatted += this.colorizeLevel(level);
    } else {
      formatted += `[${level}]`;
    }

    formatted += ` ${entry.message}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
      formatted += ` ${JSON.stringify(entry.context)}`;
    }

    if (entry.error) {
      formatted += ` Error: ${entry.error.message}`;
      if (entry.error.stack) {
        formatted += `\n${entry.error.stack}`;
      }
    }

    return formatted;
  }

  private colorizeLevel(level: string): string {
    const colors = {
      ERROR: '\x1b[31m[ERROR]\x1b[0m', // Red
      WARN: '\x1b[33m[WARN]\x1b[0m', // Yellow
      INFO: '\x1b[36m[INFO]\x1b[0m', // Cyan
      DEBUG: '\x1b[35m[DEBUG]\x1b[0m', // Magenta
      TRACE: '\x1b[37m[TRACE]\x1b[0m', // White
    };

    return colors[level as keyof typeof colors] || `[${level}]`;
  }
}

/**
 * Simple Formatter
 */
export class SimpleFormatter implements Formatter {
  format(entry: LogEntry): string {
    const level =
      typeof entry.level === 'string'
        ? entry.level.toUpperCase()
        : LogLevel[entry.level];

    let formatted = `[${level}] ${entry.message}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
      formatted += ` ${JSON.stringify(entry.context)}`;
    }

    if (entry.error) {
      formatted += ` Error: ${entry.error.message}`;
    }

    return formatted;
  }
}

/**
 * Create formatter based on type
 */
export function createFormatter(
  type: 'json' | 'text' | 'simple',
  options?: {
    timestamp?: boolean;
    colors?: boolean;
  }
): Formatter {
  switch (type) {
    case 'json':
      return new JsonFormatter();
    case 'text':
      return new TextFormatter(options);
    case 'simple':
      return new SimpleFormatter();
    default:
      throw new Error(`Unknown formatter type: ${type}`);
  }
}
