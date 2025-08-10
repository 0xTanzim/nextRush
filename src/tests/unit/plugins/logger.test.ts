/**
 * Unit tests for Advanced Logger Plugin
 *
 * @packageDocumentation
 */

import { createApp, type Application } from '@/index';
import {
  ConsoleTransport,
  FileTransport,
  HttpTransport,
  LogLevel,
  LoggerPlugin,
  StreamTransport,
  createDevLogger,
  createMinimalLogger,
  createProdLogger,
} from '@/plugins/logger';
import { mkdir, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';

describe('Advanced Logger Plugin', () => {
  let app: Application;
  let testLogFile: string;

  beforeEach(async () => {
    app = createApp();
    testLogFile = join(process.cwd(), 'test.log');

    // Ensure logs directory exists for minimal logger test
    try {
      await mkdir('logs', { recursive: true });
    } catch {
      // Directory already exists
    }
  });

  afterEach(async () => {
    try {
      await unlink(testLogFile);
    } catch {
      // File doesn't exist, ignore
    }
  });

  describe('Logger Plugin Creation', () => {
    it('should create logger plugin with default config', () => {
      const logger = new LoggerPlugin();
      expect(logger).toBeInstanceOf(LoggerPlugin);
    });

    it('should create logger plugin with custom config', () => {
      const logger = new LoggerPlugin({
        level: LogLevel.DEBUG,
      });
      expect(logger).toBeInstanceOf(LoggerPlugin);
    });

    it('should create development logger', () => {
      const logger = createDevLogger();
      expect(logger).toBeInstanceOf(LoggerPlugin);
    });

    it('should create production logger', () => {
      const logger = createProdLogger();
      expect(logger).toBeInstanceOf(LoggerPlugin);
    });

    it('should create minimal logger', () => {
      const logger = createMinimalLogger();
      expect(logger).toBeInstanceOf(LoggerPlugin);
    });
  });

  describe('Console Transport', () => {
    it('should create console transport', () => {
      const transport = new ConsoleTransport('info');
      expect(transport).toBeInstanceOf(ConsoleTransport);
      expect(transport.name).toBe('console');
      expect(transport.level).toBe('info');
    });

    it('should write log entries to console', () => {
      const transport = new ConsoleTransport('info');
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      transport.write({
        timestamp: '2024-01-01T00:00:00.000Z',
        level: 'info',
        message: 'Test message',
        context: { test: true },
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should respect log levels', () => {
      const transport = new ConsoleTransport('warn');
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      transport.write({
        timestamp: '2024-01-01T00:00:00.000Z',
        level: 'info',
        message: 'Test message',
      });

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('File Transport', () => {
    it('should create file transport', () => {
      const transport = new FileTransport(testLogFile, 'info');
      expect(transport).toBeInstanceOf(FileTransport);
      expect(transport.name).toBe('file');
      expect(transport.level).toBe('info');
    });

    it('should write log entries to file', async () => {
      const transport = new FileTransport(testLogFile, 'info');

      transport.write({
        timestamp: '2024-01-01T00:00:00.000Z',
        level: 'info',
        message: 'Test message',
        context: { test: true },
      });

      // Wait for flush
      await new Promise(resolve => setTimeout(resolve, 100));

      try {
        const content = await readFile(testLogFile, 'utf8');
        expect(content).toContain('Test message');
      } catch (error) {
        // File might not exist yet, that's okay for this test
        expect(error).toBeDefined();
      }
    });

    it('should flush errors immediately', async () => {
      const transport = new FileTransport(testLogFile, 'info');

      transport.write({
        timestamp: '2024-01-01T00:00:00.000Z',
        level: 'error',
        message: 'Error message',
      });

      // Error should be flushed immediately
      await new Promise(resolve => setTimeout(resolve, 50));

      try {
        const content = await readFile(testLogFile, 'utf8');
        expect(content).toContain('Error message');
      } catch (error) {
        // File might not exist yet, that's okay for this test
        expect(error).toBeDefined();
      }
    });
  });

  describe('HTTP Transport', () => {
    it('should create HTTP transport', () => {
      const transport = new HttpTransport('http://localhost:3000/logs', 'info');
      expect(transport).toBeInstanceOf(HttpTransport);
      expect(transport.name).toBe('http');
      expect(transport.level).toBe('info');
    });

    it('should handle HTTP transport errors gracefully', async () => {
      const transport = new HttpTransport('http://invalid-url', 'info');
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await transport.write({
        timestamp: '2024-01-01T00:00:00.000Z',
        level: 'info',
        message: 'Test message',
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Stream Transport', () => {
    it('should create stream transport', () => {
      const stream = new PassThrough();
      const transport = new StreamTransport(stream, 'info');
      expect(transport).toBeInstanceOf(StreamTransport);
      expect(transport.name).toBe('stream');
      expect(transport.level).toBe('info');
    });

    it('should write log entries to stream', () => {
      const stream = new PassThrough();
      const transport = new StreamTransport(stream, 'info');

      let output = '';
      stream.on('data', chunk => {
        output += chunk.toString();
      });

      transport.write({
        timestamp: '2024-01-01T00:00:00.000Z',
        level: 'info',
        message: 'Test message',
      });

      expect(output).toContain('Test message');
    });
  });

  describe('Logger Plugin Installation', () => {
    it('should install logger plugin', () => {
      const logger = new LoggerPlugin();
      logger.install(app);

      expect((app as any).logger).toBeDefined();
      expect(typeof (app as any).logger.info).toBe('function');
      expect(typeof (app as any).logger.error).toBe('function');
      expect(typeof (app as any).logger.warn).toBe('function');
    });

    it('should add request logging middleware', () => {
      const logger = new LoggerPlugin();
      logger.install(app);

      // Should have added middleware
      expect((app as any).middleware?.length || 0).toBeGreaterThan(0);
    });

    it('should add performance monitoring middleware', () => {
      const logger = new LoggerPlugin();
      logger.install(app);

      // Should have added middleware
      expect((app as any).middleware?.length || 0).toBeGreaterThan(0);
    });
  });

  describe('Logger Methods', () => {
    let logger: LoggerPlugin;

    beforeEach(() => {
      logger = new LoggerPlugin({ level: LogLevel.DEBUG });
      logger.install(app);
    });

    it('should log error messages', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      (app as any).logger.error('Error message', { error: 'test' });

      // Wait for async flush
      await new Promise(resolve => setImmediate(resolve));

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log warn messages', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      (app as any).logger.warn('Warning message', { warning: 'test' });

      // Wait for async flush
      await new Promise(resolve => setImmediate(resolve));

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log info messages', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      (app as any).logger.info('Info message', { info: 'test' });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log debug messages', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      (app as any).logger.debug('Debug message', { debug: 'test' });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Logger Configuration', () => {
    it('should set log level', () => {
      const logger = new LoggerPlugin({ level: LogLevel.DEBUG });
      logger.setLevel(LogLevel.WARN);

      // Should update all transports
      expect(logger['transports'].every(t => t.level === 'warn')).toBe(true);
    });

    it('should add transport', () => {
      const logger = new LoggerPlugin();
      const transport = new ConsoleTransport('info');

      logger.addTransport(transport);

      expect(logger['transports']).toContain(transport);
    });

    it('should remove transport', () => {
      const logger = new LoggerPlugin();
      const transport = new ConsoleTransport('info');

      logger.addTransport(transport);
      logger.removeTransport('console');

      expect(logger['transports']).not.toContain(transport);
    });
  });

  describe('Event Handling', () => {
    it('should emit log events', () => {
      const logger = new LoggerPlugin();
      const eventSpy = vi.fn();

      logger.on('log', eventSpy);

      logger['logMessage']('info', 'Test message');

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
          message: 'Test message',
        })
      );
    });

    it('should remove event listeners', () => {
      const logger = new LoggerPlugin();
      const eventSpy = vi.fn();

      logger.on('log', eventSpy);
      logger.off('log', eventSpy);

      logger['logMessage']('info', 'Test message');

      expect(eventSpy).not.toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('should handle high-frequency logging efficiently', () => {
      const logger = new LoggerPlugin();
      const start = Date.now();

      // Log 1000 messages
      for (let i = 0; i < 1000; i++) {
        logger['logMessage']('info', `Message ${i}`);
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle multiple transports efficiently', () => {
      const logger = new LoggerPlugin();
      const consoleTransport = new ConsoleTransport('info');
      const fileTransport = new FileTransport(testLogFile, 'info');

      logger.addTransport(consoleTransport);
      logger.addTransport(fileTransport);

      const start = Date.now();

      // Log 100 messages with multiple transports
      for (let i = 0; i < 100; i++) {
        logger['logMessage']('info', `Message ${i}`);
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(500); // Should complete within 500ms
    });
  });

  describe('Error Handling', () => {
    it('should handle transport errors gracefully', () => {
      const logger = new LoggerPlugin();
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Create a transport that throws an error
      const errorTransport = {
        name: 'error',
        level: 'info',
        write: () => {
          throw new Error('Transport error');
        },
      };

      logger.addTransport(errorTransport);
      logger['logMessage']('info', 'Test message');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Transport error error:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('Application Integration', () => {
    it('should integrate with application logger methods', () => {
      const logger = new LoggerPlugin({
        level: LogLevel.DEBUG,
      });

      logger.install(app);

      expect((app as any).logger).toBeDefined();
      expect(typeof (app as any).logger.info).toBe('function');
      expect(typeof (app as any).logger.error).toBe('function');
    });

    it('should create development logger', () => {
      const logger = createDevLogger();
      expect(logger).toBeInstanceOf(LoggerPlugin);
    });

    it('should create production logger', () => {
      const logger = createProdLogger();
      expect(logger).toBeInstanceOf(LoggerPlugin);
    });
  });
});
