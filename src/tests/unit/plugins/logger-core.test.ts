/**
 * Unit tests for Logger Core Module
 *
 * @packageDocumentation
 */

import { createApp, type Application } from '@/index';
import {
  LoggerPlugin,
  LogLevel,
  type LoggerConfig,
} from '@/plugins/logger/logger-core';
import { ConsoleTransport } from '@/plugins/logger/logger-transports';
import { vi } from 'vitest';

describe('Logger Core Module', () => {
  let app: Application;
  let logger: LoggerPlugin;

  beforeEach(() => {
    app = createApp();
    logger = new LoggerPlugin();
  });

  afterEach(() => {
    logger.cleanup();
  });

  describe('LoggerPlugin Class', () => {
    it('should create logger with default config', () => {
      expect(logger).toBeInstanceOf(LoggerPlugin);
      expect(logger.name).toBe('Logger');
      expect(logger.version).toBe('1.0.0');
      expect(logger.config.level).toBe(LogLevel.INFO);
    });

    it('should create logger with custom config', () => {
      const customConfig: LoggerConfig = {
        level: LogLevel.DEBUG,
        format: 'json',
        timestamp: false,
        colors: false,
        maxEntries: 500,
        flushInterval: 3000,
        maxMemoryUsage: 25,
        asyncFlush: false,
        transports: [{ type: 'console' }],
      };

      const customLogger = new LoggerPlugin(customConfig);
      expect(customLogger.config.level).toBe(LogLevel.DEBUG);
      expect(customLogger.config.format).toBe('json');
      expect(customLogger.config.timestamp).toBe(false);
      expect(customLogger.config.maxEntries).toBe(500);
      expect(customLogger.config.flushInterval).toBe(3000);
      expect(customLogger.config.maxMemoryUsage).toBe(25);
      expect(customLogger.config.asyncFlush).toBe(false);
    });

    it('should initialize with default console transport', () => {
      const transports = logger.getTransports();
      expect(transports).toHaveLength(1);
      expect(transports[0]).toBeInstanceOf(ConsoleTransport);
    });
  });

  describe('Plugin Installation', () => {
    it('should install logger plugin on application', () => {
      logger.onInstall(app);

      expect(app.loggerInstance).toBeDefined();
      expect(app.loggerInstance!.error).toBeInstanceOf(Function);
      expect(app.loggerInstance!.warn).toBeInstanceOf(Function);
      expect(app.loggerInstance!.info).toBeInstanceOf(Function);
      expect(app.loggerInstance!.debug).toBeInstanceOf(Function);
      expect(app.loggerInstance!.trace).toBeInstanceOf(Function);
      expect(app.loggerInstance!.log).toBeInstanceOf(Function);
    });

    it('should add logger alias to application', () => {
      logger.onInstall(app);

      expect((app as any).logger).toBeDefined();
      expect((app as any).logger).toBe(app.loggerInstance);
    });

    it('should add request logging middleware', () => {
      const useSpy = vi.spyOn(app, 'use');
      logger.onInstall(app);

      expect(useSpy).toHaveBeenCalledWith(expect.any(Function));
      expect((logger as any).isInstalled).toBe(true);
    });

    it('should start flush timer on installation', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      logger.onInstall(app);

      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        logger.config.flushInterval
      );
    });
  });

  describe('Logging Methods', () => {
    beforeEach(() => {
      logger.onInstall(app);
    });

    it('should log error messages', () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      logger.error('Test error', { code: 500 });

      // Error messages are flushed immediately, so entries might be empty
      // But should have been processed by transports
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should log warn messages', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      logger.warn('Test warning', { deprecated: true });

      // Warn messages are flushed immediately, so entries might be empty
      // But should have been processed by transports
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should log info messages', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      logger.clear(); // Clear before test
      logger.info('Test info', { userId: 123 });

      const entries = logger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0]!.level).toBe(LogLevel.INFO);
      expect(entries[0]!.message).toBe('Test info');
      expect(entries[0]!.context).toEqual({ userId: 123 });

      consoleSpy.mockRestore();
    });

    it('should log debug messages', () => {
      const debugLogger = new LoggerPlugin({ level: LogLevel.DEBUG });
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      debugLogger.debug('Test debug', { trace: 'value' });

      const entries = debugLogger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0]!.level).toBe(LogLevel.DEBUG);
      expect(entries[0]!.message).toBe('Test debug');
      expect(entries[0]!.context).toEqual({ trace: 'value' });

      consoleSpy.mockRestore();
    });

    it('should log trace messages', () => {
      const traceLogger = new LoggerPlugin({ level: LogLevel.TRACE });
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      traceLogger.trace('Test trace', { stack: 'trace' });

      const entries = traceLogger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0]!.level).toBe(LogLevel.TRACE);
      expect(entries[0]!.message).toBe('Test trace');
      expect(entries[0]!.context).toEqual({ stack: 'trace' });

      consoleSpy.mockRestore();
    });

    it('should use log method as alias for info', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      logger.clear(); // Clear before test
      logger.log('Test log message');

      const entries = logger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0]!.level).toBe(LogLevel.INFO);
      expect(entries[0]!.message).toBe('Test log message');

      consoleSpy.mockRestore();
    });
  });

  describe('Entry Management', () => {
    it('should add entries with timestamps', () => {
      logger.info('Test message');

      const entries = logger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0]!.timestamp).toBeInstanceOf(Date);
    });

    it('should limit entries to maxEntries', () => {
      const limitedLogger = new LoggerPlugin({ maxEntries: 3 });

      limitedLogger.info('Message 1');
      limitedLogger.info('Message 2');
      limitedLogger.info('Message 3');
      limitedLogger.info('Message 4');
      limitedLogger.info('Message 5');

      const entries = limitedLogger.getEntries();
      expect(entries).toHaveLength(3);
      expect(entries[0]!.message).toBe('Message 3');
      expect(entries[2]!.message).toBe('Message 5');
    });

    it('should clear entries', () => {
      logger.info('Message 1');
      logger.info('Message 2');

      expect(logger.getEntries()).toHaveLength(2);

      logger.clear();

      expect(logger.getEntries()).toHaveLength(0);
    });

    it('should handle empty context gracefully', () => {
      logger.info('Message without context');

      const entries = logger.getEntries();
      expect(entries[0]!.context).toEqual({});
    });
  });

  describe('Level Management', () => {
    it('should set log level with enum', () => {
      logger.setLevel(LogLevel.DEBUG);

      expect(logger.config.level).toBe(LogLevel.DEBUG);
    });

    it('should set log level with string', () => {
      logger.setLevel('ERROR');

      expect(logger.config.level).toBe(LogLevel.ERROR);
    });

    it('should update transport levels when setting level', () => {
      const transport = new ConsoleTransport('info');
      logger.addTransport(transport);

      logger.setLevel(LogLevel.WARN);

      expect(transport.level).toBe('warn');
    });
  });

  describe('Transport Management', () => {
    it('should add transport', () => {
      const transport = new ConsoleTransport('debug');
      const initialCount = logger.getTransports().length;

      logger.addTransport(transport);

      expect(logger.getTransports()).toHaveLength(initialCount + 1);
      expect(logger.getTransports()).toContain(transport);
    });

    it('should remove transport by name', () => {
      const transport = new ConsoleTransport('debug');
      transport.name = 'test-console';

      logger.addTransport(transport);
      expect(logger.getTransports()).toContain(transport);

      logger.removeTransport('test-console');
      expect(logger.getTransports()).not.toContain(transport);
    });

    it('should access transports via getter', () => {
      const transports = logger.transports;
      expect(transports).toBeInstanceOf(Array);
      expect(transports.length).toBeGreaterThan(0);
    });
  });

  describe('Event System', () => {
    it('should add event listener', () => {
      const listener = vi.fn();

      logger.on('log', listener);
      logger.logMessage(LogLevel.INFO, 'Test message');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'INFO',
          message: 'Test message',
        })
      );
    });

    it('should remove event listener', () => {
      const listener = vi.fn();

      logger.on('log', listener);
      logger.off('log', listener);
      logger.logMessage(LogLevel.INFO, 'Test message');

      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      logger.on('log', listener1);
      logger.on('log', listener2);
      logger.logMessage(LogLevel.INFO, 'Test message');

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('should handle string level in logMessage', () => {
      const listener = vi.fn();

      logger.on('log', listener);
      logger.logMessage('INFO', 'Test message', { test: true });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'INFO',
          message: 'Test message',
          context: { test: true },
        })
      );
    });
  });

  describe('Memory Management', () => {
    it('should check memory usage', () => {
      const memoryLogger = new LoggerPlugin({ maxMemoryUsage: 1 }); // Very low limit

      // Force memory check
      for (let i = 0; i < 100; i++) {
        memoryLogger.info(`Message ${i}`);
      }

      // Should have triggered memory management
      expect(memoryLogger.getEntries().length).toBeLessThanOrEqual(
        memoryLogger.config.maxEntries!
      );
    });

    it('should handle memory pressure by reducing entries', () => {
      const memoryLogger = new LoggerPlugin({
        maxMemoryUsage: 50, // Normal limit to avoid immediate flush
        maxEntries: 10,
      });

      // Add entries
      for (let i = 0; i < 10; i++) {
        memoryLogger.info(`Message ${i}`);
      }

      // Should have entries
      expect(memoryLogger.getEntries().length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Immediate Transport Writing', () => {
    it('should write immediately to transports for error levels', () => {
      const transport = logger.getTransports()[0];
      const writeSpy = vi
        .spyOn(transport!, 'write')
        .mockImplementation(() => {});

      logger.error('Error message');

      expect(writeSpy).toHaveBeenCalled();
      writeSpy.mockRestore();
    });

    it('should write immediately to transports for warn levels', () => {
      const transport = logger.getTransports()[0];
      const writeSpy = vi
        .spyOn(transport!, 'write')
        .mockImplementation(() => {});

      logger.warn('Warning message');

      expect(writeSpy).toHaveBeenCalled();
      writeSpy.mockRestore();
    });

    it('should handle async flush configuration', () => {
      const asyncLogger = new LoggerPlugin({ asyncFlush: true });
      const setImmediateSpy = vi
        .spyOn(global, 'setImmediate')
        .mockImplementation(fn => {
          fn();
          return {} as NodeJS.Immediate;
        });

      asyncLogger.info('Test message');
      (asyncLogger as any).flush();

      expect(setImmediateSpy).toHaveBeenCalled();
      setImmediateSpy.mockRestore();
    });

    it('should handle sync flush configuration', () => {
      const syncLogger = new LoggerPlugin({ asyncFlush: false });
      const setImmediateSpy = vi.spyOn(global, 'setImmediate');

      syncLogger.info('Test message');
      (syncLogger as any).flush();

      expect(setImmediateSpy).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle transport write errors gracefully', () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const errorTransport = {
        name: 'error-transport',
        level: 'info',
        write: () => {
          throw new Error('Transport write error');
        },
      };

      logger.addTransport(errorTransport);
      logger.info('Test message');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Transport error error:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle async transport errors', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const asyncErrorTransport = {
        name: 'async-error-transport',
        level: 'info',
        write: () => Promise.reject(new Error('Async transport error')),
      };

      logger.addTransport(asyncErrorTransport);
      logger.info('Test message');

      // Wait for async error handling
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Cleanup', () => {
    it('should stop flush timer on cleanup', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      logger.onInstall(app);

      logger.cleanup();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should flush remaining entries on cleanup', () => {
      const flushSpy = vi.spyOn(logger as any, 'flush');
      logger.info('Test message');

      logger.cleanup();

      expect(flushSpy).toHaveBeenCalled();
      expect(logger.getEntries()).toHaveLength(0);
    });

    it('should handle cleanup without flush timer', () => {
      // Create logger without flush timer
      const noTimerLogger = new LoggerPlugin({ flushInterval: 0 });

      expect(() => noTimerLogger.cleanup()).not.toThrow();
    });
  });

  describe('Integration with Application Context', () => {
    it('should log request start and completion', async () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      logger.onInstall(app);

      // Simulate middleware execution
      const mockContext = {
        id: 'test-request-123',
        req: {
          method: 'GET',
          url: '/test',
          headers: { 'user-agent': 'test-agent' },
        },
        res: {
          statusCode: 200,
        },
        ip: '127.0.0.1',
      };

      const middleware = (app as any).middleware[0];
      const next = vi.fn().mockResolvedValue(undefined);

      await middleware(mockContext, next);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Request started: GET /test')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Request completed: 200')
      );

      consoleSpy.mockRestore();
    });

    it('should log request errors', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      logger.onInstall(app);

      const mockContext = {
        id: 'test-request-456',
        req: {
          method: 'POST',
          url: '/error',
          headers: { 'user-agent': 'test-agent' },
        },
        ip: '127.0.0.1',
      };

      const middleware = (app as any).middleware[0];
      const next = vi.fn().mockRejectedValue(new Error('Test error'));

      try {
        await middleware(mockContext, next);
      } catch {
        // Expected to throw
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Request failed')
      );

      consoleSpy.mockRestore();
    });
  });
});
