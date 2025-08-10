/* eslint-disable prefer-template */
import { createApp } from '@/index';
import { WebSocketPlugin } from '@/plugins/websocket/websocket.plugin';
import { createHash } from 'node:crypto';
import { Socket } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// WebSocket constants
const WS_MAGIC_STRING = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

describe('WebSocket Plugin Integration Tests', () => {
  let app: any;
  let server: any;
  const port = 3002;

  beforeAll(async () => {
    app = createApp();

    // Install WebSocket plugin
    const wsPlugin = new WebSocketPlugin();
    wsPlugin.install(app);

    // Add WebSocket route
    app.ws('/test', (ws: any) => {
      ws.send('Hello from server!');

      ws.on('message', (data: string) => {
        ws.send(`Echo: ${data}`);
      });
    });

    // Start server - the server is created when listen is called
    server = app.listen(port);

    // Give server time to start
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    if (server) {
      server.close();
      server = null;
    }
  });

  // Helper function to create WebSocket handshake
  function createWebSocketKey(): string {
    return Buffer.from(Math.random().toString(36)).toString('base64');
  }

  function calculateWebSocketAccept(key: string): string {
    return createHash('sha1')
      .update(key + WS_MAGIC_STRING)
      .digest('base64');
  }

  it('should handle WebSocket handshake correctly', async () => {
    return new Promise<void>((resolve, reject) => {
      const socket = new Socket();
      const websocketKey = createWebSocketKey();
      const expectedAccept = calculateWebSocketAccept(websocketKey);

      socket.connect(port, 'localhost', () => {
        const handshakeRequest = [
          'GET /test HTTP/1.1',
          `Host: localhost:${port}`,
          'Upgrade: websocket',
          'Connection: Upgrade',
          'Sec-WebSocket-Key: ' + websocketKey,
          'Sec-WebSocket-Version: 13',
          '\r\n',
        ].join('\r\n');

        socket.write(handshakeRequest);
      });

      socket.on('data', data => {
        const response = data.toString();

        try {
          expect(response).toContain('HTTP/1.1 101 Switching Protocols');
          expect(response).toContain('Upgrade: websocket');
          expect(response).toContain('Connection: Upgrade');
          expect(response).toContain(`Sec-WebSocket-Accept: ${expectedAccept}`);

          socket.destroy();
          resolve();
        } catch (error) {
          socket.destroy();
          reject(error);
        }
      });

      socket.on('error', error => {
        socket.destroy();
        reject(error);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        socket.destroy();
        reject(new Error('Test timeout'));
      }, 5000);
    });
  });

  it('should reject invalid WebSocket requests', async () => {
    return new Promise<void>((resolve, reject) => {
      const socket = new Socket();

      socket.connect(port, 'localhost', () => {
        const invalidRequest = [
          'GET /test HTTP/1.1',
          `Host: localhost:${port}`,
          'Upgrade: websocket',
          'Connection: Upgrade',
          // Missing required Sec-WebSocket-Key header
          '\r\n',
        ].join('\r\n');

        socket.write(invalidRequest);
      });

      socket.on('data', data => {
        const response = data.toString();

        try {
          // Should receive an error response, not 101
          expect(response).not.toContain('101 Switching Protocols');
          expect(response).toContain('400'); // Bad Request for invalid WebSocket handshake

          socket.destroy();
          resolve();
        } catch (error) {
          socket.destroy();
          reject(error);
        }
      });

      socket.on('error', error => {
        socket.destroy();
        reject(error);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        socket.destroy();
        reject(new Error('Test timeout'));
      }, 5000);
    });
  });

  it('should handle WebSocket route not found', async () => {
    return new Promise<void>((resolve, reject) => {
      const socket = new Socket();
      const websocketKey = createWebSocketKey();

      socket.connect(port, 'localhost', () => {
        const handshakeRequest = [
          'GET /nonexistent HTTP/1.1',
          `Host: localhost:${port}`,
          'Upgrade: websocket',
          'Connection: Upgrade',
          'Sec-WebSocket-Key: ' + websocketKey,
          'Sec-WebSocket-Version: 13',
          '\r\n',
        ].join('\r\n');

        socket.write(handshakeRequest);
      });

      socket.on('data', data => {
        const response = data.toString();

        try {
          // Should receive 404 Not Found
          expect(response).toContain('404');

          socket.destroy();
          resolve();
        } catch (error) {
          socket.destroy();
          reject(error);
        }
      });

      socket.on('error', error => {
        socket.destroy();
        reject(error);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        socket.destroy();
        reject(new Error('Test timeout'));
      }, 5000);
    });
  });

  // Note: For full message testing, we would need to implement WebSocket frame parsing
  // which is complex. The handshake test above validates the core functionality.
  // In a real-world scenario, you could use Node.js built-in WebSocket client
  // (available since v21) if running on a compatible Node.js version.

  it('should validate core WebSocket functionality setup', () => {
    // Validate that the WebSocket plugin was installed correctly
    expect(app.ws).toBeDefined();
    expect(typeof app.ws).toBe('function');
  });
});
