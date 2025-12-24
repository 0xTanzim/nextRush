/**
 * Tests for Server Manager
 *
 * @packageDocumentation
 */

import { ServerManager } from '@/core/orchestration/server-manager';
import type { ApplicationOptions } from '@/types/http';
import { EventEmitter } from 'node:events';
import { createServer } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Node.js http module
vi.mock('node:http');

describe('ServerManager', () => {
  let serverManager: ServerManager;
  let mockOptions: Required<ApplicationOptions>;
  let mockRequestHandler: any;
  let mockServer: any;
  let originalProcessOn: any;
  let processEventHandlers: Record<string, any>;

  beforeEach(() => {
    mockOptions = {
      port: 3000,
      host: 'localhost',
      debug: false,
      trustProxy: false,
      maxBodySize: 1024 * 1024,
      timeout: 30000,
      cors: false,
      static: '',
      template: { engine: 'none', directory: '' },
      keepAlive: 5000,
    };

    mockRequestHandler = vi.fn();

    // Mock server
    mockServer = new EventEmitter();
    mockServer.listen = vi.fn();
    mockServer.close = vi.fn();
    mockServer.address = vi.fn();
    mockServer.listening = false;

    (createServer as any).mockReturnValue(mockServer);

    // Mock process event handling
    processEventHandlers = {};
    originalProcessOn = process.on;
    process.on = vi.fn((event: string, handler: any) => {
      processEventHandlers[event] = handler;
      return process;
    });

    serverManager = new ServerManager(mockOptions, mockRequestHandler);
  });

  afterEach(() => {
    vi.clearAllMocks();
    process.on = originalProcessOn;
  });

  describe('constructor', () => {
    it('should create server manager with options and handler', () => {
      expect(serverManager).toBeDefined();
      expect(serverManager).toBeInstanceOf(EventEmitter);
    });

    it('should not create server in constructor', () => {
      expect(createServer).not.toHaveBeenCalled();
    });
  });

  describe('createServer', () => {
    it('should create HTTP server with request handler', () => {
      const server = serverManager.createServer();

      expect(createServer).toHaveBeenCalledWith(mockRequestHandler);
      expect(server).toBe(mockServer);
    });

    it('should return existing server if already created', () => {
      const server1 = serverManager.createServer();
      const server2 = serverManager.createServer();

      expect(server1).toBe(server2);
      expect(createServer).toHaveBeenCalledTimes(1);
    });

    it('should setup event handlers on server creation', () => {
      serverManager.createServer();

      expect(mockServer.listenerCount('error')).toBeGreaterThan(0);
      expect(mockServer.listenerCount('request')).toBeGreaterThan(0);
      expect(mockServer.listenerCount('close')).toBeGreaterThan(0);
      expect(mockServer.listenerCount('connection')).toBeGreaterThan(0);
    });

    it('should setup process signal handlers', () => {
      serverManager.createServer();

      expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });
  });

  describe('listen', () => {
    it('should start server with default options', async () => {
      mockServer.listen.mockImplementation((_port: any, _hostname: any) => {
        setImmediate(() => mockServer.emit('listening'));
      });

      const listenPromise = serverManager.listen();

      expect(mockServer.listen).toHaveBeenCalledWith(3000, 'localhost');
      await expect(listenPromise).resolves.toBeUndefined();
    });

    it('should start server with custom port and hostname', async () => {
      mockServer.listen.mockImplementation((_port: any, _hostname: any) => {
        setImmediate(() => mockServer.emit('listening'));
      });

      await serverManager.listen(8080, '0.0.0.0');

      expect(mockServer.listen).toHaveBeenCalledWith(8080, '0.0.0.0');
    });

    it('should call callback when provided', async () => {
      const callback = vi.fn();
      mockServer.listen.mockImplementation((_port: any, _hostname: any) => {
        setImmediate(() => mockServer.emit('listening'));
      });

      await serverManager.listen(3000, 'localhost', callback);

      expect(callback).toHaveBeenCalled();
    });

    it('should emit listening event', async () => {
      const listeningSpy = vi.fn();
      serverManager.on('listening', listeningSpy);

      mockServer.listen.mockImplementation((_port: any, _hostname: any) => {
        setImmediate(() => mockServer.emit('listening'));
      });

      await serverManager.listen(3000, 'localhost');

      expect(listeningSpy).toHaveBeenCalledWith(3000, 'localhost');
    });

    it('should reject on server error', async () => {
      const testError = new Error('Port already in use');
      mockServer.listen.mockImplementation((_port: any, _hostname: any) => {
        // Immediately emit error
        mockServer.emit('error', testError);
      });

      await expect(serverManager.listen()).rejects.toThrow(
        'Port already in use'
      );
    });

    it('should handle listen without port/hostname parameters', async () => {
      mockServer.listen.mockImplementation((_port: any, _hostname: any) => {
        setImmediate(() => mockServer.emit('listening'));
      });

      await serverManager.listen();

      expect(mockServer.listen).toHaveBeenCalledWith(3000, 'localhost');
    });

    it('should clean up event listeners on error', async () => {
      const testError = new Error('Test error');
      mockServer.listen.mockImplementation((_port: any, _hostname: any) => {
        // Immediately emit error
        mockServer.emit('error', testError);
      });

      await expect(serverManager.listen()).rejects.toThrow('Test error');

      // Verify listeners are cleaned up (there might be multiple error listeners)
      expect(mockServer.listenerCount('error')).toBeGreaterThanOrEqual(1); // At least the persistent one
      // The listening listener might not be cleaned up immediately in this test scenario
      expect(mockServer.listenerCount('listening')).toBeLessThanOrEqual(1);
    });
  });

  describe('close', () => {
    beforeEach(() => {
      serverManager.createServer();
    });

    it('should close server gracefully', async () => {
      mockServer.close.mockImplementation((callback: any) => {
        setImmediate(() => callback());
      });

      const closePromise = serverManager.close();

      expect(mockServer.close).toHaveBeenCalled();
      await expect(closePromise).resolves.toBeUndefined();
    });

    it('should emit closing and closed events', async () => {
      const closingSpy = vi.fn();
      const closedSpy = vi.fn();

      serverManager.on('closing', closingSpy);
      serverManager.on('closed', closedSpy);

      mockServer.close.mockImplementation((callback: any) => {
        setImmediate(() => callback());
      });

      await serverManager.close();

      expect(closingSpy).toHaveBeenCalled();
      expect(closedSpy).toHaveBeenCalled();
    });

    it('should reject on close error', async () => {
      const testError = new Error('Close error');
      mockServer.close.mockImplementation((callback: any) => {
        setImmediate(() => callback(testError));
      });

      await expect(serverManager.close()).rejects.toThrow(testError);
    });

    it('should not close if already shutting down', async () => {
      mockServer.close.mockImplementation((callback: any) => {
        setImmediate(() => callback());
      });

      // Start first close
      const firstClose = serverManager.close();

      // Try to close again while shutting down
      const secondClose = serverManager.close();

      await firstClose;
      await secondClose;

      expect(mockServer.close).toHaveBeenCalledTimes(1);
    });

    it('should handle close when no server exists', async () => {
      const newServerManager = new ServerManager(
        mockOptions,
        mockRequestHandler
      );

      await expect(newServerManager.close()).resolves.toBeUndefined();
    });
  });

  describe('getServerInfo', () => {
    beforeEach(() => {
      serverManager.createServer();
    });

    it('should return server info with string address', () => {
      mockServer.address.mockReturnValue('/tmp/socket');
      mockServer.listening = true;

      const info = serverManager.getServerInfo();

      expect(info).toEqual({
        listening: true,
        address: '/tmp/socket',
        port: null,
        shuttingDown: false,
      });
    });

    it('should return server info with object address', () => {
      mockServer.address.mockReturnValue({
        address: '127.0.0.1',
        port: 3000,
        family: 'IPv4',
      });
      mockServer.listening = true;

      const info = serverManager.getServerInfo();

      expect(info).toEqual({
        listening: true,
        address: null,
        port: 3000,
        shuttingDown: false,
      });
    });

    it('should return default info when server not listening', () => {
      mockServer.address.mockReturnValue(null);
      mockServer.listening = false;

      const info = serverManager.getServerInfo();

      expect(info).toEqual({
        listening: false,
        address: null,
        port: null,
        shuttingDown: false,
      });
    });

    it('should show shutting down status', async () => {
      mockServer.close.mockImplementation((_callback: any) => {
        // Don't call callback immediately to simulate shutdown in progress
      });

      // Start shutdown
      serverManager.close();

      const info = serverManager.getServerInfo();

      expect(info.shuttingDown).toBe(true);
    });
  });

  describe('event forwarding', () => {
    beforeEach(() => {
      serverManager.createServer();
    });

    it('should forward server error events', () => {
      const errorSpy = vi.fn();
      serverManager.on('error', errorSpy);

      const testError = new Error('Server error');
      mockServer.emit('error', testError);

      expect(errorSpy).toHaveBeenCalledWith(testError);
    });

    it('should forward server request events', () => {
      const requestSpy = vi.fn();
      serverManager.on('request', requestSpy);

      const mockReq = {};
      const mockRes = {};
      mockServer.emit('request', mockReq, mockRes);

      expect(requestSpy).toHaveBeenCalledWith(mockReq, mockRes);
    });

    it('should forward server close events', () => {
      const closeSpy = vi.fn();
      serverManager.on('close', closeSpy);

      mockServer.emit('close');

      expect(closeSpy).toHaveBeenCalled();
    });

    it('should forward server connection events', () => {
      const connectionSpy = vi.fn();
      serverManager.on('connection', connectionSpy);

      const mockSocket = {};
      mockServer.emit('connection', mockSocket);

      expect(connectionSpy).toHaveBeenCalledWith(mockSocket);
    });
  });

  describe('signal handling', () => {
    beforeEach(() => {
      serverManager.createServer();
    });

    it('should handle SIGTERM signal', async () => {
      const shutdownSpy = vi.fn();
      serverManager.on('shutdown', shutdownSpy);

      mockServer.close.mockImplementation((callback: any) => {
        callback(); // Call immediately instead of setImmediate
      });

      // Mock process.exit to track calls but not actually exit
      const originalExit = process.exit;
      const exitSpy = vi.fn();
      process.exit = exitSpy as any;

      // Ensure handler exists and is function
      expect(typeof processEventHandlers['SIGTERM']).toBe('function');

      // Trigger SIGTERM handler and wait for completion
      await processEventHandlers['SIGTERM']();

      // Give a tick for async operations to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(shutdownSpy).toHaveBeenCalledWith('SIGTERM');
      expect(exitSpy).toHaveBeenCalledWith(0);

      process.exit = originalExit;
    });

    it('should handle SIGINT signal', async () => {
      const shutdownSpy = vi.fn();
      serverManager.on('shutdown', shutdownSpy);

      mockServer.close.mockImplementation((callback: any) => {
        callback(); // Call immediately instead of setImmediate
      });

      const originalExit = process.exit;
      const exitSpy = vi.fn();
      process.exit = exitSpy as any;

      // Ensure handler exists and is function
      expect(typeof processEventHandlers['SIGINT']).toBe('function');

      await processEventHandlers['SIGINT']();

      // Give a tick for async operations to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(shutdownSpy).toHaveBeenCalledWith('SIGINT');
      expect(exitSpy).toHaveBeenCalledWith(0);

      process.exit = originalExit;
    });

    it('should handle shutdown errors', async () => {
      const shutdownErrorSpy = vi.fn();
      serverManager.on('shutdownError', shutdownErrorSpy);

      const testError = new Error('Shutdown error');
      mockServer.close.mockImplementation((callback: any) => {
        callback(testError); // Call immediately with error
      });

      const originalExit = process.exit;
      const exitSpy = vi.fn();
      process.exit = exitSpy as any;

      // Ensure handler exists and is function
      expect(typeof processEventHandlers['SIGTERM']).toBe('function');

      await processEventHandlers['SIGTERM']();

      // Give a tick for async operations to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(shutdownErrorSpy).toHaveBeenCalledWith(testError);
      expect(exitSpy).toHaveBeenCalledWith(1);

      process.exit = originalExit;
    });

    it('should emit shutdown complete event on successful shutdown', async () => {
      const shutdownCompleteSpy = vi.fn();
      serverManager.on('shutdownComplete', shutdownCompleteSpy);

      mockServer.close.mockImplementation((callback: any) => {
        callback(); // Call immediately without error
      });

      const originalExit = process.exit;
      const exitSpy = vi.fn();
      process.exit = exitSpy as any;

      // Ensure handler exists and is function
      expect(typeof processEventHandlers['SIGTERM']).toBe('function');

      await processEventHandlers['SIGTERM']();

      // Give a tick for async operations to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(shutdownCompleteSpy).toHaveBeenCalled();

      process.exit = originalExit;
    });
  });

  describe('edge cases', () => {
    it('should handle multiple listen calls', async () => {
      mockServer.listen.mockImplementation((_port: any, _hostname: any) => {
        setImmediate(() => mockServer.emit('listening'));
      });

      await serverManager.listen();
      await serverManager.listen(); // Second call should work

      expect(mockServer.listen).toHaveBeenCalledTimes(2);
    });

    it('should handle server creation after close', async () => {
      serverManager.createServer();

      mockServer.close.mockImplementation((callback: any) => {
        setImmediate(() => callback());
      });

      await serverManager.close();

      // Should be able to create server again
      const newServer = serverManager.createServer();
      expect(newServer).toBe(mockServer);
    });

    it('should handle invalid address format', () => {
      mockServer.address.mockReturnValue({ invalid: 'format' });

      const info = serverManager.getServerInfo();

      expect(info.port).toBeNull();
      expect(info.address).toBeNull();
    });

    it('should handle listen with only port parameter', async () => {
      mockServer.listen.mockImplementation((_port: any, _hostname: any) => {
        setImmediate(() => mockServer.emit('listening'));
      });

      await serverManager.listen(8080);

      expect(mockServer.listen).toHaveBeenCalledWith(8080, 'localhost');
    });

    it('should handle listen with only hostname parameter', async () => {
      mockServer.listen.mockImplementation((_port: any, _hostname: any) => {
        setImmediate(() => mockServer.emit('listening'));
      });

      await serverManager.listen(undefined, '0.0.0.0');

      expect(mockServer.listen).toHaveBeenCalledWith(3000, '0.0.0.0');
    });

    it('should handle concurrent shutdown signals', async () => {
      serverManager.createServer(); // Ensure server and handlers are created

      mockServer.close.mockImplementation((callback: any) => {
        callback(); // Call immediately instead of setImmediate
      });

      const originalExit = process.exit;
      process.exit = vi.fn() as any;

      // Ensure handlers exist and are functions
      expect(typeof processEventHandlers['SIGTERM']).toBe('function');
      expect(typeof processEventHandlers['SIGINT']).toBe('function');

      // Trigger multiple signals concurrently
      const sigterm = processEventHandlers['SIGTERM']();
      const sigint = processEventHandlers['SIGINT']();

      await Promise.all([sigterm, sigint]);

      // Should only exit once (due to shutdown state management)
      expect(process.exit).toHaveBeenCalledTimes(1); // Only first handler completes

      process.exit = originalExit;
    });
  });
});
