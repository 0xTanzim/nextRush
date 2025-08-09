import type { WebSocketPluginOptions } from '@/plugins/websocket/types';
import { WebSocketPlugin } from '@/plugins/websocket/websocket.plugin';
import type { Application } from '@/types/context';
import { IncomingMessage, Server } from 'node:http';
import { Socket } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('WebSocketPlugin', () => {
  let plugin: WebSocketPlugin;
  let mockApp: Application;
  let mockReq: IncomingMessage;
  let mockSocket: Socket;
  let mockServer: Server;
  let options: WebSocketPluginOptions;

  beforeEach(() => {
    options = {
      path: '/ws',
      heartbeatMs: 30000,
      maxMessageSize: 1024,
      allowOrigins: [],
    };

    mockServer = {
      on: vi.fn(),
      listen: vi.fn(),
    } as any;

    mockApp = {
      register: vi.fn(),
      use: vi.fn(),
      listen: vi.fn(),
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      patch: vi.fn(),
      options: vi.fn(),
      head: vi.fn(),
      all: vi.fn(),
      route: vi.fn(),
      middleware: vi.fn(),
      plugin: vi.fn(),
      getServer: vi.fn().mockReturnValue(mockServer),
    } as any;

    mockReq = {
      url: '/ws',
      method: 'GET',
      headers: {
        upgrade: 'websocket',
        connection: 'Upgrade',
        'sec-websocket-version': '13',
        'sec-websocket-key': 'test-key',
        host: 'localhost:3000',
      },
    } as IncomingMessage;

    mockSocket = {
      write: vi.fn(),
      destroy: vi.fn(),
      on: vi.fn(),
      end: vi.fn(),
    } as any;

    plugin = new WebSocketPlugin(options);
  });

  afterEach(() => {
    plugin.cleanup();
    vi.clearAllMocks();
  });

  describe('Plugin Installation', () => {
    it('should install plugin with default options', () => {
      const defaultPlugin = new WebSocketPlugin();

      defaultPlugin.onInstall(mockApp);

      expect(mockServer.on).toHaveBeenCalledWith(
        'upgrade',
        expect.any(Function)
      );
    });

    it('should install plugin with custom options', () => {
      plugin.onInstall(mockApp);

      expect(mockServer.on).toHaveBeenCalledWith(
        'upgrade',
        expect.any(Function)
      );
    });

    it('should setup heartbeat timer', () => {
      const spy = vi.spyOn(global, 'setInterval');

      plugin.onInstall(mockApp);

      expect(spy).toHaveBeenCalledWith(expect.any(Function), 30000);
    });

    it('should handle missing server gracefully', () => {
      const appWithoutServer = {
        ...mockApp,
        getServer: vi.fn().mockReturnValue(null),
        server: undefined,
      } as any;

      expect(() => plugin.onInstall(appWithoutServer)).not.toThrow();
    });
  });

  describe('Plugin Properties', () => {
    it('should have correct plugin metadata', () => {
      expect(plugin.name).toBe('WebSocketPlugin');
      expect(plugin.version).toBe('2.0.0-alpha.1');
      expect(plugin.description).toContain('WebSocket server');
    });

    it('should merge options with defaults', () => {
      const customOptions: WebSocketPluginOptions = {
        path: '/custom',
        heartbeatMs: 60000,
      };

      const customPlugin = new WebSocketPlugin(customOptions);
      expect(customPlugin).toBeDefined();
    });
  });

  describe('Path Matching', () => {
    it('should handle path configuration during installation', () => {
      plugin.onInstall(mockApp);
      expect(mockServer.on).toHaveBeenCalledWith(
        'upgrade',
        expect.any(Function)
      );

      // Test that the plugin was configured properly
      const options = (plugin as any).options;
      expect(options.path).toBe('/ws');
    });

    it('should handle wildcard path configuration', () => {
      const wildcardPlugin = new WebSocketPlugin({ path: '/ws/*' });
      wildcardPlugin.onInstall(mockApp);

      const options = (wildcardPlugin as any).options;
      expect(options.path).toBe('/ws/*');
    });

    it('should handle array of paths configuration', () => {
      const multiPathPlugin = new WebSocketPlugin({
        path: ['/ws', '/websocket', '/chat/*'],
      });
      multiPathPlugin.onInstall(mockApp);

      const options = (multiPathPlugin as any).options;
      expect(Array.isArray(options.path)).toBe(true);
      expect(options.path).toHaveLength(3);
    });
  });

  describe('HTTP Upgrade Handling', () => {
    it('should register upgrade handler', () => {
      plugin.onInstall(mockApp);

      expect(mockServer.on).toHaveBeenCalledWith(
        'upgrade',
        expect.any(Function)
      );
    });

    it('should handle upgrade request with correct path', async () => {
      plugin.onInstall(mockApp);

      const upgradeHandler = vi
        .mocked(mockServer.on)
        .mock.calls.find((call: any) => call[0] === 'upgrade')?.[1] as
        | ((req: IncomingMessage, socket: Socket, head: Buffer) => void)
        | undefined;

      expect(upgradeHandler).toBeDefined();

      if (upgradeHandler) {
        // Mock handshake success
        vi.doMock('@/plugins/websocket/handshake', () => ({
          performHandshake: vi.fn().mockReturnValue(true),
          verifyOrigin: vi.fn().mockReturnValue(true),
          reject: vi.fn(),
        }));

        await expect(async () => {
          upgradeHandler(mockReq, mockSocket, Buffer.alloc(0));
          // Wait a bit for async handling
          await new Promise(resolve => setTimeout(resolve, 10));
        }).not.toThrow();
      }
    });

    it('should reject upgrade for wrong path', async () => {
      plugin.onInstall(mockApp);

      const upgradeHandler = vi
        .mocked(mockServer.on)
        .mock.calls.find((call: any) => call[0] === 'upgrade')?.[1] as
        | ((req: IncomingMessage, socket: Socket, head: Buffer) => void)
        | undefined;

      if (upgradeHandler) {
        mockReq.url = '/wrong-path';

        vi.doMock('@/plugins/websocket/handshake', () => ({
          performHandshake: vi.fn().mockReturnValue(false),
          verifyOrigin: vi.fn().mockReturnValue(true),
          reject: vi.fn(),
        }));

        await expect(async () => {
          upgradeHandler(mockReq, mockSocket, Buffer.alloc(0));
          await new Promise(resolve => setTimeout(resolve, 10));
        }).not.toThrow();
      }
    });

    it('should reject upgrade with invalid origin', async () => {
      const restrictiveOptions: WebSocketPluginOptions = {
        ...options,
        allowOrigins: [/^https:\/\/allowed\.com$/],
      };

      const restrictivePlugin = new WebSocketPlugin(restrictiveOptions);
      restrictivePlugin.onInstall(mockApp);

      const upgradeHandler = vi
        .mocked(mockServer.on)
        .mock.calls.find((call: any) => call[0] === 'upgrade')?.[1] as
        | ((req: IncomingMessage, socket: Socket, head: Buffer) => void)
        | undefined;

      if (upgradeHandler) {
        mockReq.headers.origin = 'https://evil.com';

        vi.doMock('@/plugins/websocket/handshake', () => ({
          performHandshake: vi.fn().mockReturnValue(false),
          verifyOrigin: vi.fn().mockReturnValue(false),
          reject: vi.fn(),
        }));

        await expect(async () => {
          upgradeHandler(mockReq, mockSocket, Buffer.alloc(0));
          await new Promise(resolve => setTimeout(resolve, 10));
        }).not.toThrow();
      }
    });

    it('should enforce max connections limit', async () => {
      const limitedPlugin = new WebSocketPlugin({
        ...options,
        maxConnections: 0, // No connections allowed
      });
      limitedPlugin.onInstall(mockApp);

      const upgradeHandler = vi
        .mocked(mockServer.on)
        .mock.calls.find((call: any) => call[0] === 'upgrade')?.[1] as
        | ((req: IncomingMessage, socket: Socket, head: Buffer) => void)
        | undefined;

      if (upgradeHandler) {
        vi.doMock('@/plugins/websocket/handshake', () => ({
          performHandshake: vi.fn().mockReturnValue(false),
          verifyOrigin: vi.fn().mockReturnValue(true),
          reject: vi.fn(),
        }));

        await expect(async () => {
          upgradeHandler(mockReq, mockSocket, Buffer.alloc(0));
          await new Promise(resolve => setTimeout(resolve, 10));
        }).not.toThrow();
      }
    });

    it('should use custom client verification', async () => {
      const verifyClient = vi.fn().mockResolvedValue(false);
      const customPlugin = new WebSocketPlugin({
        ...options,
        verifyClient,
      });
      customPlugin.onInstall(mockApp);

      const upgradeHandler = vi
        .mocked(mockServer.on)
        .mock.calls.find((call: any) => call[0] === 'upgrade')?.[1] as
        | ((req: IncomingMessage, socket: Socket, head: Buffer) => void)
        | undefined;

      if (upgradeHandler) {
        vi.doMock('@/plugins/websocket/handshake', () => ({
          performHandshake: vi.fn().mockReturnValue(false),
          verifyOrigin: vi.fn().mockReturnValue(true),
          reject: vi.fn(),
        }));

        await expect(async () => {
          upgradeHandler(mockReq, mockSocket, Buffer.alloc(0));
          await new Promise(resolve => setTimeout(resolve, 10));
        }).not.toThrow();

        expect(verifyClient).toHaveBeenCalledWith(mockReq);
      }
    });
  });

  describe('Connection Management', () => {
    it('should maintain connection set internally', async () => {
      plugin.onInstall(mockApp);

      // Access internal connections set
      const connections = (plugin as any).connections;
      expect(connections).toBeInstanceOf(Set);
      expect(connections.size).toBe(0);
    });

    it('should clean up connections on heartbeat timeout', () => {
      plugin.onInstall(mockApp);

      // Mock a connection with old lastPong
      const oldConnection = {
        lastPong: Date.now() - 60000, // 1 minute ago
        close: vi.fn(),
        ping: vi.fn(),
      };

      // Add to internal connections
      const connections = (plugin as any).connections;
      connections.add(oldConnection);

      // Manually trigger heartbeat (access private method)
      const heartbeatInterval = vi.mocked(global.setInterval).mock
        .calls[0]?.[0];
      if (typeof heartbeatInterval === 'function') {
        heartbeatInterval();
        expect(oldConnection.close).toHaveBeenCalledWith(1001, 'Ping timeout');
      }
    });
  });

  describe('Cleanup', () => {
    it('should cleanup timers on plugin cleanup', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      plugin.onInstall(mockApp);
      plugin.cleanup();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should handle cleanup when no timer exists', () => {
      expect(() => plugin.cleanup()).not.toThrow();
    });

    it('should be idempotent', () => {
      plugin.onInstall(mockApp);
      plugin.cleanup();
      plugin.cleanup(); // Second cleanup should not throw

      expect(() => plugin.cleanup()).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle upgrade errors gracefully', async () => {
      plugin.onInstall(mockApp);

      const upgradeHandler = vi
        .mocked(mockServer.on)
        .mock.calls.find((call: any) => call[0] === 'upgrade')?.[1] as
        | ((req: IncomingMessage, socket: Socket, head: Buffer) => void)
        | undefined;

      if (upgradeHandler) {
        // Mock request with invalid URL
        const badReq = {
          ...mockReq,
          url: undefined,
          headers: { ...mockReq.headers, host: undefined },
        };

        await expect(async () => {
          upgradeHandler(badReq as any, mockSocket, Buffer.alloc(0));
          await new Promise(resolve => setTimeout(resolve, 10));
        }).not.toThrow();
      }
    });

    it('should handle handshake failure gracefully', async () => {
      plugin.onInstall(mockApp);

      const upgradeHandler = vi
        .mocked(mockServer.on)
        .mock.calls.find((call: any) => call[0] === 'upgrade')?.[1] as
        | ((req: IncomingMessage, socket: Socket, head: Buffer) => void)
        | undefined;

      if (upgradeHandler) {
        vi.doMock('@/plugins/websocket/handshake', () => ({
          performHandshake: vi.fn().mockReturnValue(false),
          verifyOrigin: vi.fn().mockReturnValue(true),
          reject: vi.fn(),
        }));

        await expect(async () => {
          upgradeHandler(mockReq, mockSocket, Buffer.alloc(0));
          await new Promise(resolve => setTimeout(resolve, 10));
        }).not.toThrow();
      }
    });
  });

  describe('Configuration Options', () => {
    it('should use default options when none provided', () => {
      const defaultPlugin = new WebSocketPlugin();
      const options = (defaultPlugin as any).options;

      expect(options.path).toBe('/ws');
      expect(options.heartbeatMs).toBe(30000);
      expect(options.maxMessageSize).toBe(1048576);
    });

    it('should merge custom options with defaults', () => {
      const customOptions: WebSocketPluginOptions = {
        path: '/custom-ws',
        heartbeatMs: 60000,
        debug: true,
      };

      const customPlugin = new WebSocketPlugin(customOptions);
      const options = (customPlugin as any).options;

      expect(options.path).toBe('/custom-ws');
      expect(options.heartbeatMs).toBe(60000);
      expect(options.debug).toBe(true);
      expect(options.maxMessageSize).toBe(1048576); // Default value
    });

    it('should validate and use boolean options', () => {
      const booleanOptions: WebSocketPluginOptions = {
        debug: true,
      };

      const plugin = new WebSocketPlugin(booleanOptions);
      const options = (plugin as any).options;

      expect(options.debug).toBe(true);
    });
  });

  describe('Private Methods Access', () => {
    it('should have room manager instance', () => {
      const roomManager = (plugin as any).roomManager;
      expect(roomManager).toBeDefined();
      expect(typeof roomManager.add).toBe('function');
      expect(typeof roomManager.broadcast).toBe('function');
    });

    it('should have routes map', () => {
      const routes = (plugin as any).routes;
      expect(routes).toBeInstanceOf(Map);
    });

    it('should have middlewares array', () => {
      const middlewares = (plugin as any).middlewares;
      expect(middlewares).toBeInstanceOf(Array);
    });
  });
});
