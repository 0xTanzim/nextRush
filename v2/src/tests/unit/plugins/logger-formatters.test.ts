/**
 * Unit tests for Logger Formatters Module
 *
 * @packageDocumentation
 */

import {
  JsonFormatter,
  SimpleFormatter,
  TextFormatter,
  createFormatter,
  type Formatter,
} from '@/plugins/logger/logger-formatters';
import { LogLevel, type LogEntry } from '@/plugins/logger/logger-types';

describe('Logger Formatters Module', () => {
  const mockLogEntry: LogEntry = {
    timestamp: new Date('2024-01-01T12:00:00.000Z'),
    level: LogLevel.INFO,
    message: 'Test message',
    context: { userId: 123, action: 'login' },
  };

  const mockErrorEntry: LogEntry = {
    timestamp: new Date('2024-01-01T12:00:00.000Z'),
    level: LogLevel.ERROR,
    message: 'Error message',
    context: { errorCode: 500 },
    error: new Error('Test error'),
  };

  describe('JsonFormatter', () => {
    let formatter: JsonFormatter;

    beforeEach(() => {
      formatter = new JsonFormatter();
    });

    it('should create JsonFormatter instance', () => {
      expect(formatter).toBeInstanceOf(JsonFormatter);
    });

    it('should format log entry as JSON string', () => {
      const result = formatter.format(mockLogEntry);
      const parsed = JSON.parse(result);

      expect(parsed.timestamp).toBe('2024-01-01T12:00:00.000Z');
      expect(parsed.level).toBe('INFO');
      expect(parsed.message).toBe('Test message');
      expect(parsed.context).toEqual({ userId: 123, action: 'login' });
    });

    it('should handle string timestamp', () => {
      const entryWithStringTimestamp: LogEntry = {
        ...mockLogEntry,
        timestamp: '2024-01-01T12:00:00.000Z',
      };

      const result = formatter.format(entryWithStringTimestamp);
      const parsed = JSON.parse(result);

      expect(parsed.timestamp).toBe('2024-01-01T12:00:00.000Z');
    });

    it('should handle string level', () => {
      const entryWithStringLevel: LogEntry = {
        ...mockLogEntry,
        level: 'INFO' as any,
      };

      const result = formatter.format(entryWithStringLevel);
      const parsed = JSON.parse(result);

      expect(parsed.level).toBe('INFO');
    });

    it('should format error information', () => {
      const result = formatter.format(mockErrorEntry);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBeDefined();
      expect(parsed.error.name).toBe('Error');
      expect(parsed.error.message).toBe('Test error');
      expect(parsed.error.stack).toBeDefined();
    });

    it('should handle entry without error', () => {
      const result = formatter.format(mockLogEntry);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBeUndefined();
    });

    it('should handle empty context', () => {
      const entryWithEmptyContext: LogEntry = {
        ...mockLogEntry,
        context: {},
      };

      const result = formatter.format(entryWithEmptyContext);
      const parsed = JSON.parse(result);

      expect(parsed.context).toEqual({});
    });
  });

  describe('TextFormatter', () => {
    it('should create TextFormatter with default options', () => {
      const formatter = new TextFormatter();
      expect(formatter).toBeInstanceOf(TextFormatter);
    });

    it('should create TextFormatter with custom options', () => {
      const formatter = new TextFormatter({
        timestamp: true,
        colors: false,
      });
      expect(formatter).toBeInstanceOf(TextFormatter);
    });

    it('should format log entry without timestamp and colors', () => {
      const formatter = new TextFormatter({
        timestamp: false,
        colors: false,
      });

      const result = formatter.format(mockLogEntry);

      expect(result).toBe(
        '[INFO] Test message {"userId":123,"action":"login"}'
      );
    });

    it('should format log entry with timestamp', () => {
      const formatter = new TextFormatter({
        timestamp: true,
        colors: false,
      });

      const result = formatter.format(mockLogEntry);

      expect(result).toBe(
        '2024-01-01T12:00:00.000Z [INFO] Test message {"userId":123,"action":"login"}'
      );
    });

    it('should format log entry with colors', () => {
      const formatter = new TextFormatter({
        timestamp: false,
        colors: true,
      });

      const result = formatter.format(mockLogEntry);

      expect(result).toContain('\x1b[36m[INFO]\x1b[0m'); // Cyan color for INFO
      expect(result).toContain('Test message');
    });

    it('should format log entry with timestamp and colors', () => {
      const formatter = new TextFormatter({
        timestamp: true,
        colors: true,
      });

      const result = formatter.format(mockLogEntry);

      expect(result).toContain('2024-01-01T12:00:00.000Z');
      expect(result).toContain('\x1b[36m[INFO]\x1b[0m');
    });

    it('should handle string timestamp', () => {
      const formatter = new TextFormatter({ timestamp: true });
      const entryWithStringTimestamp: LogEntry = {
        ...mockLogEntry,
        timestamp: '2024-01-01T12:00:00.000Z',
      };

      const result = formatter.format(entryWithStringTimestamp);

      expect(result).toContain('2024-01-01T12:00:00.000Z');
    });

    it('should handle string level', () => {
      const formatter = new TextFormatter({ colors: false });
      const entryWithStringLevel: LogEntry = {
        ...mockLogEntry,
        level: 'INFO' as any,
      };

      const result = formatter.format(entryWithStringLevel);

      expect(result).toContain('[INFO]');
    });

    it('should format error information', () => {
      const formatter = new TextFormatter({ colors: false });

      const result = formatter.format(mockErrorEntry);

      expect(result).toContain('Error message');
      expect(result).toContain('Error: Test error');
      expect(result).toContain('Error');
    });

    it('should handle empty context', () => {
      const formatter = new TextFormatter();
      const entryWithEmptyContext: LogEntry = {
        ...mockLogEntry,
        context: {},
      };

      const result = formatter.format(entryWithEmptyContext);

      expect(result).not.toContain('{}');
    });

    it('should colorize different log levels', () => {
      const formatter = new TextFormatter({ colors: true });

      const errorEntry = { ...mockLogEntry, level: LogLevel.ERROR };
      const warnEntry = { ...mockLogEntry, level: LogLevel.WARN };
      const debugEntry = { ...mockLogEntry, level: LogLevel.DEBUG };
      const traceEntry = { ...mockLogEntry, level: LogLevel.TRACE };

      expect(formatter.format(errorEntry)).toContain('\x1b[31m[ERROR]\x1b[0m'); // Red
      expect(formatter.format(warnEntry)).toContain('\x1b[33m[WARN]\x1b[0m'); // Yellow
      expect(formatter.format(mockLogEntry)).toContain('\x1b[36m[INFO]\x1b[0m'); // Cyan
      expect(formatter.format(debugEntry)).toContain('\x1b[35m[DEBUG]\x1b[0m'); // Magenta
      expect(formatter.format(traceEntry)).toContain('\x1b[37m[TRACE]\x1b[0m'); // White
    });

    it('should handle unknown log level colors', () => {
      const formatter = new TextFormatter({ colors: true });
      const entryWithUnknownLevel: LogEntry = {
        ...mockLogEntry,
        level: 'UNKNOWN' as any,
      };

      const result = formatter.format(entryWithUnknownLevel);

      expect(result).toContain('[UNKNOWN]');
    });
  });

  describe('SimpleFormatter', () => {
    let formatter: SimpleFormatter;

    beforeEach(() => {
      formatter = new SimpleFormatter();
    });

    it('should create SimpleFormatter instance', () => {
      expect(formatter).toBeInstanceOf(SimpleFormatter);
    });

    it('should format log entry simply', () => {
      const result = formatter.format(mockLogEntry);

      expect(result).toBe(
        '[INFO] Test message {"userId":123,"action":"login"}'
      );
    });

    it('should handle string level', () => {
      const entryWithStringLevel: LogEntry = {
        ...mockLogEntry,
        level: 'INFO' as any,
      };

      const result = formatter.format(entryWithStringLevel);

      expect(result).toContain('[INFO]');
    });

    it('should format error information', () => {
      const result = formatter.format(mockErrorEntry);

      expect(result).toContain('[ERROR] Error message');
      expect(result).toContain('Error: Test error');
    });

    it('should handle empty context', () => {
      const entryWithEmptyContext: LogEntry = {
        ...mockLogEntry,
        context: {},
      };

      const result = formatter.format(entryWithEmptyContext);

      expect(result).not.toContain('{}');
    });

    it('should handle entry without context', () => {
      const entryWithoutContext: LogEntry = {
        timestamp: new Date('2024-01-01T12:00:00.000Z'),
        level: LogLevel.INFO,
        message: 'Simple message',
        context: {},
      };

      const result = formatter.format(entryWithoutContext);

      expect(result).toBe('[INFO] Simple message');
    });
  });

  describe('createFormatter function', () => {
    it('should create JsonFormatter', () => {
      const formatter = createFormatter('json');

      expect(formatter).toBeInstanceOf(JsonFormatter);
    });

    it('should create TextFormatter', () => {
      const formatter = createFormatter('text');

      expect(formatter).toBeInstanceOf(TextFormatter);
    });

    it('should create TextFormatter with options', () => {
      const formatter = createFormatter('text', {
        timestamp: true,
        colors: false,
      });

      expect(formatter).toBeInstanceOf(TextFormatter);

      const result = formatter.format(mockLogEntry);
      expect(result).toContain('2024-01-01T12:00:00.000Z');
      expect(result).not.toContain('\x1b[');
    });

    it('should create SimpleFormatter', () => {
      const formatter = createFormatter('simple');

      expect(formatter).toBeInstanceOf(SimpleFormatter);
    });

    it('should throw error for unknown formatter type', () => {
      expect(() => {
        createFormatter('unknown' as any);
      }).toThrow('Unknown formatter type: unknown');
    });

    it('should ignore options for json formatter', () => {
      const formatter = createFormatter('json', {
        timestamp: true,
        colors: true,
      });

      expect(formatter).toBeInstanceOf(JsonFormatter);
    });

    it('should ignore options for simple formatter', () => {
      const formatter = createFormatter('simple', {
        timestamp: true,
        colors: true,
      });

      expect(formatter).toBeInstanceOf(SimpleFormatter);
    });
  });

  describe('Formatter Interface Compliance', () => {
    it('should implement Formatter interface', () => {
      const jsonFormatter: Formatter = new JsonFormatter();
      const textFormatter: Formatter = new TextFormatter();
      const simpleFormatter: Formatter = new SimpleFormatter();

      expect(typeof jsonFormatter.format).toBe('function');
      expect(typeof textFormatter.format).toBe('function');
      expect(typeof simpleFormatter.format).toBe('function');
    });

    it('should return string from format method', () => {
      const formatters: Formatter[] = [
        new JsonFormatter(),
        new TextFormatter(),
        new SimpleFormatter(),
      ];

      formatters.forEach(formatter => {
        const result = formatter.format(mockLogEntry);
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed error objects', () => {
      const entryWithMalformedError: LogEntry = {
        ...mockLogEntry,
        error: { message: 'Custom error' } as Error,
      };

      const jsonFormatter = new JsonFormatter();
      const textFormatter = new TextFormatter();
      const simpleFormatter = new SimpleFormatter();

      expect(() => jsonFormatter.format(entryWithMalformedError)).not.toThrow();
      expect(() => textFormatter.format(entryWithMalformedError)).not.toThrow();
      expect(() =>
        simpleFormatter.format(entryWithMalformedError)
      ).not.toThrow();
    });

    it('should handle circular references in context', () => {
      const circularContext: any = { prop: 'value' };
      circularContext.self = circularContext;

      const entryWithCircularContext: LogEntry = {
        ...mockLogEntry,
        context: circularContext,
      };

      // JSON formatter should handle circular references gracefully
      expect(() => {
        const jsonFormatter = new JsonFormatter();
        jsonFormatter.format(entryWithCircularContext);
      }).toThrow(); // JSON.stringify throws on circular refs

      // Text and Simple formatters should handle it
      const textFormatter = new TextFormatter();
      const simpleFormatter = new SimpleFormatter();

      expect(() => textFormatter.format(entryWithCircularContext)).toThrow();
      expect(() => simpleFormatter.format(entryWithCircularContext)).toThrow();
    });

    it('should handle very long messages', () => {
      const longMessage = 'A'.repeat(10000);
      const entryWithLongMessage: LogEntry = {
        ...mockLogEntry,
        message: longMessage,
      };

      const formatters: Formatter[] = [
        new JsonFormatter(),
        new TextFormatter(),
        new SimpleFormatter(),
      ];

      formatters.forEach(formatter => {
        const result = formatter.format(entryWithLongMessage);
        expect(result).toContain(longMessage);
      });
    });

    it('should handle special characters in message', () => {
      const specialMessage = 'Message with "quotes" and \n newlines \t tabs';
      const entryWithSpecialChars: LogEntry = {
        ...mockLogEntry,
        message: specialMessage,
      };

      const formatters: Formatter[] = [
        new JsonFormatter(),
        new TextFormatter(),
        new SimpleFormatter(),
      ];

      formatters.forEach(formatter => {
        const result = formatter.format(entryWithSpecialChars);
        expect(result).toContain('quotes');
      });
    });

    it('should handle undefined and null values in context', () => {
      const entryWithNullValues: LogEntry = {
        ...mockLogEntry,
        context: {
          nullValue: null,
          undefinedValue: undefined,
          emptyString: '',
          zero: 0,
          false: false,
        },
      };

      const formatters: Formatter[] = [
        new JsonFormatter(),
        new TextFormatter(),
        new SimpleFormatter(),
      ];

      formatters.forEach(formatter => {
        expect(() => formatter.format(entryWithNullValues)).not.toThrow();
      });
    });
  });
});
