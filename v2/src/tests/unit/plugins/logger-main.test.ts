/**
 * Unit tests for Logger Plugin Main Module (Re-exports)
 *
 * @packageDocumentation
 */

import * as LoggerModule from '@/plugins/logger/logger.plugin';

describe('Logger Plugin Main Module', () => {
  describe('Re-exports Structure', () => {
    it('should re-export LoggerPlugin from logger-core', () => {
      expect(LoggerModule.LoggerPlugin).toBeDefined();
      expect(typeof LoggerModule.LoggerPlugin).toBe('function');
    });

    it('should re-export LogLevel enum from logger-core', () => {
      expect(LoggerModule.LogLevel).toBeDefined();
      expect(typeof LoggerModule.LogLevel).toBe('object');
      expect(LoggerModule.LogLevel.ERROR).toBe(0);
      expect(LoggerModule.LogLevel.WARN).toBe(1);
      expect(LoggerModule.LogLevel.INFO).toBe(2);
      expect(LoggerModule.LogLevel.DEBUG).toBe(3);
      expect(LoggerModule.LogLevel.TRACE).toBe(4);
    });

    it('should re-export factory functions from logger-factories', () => {
      expect(LoggerModule.createMinimalLogger).toBeDefined();
      expect(LoggerModule.createDevLogger).toBeDefined();
      expect(LoggerModule.createProdLogger).toBeDefined();
      expect(LoggerModule.createTestLogger).toBeDefined();

      expect(typeof LoggerModule.createMinimalLogger).toBe('function');
      expect(typeof LoggerModule.createDevLogger).toBe('function');
      expect(typeof LoggerModule.createProdLogger).toBe('function');
      expect(typeof LoggerModule.createTestLogger).toBe('function');
    });

    it('should re-export formatter classes from logger-formatters', () => {
      expect(LoggerModule.JsonFormatter).toBeDefined();
      expect(LoggerModule.TextFormatter).toBeDefined();
      expect(LoggerModule.SimpleFormatter).toBeDefined();
      expect(LoggerModule.createFormatter).toBeDefined();

      expect(typeof LoggerModule.JsonFormatter).toBe('function');
      expect(typeof LoggerModule.TextFormatter).toBe('function');
      expect(typeof LoggerModule.SimpleFormatter).toBe('function');
      expect(typeof LoggerModule.createFormatter).toBe('function');
    });

    it('should re-export transport classes from logger-transports', () => {
      expect(LoggerModule.ConsoleTransport).toBeDefined();
      expect(LoggerModule.FileTransport).toBeDefined();
      expect(LoggerModule.HttpTransport).toBeDefined();
      expect(LoggerModule.StreamTransport).toBeDefined();

      expect(typeof LoggerModule.ConsoleTransport).toBe('function');
      expect(typeof LoggerModule.FileTransport).toBe('function');
      expect(typeof LoggerModule.HttpTransport).toBe('function');
      expect(typeof LoggerModule.StreamTransport).toBe('function');
    });
  });

  describe('Module Functionality', () => {
    it('should create logger instances through re-exported functions', () => {
      const minimalLogger = LoggerModule.createMinimalLogger();
      const devLogger = LoggerModule.createDevLogger();
      const prodLogger = LoggerModule.createProdLogger();
      const testLogger = LoggerModule.createTestLogger();

      expect(minimalLogger).toBeInstanceOf(LoggerModule.LoggerPlugin);
      expect(devLogger).toBeInstanceOf(LoggerModule.LoggerPlugin);
      expect(prodLogger).toBeInstanceOf(LoggerModule.LoggerPlugin);
      expect(testLogger).toBeInstanceOf(LoggerModule.LoggerPlugin);

      minimalLogger.cleanup();
      devLogger.cleanup();
      prodLogger.cleanup();
      testLogger.cleanup();
    });

    it('should create formatter instances through re-exported classes', () => {
      const jsonFormatter = new LoggerModule.JsonFormatter();
      const textFormatter = new LoggerModule.TextFormatter();
      const simpleFormatter = new LoggerModule.SimpleFormatter();

      expect(jsonFormatter).toBeInstanceOf(LoggerModule.JsonFormatter);
      expect(textFormatter).toBeInstanceOf(LoggerModule.TextFormatter);
      expect(simpleFormatter).toBeInstanceOf(LoggerModule.SimpleFormatter);
    });

    it('should create transport instances through re-exported classes', () => {
      const consoleTransport = new LoggerModule.ConsoleTransport('info');
      const fileTransport = new LoggerModule.FileTransport('test.log', 'info');
      const httpTransport = new LoggerModule.HttpTransport(
        'http://localhost:3000',
        'info'
      );

      expect(consoleTransport).toBeInstanceOf(LoggerModule.ConsoleTransport);
      expect(fileTransport).toBeInstanceOf(LoggerModule.FileTransport);
      expect(httpTransport).toBeInstanceOf(LoggerModule.HttpTransport);
    });

    it('should use createFormatter through re-exported function', () => {
      const jsonFormatter = LoggerModule.createFormatter('json');
      const textFormatter = LoggerModule.createFormatter('text');
      const simpleFormatter = LoggerModule.createFormatter('simple');

      expect(jsonFormatter).toBeInstanceOf(LoggerModule.JsonFormatter);
      expect(textFormatter).toBeInstanceOf(LoggerModule.TextFormatter);
      expect(simpleFormatter).toBeInstanceOf(LoggerModule.SimpleFormatter);
    });
  });

  describe('API Compatibility', () => {
    it('should maintain backward compatibility for LoggerPlugin creation', () => {
      const logger = new LoggerModule.LoggerPlugin({
        level: LoggerModule.LogLevel.DEBUG,
        format: 'json',
        timestamp: true,
        colors: false,
      });

      expect(logger).toBeInstanceOf(LoggerModule.LoggerPlugin);
      expect(logger.config.level).toBe(LoggerModule.LogLevel.DEBUG);
      expect(logger.config.format).toBe('json');

      logger.cleanup();
    });

    it('should support complete logger workflow through re-exports', () => {
      // Create logger
      const logger = LoggerModule.createDevLogger();

      // Create custom transport
      const transport = new LoggerModule.ConsoleTransport('debug');
      logger.addTransport(transport);

      // Create formatter
      const formatter = LoggerModule.createFormatter('json');

      // Use logger
      logger.info('Test message through re-exports');

      expect(logger.getEntries()).toHaveLength(1);
      expect(formatter).toBeInstanceOf(LoggerModule.JsonFormatter);

      logger.cleanup();
    });

    it('should expose all necessary types for TypeScript usage', () => {
      // Test that types are properly exported for TypeScript consumers
      const logger: LoggerModule.LoggerPlugin =
        LoggerModule.createMinimalLogger();
      const level: LoggerModule.LogLevel = LoggerModule.LogLevel.INFO;

      expect(logger).toBeInstanceOf(LoggerModule.LoggerPlugin);
      expect(level).toBe(2); // INFO level value

      logger.cleanup();
    });
  });

  describe('Module Integration', () => {
    it('should work with all components together', () => {
      // Create logger with custom configuration
      const logger = new LoggerModule.LoggerPlugin({
        level: LoggerModule.LogLevel.DEBUG,
        format: 'text',
        timestamp: true,
        colors: true,
      });

      // Add multiple transports
      const consoleTransport = new LoggerModule.ConsoleTransport('debug');
      const fileTransport = new LoggerModule.FileTransport(
        'integration-test.log',
        'debug'
      );

      logger.addTransport(consoleTransport);
      logger.addTransport(fileTransport);

      // Create formatters
      const jsonFormatter = new LoggerModule.JsonFormatter();
      const textFormatter = new LoggerModule.TextFormatter({
        timestamp: true,
        colors: false,
      });

      // Log messages
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');

      // Verify functionality
      const entries = logger.getEntries();
      expect(entries).toHaveLength(4);

      entries.forEach(entry => {
        const jsonFormatted = jsonFormatter.format(entry);
        const textFormatted = textFormatter.format(entry);

        expect(typeof jsonFormatted).toBe('string');
        expect(typeof textFormatted).toBe('string');
        expect(JSON.parse(jsonFormatted)).toHaveProperty('message');
      });

      logger.cleanup();
    });

    it('should support factory pattern with custom transports', () => {
      const logger = LoggerModule.createProdLogger();

      // Add HTTP transport for production logging
      const httpTransport = new LoggerModule.HttpTransport(
        'http://logs.example.com',
        'info'
      );
      logger.addTransport(httpTransport);

      // Use simple formatter for console output
      const simpleFormatter = LoggerModule.createFormatter('simple');

      logger.info('Production log message');

      const entries = logger.getEntries();
      expect(entries).toHaveLength(1);

      const formatted = simpleFormatter.format(entries[0]!);
      expect(formatted).toContain('[INFO] Production log message');

      logger.cleanup();
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully across modules', () => {
      const logger = LoggerModule.createTestLogger();

      // Test with error transport
      const errorTransport = {
        name: 'error-transport',
        level: 'info' as const,
        write: () => {
          throw new Error('Transport error');
        },
      };

      logger.addTransport(errorTransport);

      // Should not throw when logging
      expect(() => {
        logger.error('Error message with failing transport');
      }).not.toThrow();

      logger.cleanup();
    });

    it('should handle formatter errors gracefully', () => {
      const logger = LoggerModule.createMinimalLogger();
      const formatter = new LoggerModule.JsonFormatter();

      // Create entry with circular reference
      const circularObj: any = { prop: 'value' };
      circularObj.self = circularObj;

      logger.info('Test message', circularObj);
      const entries = logger.getEntries();

      // Formatter should handle circular reference error
      expect(() => {
        formatter.format(entries[0]!);
      }).toThrow(); // JSON.stringify throws on circular refs

      logger.cleanup();
    });
  });

  describe('Performance', () => {
    it('should maintain performance with re-exported components', () => {
      const logger = LoggerModule.createMinimalLogger();
      const formatter = LoggerModule.createFormatter('simple');

      const start = Date.now();

      // Log many messages
      for (let i = 0; i < 1000; i++) {
        logger.info(`Message ${i}`);
      }

      // Format entries
      const entries = logger.getEntries();
      entries.forEach(entry => {
        formatter.format(entry);
      });

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second

      logger.cleanup();
    });

    it('should handle high-frequency logging with multiple transports', () => {
      const logger = LoggerModule.createDevLogger();

      // Add multiple transports
      const transports = [
        new LoggerModule.ConsoleTransport('debug'),
        new LoggerModule.FileTransport('perf-test.log', 'debug'),
      ];

      transports.forEach(transport => logger.addTransport(transport));

      const start = Date.now();

      // High-frequency logging
      for (let i = 0; i < 500; i++) {
        logger.debug(`Performance test message ${i}`);
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(2000); // Should handle 500 messages within 2 seconds

      logger.cleanup();
    });
  });

  describe('Memory Management', () => {
    it('should properly clean up resources', () => {
      const loggers = Array.from({ length: 10 }, () =>
        LoggerModule.createMinimalLogger()
      );

      loggers.forEach(logger => {
        logger.info('Test message');
        expect(logger.getEntries()).toHaveLength(1);
      });

      // Cleanup all loggers
      loggers.forEach(logger => {
        logger.cleanup();
        expect(logger.getEntries()).toHaveLength(0);
      });
    });

    it('should handle memory pressure with multiple components', () => {
      const logger = LoggerModule.createProdLogger();

      // Create many formatters and transports
      const formatters = [
        new LoggerModule.JsonFormatter(),
        new LoggerModule.TextFormatter(),
        new LoggerModule.SimpleFormatter(),
      ];

      const transports = [
        new LoggerModule.ConsoleTransport('info'),
        new LoggerModule.FileTransport('memory-test.log', 'info'),
      ];

      transports.forEach(transport => logger.addTransport(transport));

      // Log many messages
      for (let i = 0; i < 1000; i++) {
        logger.info(`Memory test message ${i}`);
      }

      // Format with all formatters
      const entries = logger.getEntries();
      formatters.forEach(formatter => {
        entries.forEach(entry => {
          formatter.format(entry);
        });
      });

      // Should not crash due to memory issues
      expect(entries.length).toBeGreaterThan(0);

      logger.cleanup();
    });
  });
});
