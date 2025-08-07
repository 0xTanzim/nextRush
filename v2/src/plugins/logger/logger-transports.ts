/**
 * Logger Transport implementations for NextRush v2
 *
 * @packageDocumentation
 */

import { LogLevel, type LogEntry, type Transport } from './logger-types';

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
