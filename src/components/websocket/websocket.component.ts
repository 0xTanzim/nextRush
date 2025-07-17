/**
 * 🚀 WebSocket Component - SOLID Architecture Implementation
 * RFC 6455 compliant WebSocket server with zero dependencies
 * 
 * SOLID Principles Applied:
 * - Single Responsibility: Only handles WebSocket functionality
 * - Open/Closed: Extensible for new WebSocket features
 * - Liskov Substitution: Properly extends BaseComponent
 * - Interface Segregation: Clean WebSocket interfaces
 * - Dependency Inversion: Depends on abstractions
 */

import * as crypto from 'crypto';
import { IncomingMessage, Server } from 'http';
import { Socket } from 'net';
import { BaseComponent } from '../../core/base-component';
import { MinimalApplication } from '../../core/interfaces';

export interface WebSocketHandler {
  (ws: NextRushWebSocket): void | Promise<void>;
}

export interface NextRushWebSocket {
  id: string;
  readyState: number;
  send(data: string | Buffer): void;
  close(code?: number, reason?: string): void;
  ping(): void;
  on(event: string, listener: (...args: unknown[]) => void): void;
  emit(event: string, ...args: unknown[]): void;
  join(room: string): void;
  leave(room: string): void;
}

/**
 * WebSocket Component - Clean Architecture
 */
export class WebSocketComponent extends BaseComponent {
  readonly name = 'WebSocket';
  private server?: Server;
  private connections = new Map<string, NextRushWebSocket>();
  private handlers = new Map<string, WebSocketHandler>();
  private rooms = new Map<string, Set<string>>();
  private static readonly WEBSOCKET_MAGIC =
    '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

  constructor() {
    super('WebSocket');
  }

  /**
   * Install WebSocket methods on application
   */
  install(app: MinimalApplication): void {
    this.setApp(app);

    // Install ws method for WebSocket routes
    (app as any).ws = (path: string, handler: WebSocketHandler) => {
      this.handlers.set(path, handler);
      return app;
    };

    // Install WebSocket server initialization
    (app as any).initWebSocket = (server: Server) => {
      this.server = server;
      this.setupWebSocketServer();
    };

    this.log('info', 'WebSocket component installed');
  }

  /**
   * Setup WebSocket server on HTTP upgrade
   */
  private setupWebSocketServer(): void {
    if (!this.server) return;

    this.server.on(
      'upgrade',
      (req: IncomingMessage, socket: Socket, head: Buffer) => {
        this.handleUpgrade(req, socket, head);
      }
    );
  }

