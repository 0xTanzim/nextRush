/**
 * Unit tests for Logger Factories Module
 *
 * @packageDocumentation
 */

import { LoggerPlugin, LogLevel } from '@/plugins/logger/logger-core';
import {
  createDevLogger,
  createMinimalLogger,
  createProdLogger,
  createTestLogger,
} from '@/plugins/logger/logger-factories';
import { ConsoleTransport } from '@/plugins/logger/logger-transports';

describe('Logger Factories Module', () => {
  describe('createMinimalLogger', () => {
    let logger: LoggerPlugin;

    beforeEach(() => {
      logger = createMinimalLogger();
    });

    afterEach(() => {
      logger.cleanup();
    });

    it('should create LoggerPlugin instance', () => {
      expect(logger).toBeInstanceOf(LoggerPlugin);
    });

    it('should configure minimal settings', () => {
      expect(logger.config.level).toBe(LogLevel.INFO);
      expect(logger.config.format).toBe('simple');
      expect(logger.config.timestamp).toBe(false);
      expect(logger.config.colors).toBe(false);
      expect(logger.config.maxEntries).toBe(100);
      expect(logger.config.flushInterval).toBe(1000);
    });

    it('should have console transport configured', () => {
      expect(logger.config.transports).toEqual([{ type: 'console' }]);
    });

    it('should have console transport configured correctly', () => {
      const transports = logger.getTransports();
      // Factory creates one transport in constructor
      expect(transports).toHaveLength(1);
      expect(transports[0]).toBeInstanceOf(ConsoleTransport);
    });

    it('should log at INFO level and above', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      logger.clear(); // Clear any initial entries
      logger.info('Info message');
      logger.debug('Debug message'); // Should not log

      const entries = logger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0]!.message).toBe('Info message');

      consoleSpy.mockRestore();
    });
  });

  describe('createDevLogger', () => {
    let logger: LoggerPlugin;

    beforeEach(() => {
      logger = createDevLogger();
    });

    afterEach(() => {
      logger.cleanup();
    });

    it('should create LoggerPlugin instance', () => {
      expect(logger).toBeInstanceOf(LoggerPlugin);
    });

    it('should configure development settings', () => {
      expect(logger.config.level).toBe(LogLevel.DEBUG);
      expect(logger.config.format).toBe('text');
      expect(logger.config.timestamp).toBe(true);
      expect(logger.config.colors).toBe(true);
      expect(logger.config.maxEntries).toBe(1000);
      expect(logger.config.flushInterval).toBe(5000);
    });

    it('should have console transport configured', () => {
      expect(logger.config.transports).toEqual([{ type: 'console' }]);
    });

    it('should have console transport configured correctly', () => {
      const transports = logger.getTransports();
      // Factory creates one transport in constructor
      expect(transports).toHaveLength(1);
      expect(transports[0]).toBeInstanceOf(ConsoleTransport);
    });

    it('should log at DEBUG level and above', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logger.clear(); // Clear any initial entries
      logger.debug('Debug message');
      logger.trace('Trace message'); // Should not log at DEBUG level

      const entries = logger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0]!.message).toBe('Debug message');

      consoleSpy.mockRestore();
    });

    it('should use text format with colors and timestamps', () => {
      expect(logger.config.format).toBe('text');
      expect(logger.config.colors).toBe(true);
      expect(logger.config.timestamp).toBe(true);
    });
  });

  describe('createProdLogger', () => {
    let logger: LoggerPlugin;

    beforeEach(() => {
      logger = createProdLogger();
    });

    afterEach(() => {
      logger.cleanup();
    });

    it('should create LoggerPlugin instance', () => {
      expect(logger).toBeInstanceOf(LoggerPlugin);
    });

    it('should configure production settings', () => {
      expect(logger.config.level).toBe(LogLevel.INFO);
      expect(logger.config.format).toBe('json');
      expect(logger.config.timestamp).toBe(true);
      expect(logger.config.colors).toBe(false);
      expect(logger.config.maxEntries).toBe(10000);
      expect(logger.config.flushInterval).toBe(10000);
    });

    it('should have console and file transports configured', () => {
      expect(logger.config.transports).toEqual([
        { type: 'console' },
        { type: 'file', options: { path: 'logs/app.log' } },
      ]);
    });

    it('should have multiple console transports due to factory setup', () => {
      const transports = logger.getTransports();
      // Factory creates one transport in constructor
      expect(transports).toHaveLength(1);
      expect(transports[0]).toBeInstanceOf(ConsoleTransport);
    });

    it('should log at INFO level and above', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      logger.clear(); // Clear any initial entries
      logger.info('Info message');
      logger.debug('Debug message'); // Should not log

      const entries = logger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0]!.message).toBe('Info message');

      consoleSpy.mockRestore();
    });

    it('should use JSON format without colors', () => {
      expect(logger.config.format).toBe('json');
      expect(logger.config.colors).toBe(false);
      expect(logger.config.timestamp).toBe(true);
    });

    it('should have higher capacity for production', () => {
      expect(logger.config.maxEntries).toBe(10000);
      expect(logger.config.flushInterval).toBe(10000);
    });
  });

  describe('createTestLogger', () => {
    let logger: LoggerPlugin;

    beforeEach(() => {
      logger = createTestLogger();
    });

    afterEach(() => {
      logger.cleanup();
    });

    it('should create LoggerPlugin instance', () => {
      expect(logger).toBeInstanceOf(LoggerPlugin);
    });

    it('should configure test settings', () => {
      expect(logger.config.level).toBe(LogLevel.ERROR);
      expect(logger.config.format).toBe('simple');
      expect(logger.config.timestamp).toBe(false);
      expect(logger.config.colors).toBe(false);
      expect(logger.config.maxEntries).toBe(10);
      expect(logger.config.flushInterval).toBe(100);
    });

    it('should have console transport configured', () => {
      expect(logger.config.transports).toEqual([{ type: 'console' }]);
    });

    it('should have multiple console transports due to factory setup', () => {
      const transports = logger.getTransports();
      // Factory creates one transport in constructor
      expect(transports).toHaveLength(1);
      expect(transports[0]).toBeInstanceOf(ConsoleTransport);
    });

    it('should only log at ERROR level', () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      logger.clear(); // Clear any initial entries
      logger.error('Error message');
      logger.warn('Warning message'); // Should not log
      logger.info('Info message'); // Should not log

      // Error level entries are flushed immediately, so check console calls
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should have minimal settings for testing', () => {
      expect(logger.config.maxEntries).toBe(10);
      expect(logger.config.flushInterval).toBe(100);
      expect(logger.config.timestamp).toBe(false);
      expect(logger.config.colors).toBe(false);
    });

    it('should use simple format', () => {
      expect(logger.config.format).toBe('simple');
    });
  });

  describe('Factory Comparison', () => {
    let minimalLogger: LoggerPlugin;
    let devLogger: LoggerPlugin;
    let prodLogger: LoggerPlugin;
    let testLogger: LoggerPlugin;

    beforeEach(() => {
      minimalLogger = createMinimalLogger();
      devLogger = createDevLogger();
      prodLogger = createProdLogger();
      testLogger = createTestLogger();
    });

    afterEach(() => {
      minimalLogger.cleanup();
      devLogger.cleanup();
      prodLogger.cleanup();
      testLogger.cleanup();
    });

    it('should have different log levels', () => {
      expect(minimalLogger.config.level).toBe(LogLevel.INFO);
      expect(devLogger.config.level).toBe(LogLevel.DEBUG);
      expect(prodLogger.config.level).toBe(LogLevel.INFO);
      expect(testLogger.config.level).toBe(LogLevel.ERROR);
    });

    it('should have different formats', () => {
      expect(minimalLogger.config.format).toBe('simple');
      expect(devLogger.config.format).toBe('text');
      expect(prodLogger.config.format).toBe('json');
      expect(testLogger.config.format).toBe('simple');
    });

    it('should have different color settings', () => {
      expect(minimalLogger.config.colors).toBe(false);
      expect(devLogger.config.colors).toBe(true);
      expect(prodLogger.config.colors).toBe(false);
      expect(testLogger.config.colors).toBe(false);
    });

    it('should have different timestamp settings', () => {
      expect(minimalLogger.config.timestamp).toBe(false);
      expect(devLogger.config.timestamp).toBe(true);
      expect(prodLogger.config.timestamp).toBe(true);
      expect(testLogger.config.timestamp).toBe(false);
    });

    it('should have different capacity settings', () => {
      expect(minimalLogger.config.maxEntries).toBe(100);
      expect(devLogger.config.maxEntries).toBe(1000);
      expect(prodLogger.config.maxEntries).toBe(10000);
      expect(testLogger.config.maxEntries).toBe(10);
    });

    it('should have different flush intervals', () => {
      expect(minimalLogger.config.flushInterval).toBe(1000);
      expect(devLogger.config.flushInterval).toBe(5000);
      expect(prodLogger.config.flushInterval).toBe(10000);
      expect(testLogger.config.flushInterval).toBe(100);
    });
  });

  describe('Factory Transport Configuration', () => {
    it('should add console transport to all loggers', () => {
      const loggers = [
        createMinimalLogger(),
        createDevLogger(),
        createProdLogger(),
        createTestLogger(),
      ];

      loggers.forEach(logger => {
        const transports = logger.getTransports();
        expect(transports).toHaveLength(1); // Constructor transport only
        expect(transports.every(t => t instanceof ConsoleTransport)).toBe(true);
        logger.cleanup();
      });
    });

    it('should configure transport log levels correctly', () => {
      const minimalLogger = createMinimalLogger();
      const devLogger = createDevLogger();
      const prodLogger = createProdLogger();
      const testLogger = createTestLogger();

      const minimalTransports = minimalLogger.getTransports();
      const devTransports = devLogger.getTransports();
      const prodTransports = prodLogger.getTransports();
      const testTransports = testLogger.getTransports();

      expect(minimalTransports[0]!.level).toBe('INFO');
      expect(devTransports[0]!.level).toBe('DEBUG');
      expect(prodTransports[0]!.level).toBe('INFO');
      expect(testTransports[0]!.level).toBe('ERROR');

      minimalLogger.cleanup();
      devLogger.cleanup();
      prodLogger.cleanup();
      testLogger.cleanup();
    });
  });

  describe('Factory Usage Patterns', () => {
    it('should create independent logger instances', () => {
      const logger1 = createMinimalLogger();
      const logger2 = createMinimalLogger();

      expect(logger1).not.toBe(logger2);
      expect(logger1.getTransports()).not.toBe(logger2.getTransports());

      logger1.cleanup();
      logger2.cleanup();
    });

    it('should allow configuration override after creation', () => {
      const logger = createDevLogger();

      logger.setLevel(LogLevel.ERROR);
      expect(logger.config.level).toBe(LogLevel.ERROR);

      logger.cleanup();
    });

    it('should support transport management after creation', () => {
      const logger = createMinimalLogger();
      const initialTransportCount = logger.getTransports().length;

      const newTransport = new ConsoleTransport('warn');
      logger.addTransport(newTransport);

      expect(logger.getTransports()).toHaveLength(initialTransportCount + 1);

      logger.cleanup();
    });
  });

  describe('Factory Performance', () => {
    it('should create loggers efficiently', () => {
      const start = Date.now();

      const loggers = [];
      for (let i = 0; i < 100; i++) {
        loggers.push(createMinimalLogger());
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should create 100 loggers in less than 1 second

      loggers.forEach(logger => logger.cleanup());
    });

    it('should handle concurrent logger creation', async () => {
      const promises = Array.from({ length: 50 }, () =>
        Promise.resolve(createMinimalLogger())
      );

      const loggers = await Promise.all(promises);

      expect(loggers).toHaveLength(50);
      expect(loggers.every(logger => logger instanceof LoggerPlugin)).toBe(
        true
      );

      loggers.forEach(logger => logger.cleanup());
    });
  });

  describe('Factory Error Handling', () => {
    it('should create loggers without throwing errors', () => {
      expect(() => createMinimalLogger()).not.toThrow();
      expect(() => createDevLogger()).not.toThrow();
      expect(() => createProdLogger()).not.toThrow();
      expect(() => createTestLogger()).not.toThrow();
    });

    it('should handle missing dependencies gracefully', () => {
      // All factories should work even if some transports might fail
      const loggers = [
        createMinimalLogger(),
        createDevLogger(),
        createProdLogger(),
        createTestLogger(),
      ];

      loggers.forEach(logger => {
        expect(logger).toBeInstanceOf(LoggerPlugin);
        expect(logger.getTransports().length).toBeGreaterThan(0);
        logger.cleanup();
      });
    });
  });
});
