/**
 * Server Lifecycle Unit Tests
 */

import {
  createHttpServer,
  createServerLifecycle,
  shutdownServer,
  startServer,
} from '@/core/app/server-lifecycle';
import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock http module
vi.mock('node:http', () => ({
  createServer: vi.fn((handler) => {
    const server = {
      keepAliveTimeout: 0,
      requestTimeout: 0,
      headersTimeout: 0,
      listen: vi.fn((_port, _host, cb) => cb?.()),
      close: vi.fn((cb) => cb?.()),
      unref: vi.fn(),
      _handler: handler,
    };
    return server;
  }),
}));

describe('Server Lifecycle', () => {
  let emitter: EventEmitter;

  beforeEach(() => {
    emitter = new EventEmitter();
    vi.clearAllMocks();
  });

  afterEach(() => {
    emitter.removeAllListeners();
  });

  describe('createHttpServer', () => {
    it('should create a server with proper timeouts', () => {
      const config = {
        options: {
          keepAlive: 5000,
          timeout: 10000,
        } as any,
        requestHandler: vi.fn(),
        emitter,
      };

      const server = createHttpServer(config);

      expect(server.keepAliveTimeout).toBe(5000);
      expect(server.requestTimeout).toBe(10000);
      expect(server.headersTimeout).toBe(6000); // keepAlive + 1000
    });
  });

  describe('startServer', () => {
    it('should start server and emit listening event', async () => {
      const server = {
        listen: vi.fn((_port, _host, cb) => cb?.()),
      } as any;

      const listenerSpy = vi.fn();
      emitter.on('listening', listenerSpy);

      const callback = vi.fn();
      await startServer(server, 3000, 'localhost', emitter, callback);

      expect(server.listen).toHaveBeenCalledWith(3000, 'localhost', expect.any(Function));
      expect(listenerSpy).toHaveBeenCalledWith({ port: 3000, host: 'localhost' });
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('shutdownServer', () => {
    it('should shutdown server and emit events', async () => {
      const server = {
        close: vi.fn((cb) => cb?.()),
        unref: vi.fn(),
      } as any;

      const shutdownSpy = vi.fn();
      const closedSpy = vi.fn();
      emitter.on('shutdown', shutdownSpy);
      emitter.on('closed', closedSpy);

      await shutdownServer(server, emitter, 5000);

      expect(shutdownSpy).toHaveBeenCalled();
      expect(closedSpy).toHaveBeenCalled();
      expect(server.close).toHaveBeenCalled();
    });
  });

  describe('createServerLifecycle', () => {
    it('should create server lifecycle manager', () => {
      const config = {
        options: {
          keepAlive: 5000,
          timeout: 10000,
        } as any,
        requestHandler: vi.fn(),
        emitter,
      };

      const lifecycle = createServerLifecycle(config);

      expect(lifecycle.server).toBeDefined();
      expect(typeof lifecycle.listen).toBe('function');
      expect(typeof lifecycle.shutdown).toBe('function');
    });
  });
});