  /**
   * Handle HTTP upgrade to WebSocket
   */
  private async handleUpgrade(
    req: IncomingMessage,
    socket: Socket,
    head: Buffer
  ): Promise<void> {
    try {
      const url = req.url || '/';
      const handler = this.handlers.get(url);

      if (!handler) {
        socket.end('HTTP/1.1 404 Not Found\r\n\r\n');
        return;
      }

      // Validate WebSocket headers
      if (!this.validateWebSocketHeaders(req)) {
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        return;
      }

      // Perform WebSocket handshake
      const acceptKey = this.generateAcceptKey(
        req.headers['sec-websocket-key'] as string
      );
      const responseHeaders = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${acceptKey}`,
        '',
        '',
      ].join('\r\n');

      socket.write(responseHeaders);

      // Create WebSocket instance
      const ws = this.createWebSocket(socket);
      this.connections.set(ws.id, ws);

      // Call handler
      await handler(ws);
    } catch (error) {
      console.error('WebSocket upgrade error:', error);
      socket.end('HTTP/1.1 500 Internal Server Error\r\n\r\n');
    }
  }

  /**
   * Validate WebSocket headers
   */
  private validateWebSocketHeaders(req: IncomingMessage): boolean {
    const upgrade = req.headers.upgrade;
    const connection = req.headers.connection;
    const key = req.headers['sec-websocket-key'];
    const version = req.headers['sec-websocket-version'];

    return !!(
      upgrade &&
      upgrade.toLowerCase() === 'websocket' &&
      connection &&
      connection.toLowerCase().includes('upgrade') &&
      key &&
      version === '13'
    );
  }

  /**
   * Generate WebSocket accept key
   */
  private generateAcceptKey(key: string): string {
    return crypto
      .createHash('sha1')
      .update(key + WebSocketComponent.WEBSOCKET_MAGIC)
      .digest('base64');
  }

  /**
   * Create WebSocket instance with proper type safety
   */
  private createWebSocket(socket: Socket): NextRushWebSocket {
    const id = crypto.randomBytes(16).toString('hex');
    const listeners = new Map<string, ((...args: unknown[]) => void)[]>();
    const wsComponent = this; // Capture component reference

    const ws: NextRushWebSocket = {
      id,
      readyState: 1, // OPEN

      send(data: string | Buffer): void {
        if (ws.readyState !== 1) return;

        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
        const frame = createWebSocketFrame(buffer);
        socket.write(frame);
      },

      close(code = 1000, reason = ''): void {
        if (ws.readyState === 3) return; // Already closed

        ws.readyState = 3; // CLOSED
        const closeFrame = createCloseFrame(code, reason);
        socket.write(closeFrame);
        socket.end();
      },

      ping(): void {
        if (ws.readyState !== 1) return;
        const pingFrame = createPingFrame();
        socket.write(pingFrame);
      },

      on(event: string, listener: (...args: unknown[]) => void): void {
        if (!listeners.has(event)) {
          listeners.set(event, []);
        }
        listeners.get(event)!.push(listener);
      },

      emit(event: string, ...args: unknown[]): void {
        const eventListeners = listeners.get(event);
        if (eventListeners) {
          eventListeners.forEach((listener) => listener(...args));
        }
      },

      join(room: string): void {
        if (!wsComponent.rooms.has(room)) {
          wsComponent.rooms.set(room, new Set());
        }
        wsComponent.rooms.get(room)!.add(id);
      },

      leave(room: string): void {
        const roomSet = wsComponent.rooms.get(room);
        if (roomSet) {
          roomSet.delete(id);
          if (roomSet.size === 0) {
            wsComponent.rooms.delete(room);
          }
        }
      },
    };

    // Handle socket events
    socket.on('data', (buffer: Buffer) => {
      try {
        const frame = parseWebSocketFrame(buffer);
        if (frame) {
          if (frame.opcode === 0x8) {
            // Close frame
            ws.close();
          } else if (frame.opcode === 0x9) {
            // Ping frame
            const pongFrame = createPongFrame(frame.payload);
            socket.write(pongFrame);
          } else if (frame.opcode === 0x1 || frame.opcode === 0x2) {
            // Text or binary
            ws.emit('message', frame.payload);
          }
        }
      } catch (error) {
        console.error('WebSocket frame parse error:', error);
        ws.close(1002, 'Protocol error');
      }
    });

    socket.on('close', () => {
      ws.readyState = 3; // CLOSED
      wsComponent.connections.delete(id);
      ws.emit('close');
    });

    socket.on('error', (error) => {
      ws.emit('error', error);
    });

    return ws;
  }

  /**
   * Broadcast to room
   */
  broadcast(room: string, data: string | Buffer): void {
    const roomSet = this.rooms.get(room);
    if (!roomSet) return;

    roomSet.forEach((connectionId) => {
      const ws = this.connections.get(connectionId);
      if (ws && ws.readyState === 1) {
        ws.send(data);
      }
    });
  }

  override async start(): Promise<void> {
    console.log('🚀 WebSocket component started');
  }

  override async stop(): Promise<void> {
    // Close all connections
    this.connections.forEach((ws) => ws.close());
    this.connections.clear();
    this.rooms.clear();
    this.handlers.clear();
    console.log('🛑 WebSocket component stopped');
  }
}

/**
 * Create WebSocket frame
 */
function createWebSocketFrame(payload: Buffer): Buffer {
  const payloadLength = payload.length;
  let frame: Buffer;

  if (payloadLength < 126) {
    frame = Buffer.allocUnsafe(2 + payloadLength);
    frame[0] = 0x81; // FIN + text frame
    frame[1] = payloadLength;
    payload.copy(frame, 2);
  } else if (payloadLength < 65536) {
    frame = Buffer.allocUnsafe(4 + payloadLength);
    frame[0] = 0x81;
    frame[1] = 126;
    frame.writeUInt16BE(payloadLength, 2);
    payload.copy(frame, 4);
  } else {
    frame = Buffer.allocUnsafe(10 + payloadLength);
    frame[0] = 0x81;
    frame[1] = 127;
    frame.writeUInt32BE(0, 2);
    frame.writeUInt32BE(payloadLength, 6);
    payload.copy(frame, 10);
  }

  return frame;
}

/**
 * Parse WebSocket frame
 */
function parseWebSocketFrame(
  buffer: Buffer
): { opcode: number; payload: Buffer } | null {
  if (buffer.length < 2) return null;

  const firstByte = buffer[0];
  const secondByte = buffer[1];

  const opcode = firstByte & 0x0f;
  const masked = (secondByte & 0x80) === 0x80;

  let payloadLength = secondByte & 0x7f;
  let offset = 2;

  if (payloadLength === 126) {
    if (buffer.length < offset + 2) return null;
    payloadLength = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (payloadLength === 127) {
    if (buffer.length < offset + 8) return null;
    payloadLength = buffer.readUInt32BE(offset + 4); // Ignore high 32 bits
    offset += 8;
  }

  if (masked) {
    if (buffer.length < offset + 4 + payloadLength) return null;
    const maskKey = buffer.slice(offset, offset + 4);
    offset += 4;

    const payload = buffer.slice(offset, offset + payloadLength);
    for (let i = 0; i < payload.length; i++) {
      payload[i] ^= maskKey[i % 4];
    }

    return { opcode, payload };
  } else {
    if (buffer.length < offset + payloadLength) return null;
    return { opcode, payload: buffer.slice(offset, offset + payloadLength) };
  }
}

/**
 * Create close frame
 */
function createCloseFrame(code: number, reason: string): Buffer {
  const reasonBuffer = Buffer.from(reason, 'utf8');
  const frame = Buffer.allocUnsafe(4 + reasonBuffer.length);
  frame[0] = 0x88; // FIN + close frame
  frame[1] = 2 + reasonBuffer.length;
  frame.writeUInt16BE(code, 2);
  reasonBuffer.copy(frame, 4);
  return frame;
}

/**
 * Create ping frame
 */
function createPingFrame(): Buffer {
  return Buffer.from([0x89, 0x00]); // FIN + ping frame, no payload
}

/**
 * Create pong frame
 */
function createPongFrame(payload: Buffer): Buffer {
  const frame = Buffer.allocUnsafe(2 + payload.length);
  frame[0] = 0x8a; // FIN + pong frame
  frame[1] = payload.length;
  payload.copy(frame, 2);
  return frame;
}
