/**
 * 🚀 NextRush WebSocket Server
 * Zero-dependency WebSocket implementation using raw Node.js
 * RFC 6455 compliant with advanced features
 */

import * as crypto from 'crypto';
import { IncomingMessage, Server } from 'http';
import { Socket } from 'net';
import { NextRushRequest } from '../types/express';
import {
  ConnectionEvents,
  NextRushWebSocket,
  RoomEmitter,
  RoomInfo,
  WebSocketCloseCode,
  WebSocketFrame,
  WebSocketMessage,
  WebSocketMiddleware,
  WebSocketOpcode,
  WebSocketOptions,
  WebSocketReadyState,
  WebSocketStats,
} from '../types/websocket';

/**
 * WebSocket Server Implementation
 * Pure Node.js with zero external dependencies
 */
export class WebSocketServer {
  private server: Server;
  private options: Required<WebSocketOptions>;
  private connections = new Map<string, NextRushWebSocket>();
  private rooms = new Map<string, RoomInfo>();
  private middleware: WebSocketMiddleware[] = [];
  private stats: WebSocketStats;
  private pingInterval?: NodeJS.Timeout;
  private roomCleanupInterval?: NodeJS.Timeout;

  // WebSocket GUID for handshake (RFC 6455)
  private static readonly WEBSOCKET_MAGIC_STRING =
    '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

  constructor(server: Server, options: WebSocketOptions = {}) {
    this.server = server;
    this.options = {
      maxConnections: 1000,
      pingInterval: 30000,
      pongTimeout: 5000,
      maxMessageSize: 1024 * 1024, // 1MB
      protocols: [],
      extensions: [],
      maxRooms: 1000,
      roomCleanupInterval: 300000, // 5 minutes
      compression: false,
      binaryType: 'buffer',
      debug: false,
      logLevel: 'info',
      verifyClient: undefined,
      allowOrigins: undefined,
      ...options,
    } as Required<WebSocketOptions>;

    this.stats = {
      connections: 0,
      totalConnections: 0,
      messagesSent: 0,
      messagesReceived: 0,
      rooms: 0,
      uptime: Date.now(),
      bytesReceived: 0,
      bytesSent: 0,
      errors: 0,
      reconnections: 0,
    };

    this.setupServer();
    this.startPeriodicTasks();
  }

  /**
   * Set up the WebSocket server on HTTP upgrade
   */
  private setupServer(): void {
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
    _head: Buffer
  ): Promise<void> {
    try {
      // Verify WebSocket handshake
      if (!this.isValidWebSocketUpgrade(req)) {
        this.rejectConnection(socket, 400, 'Bad Request');
        return;
      }

      // Check connection limit
      if (this.connections.size >= this.options.maxConnections) {
        this.rejectConnection(socket, 503, 'Too Many Connections');
        return;
      }

      // Verify client if callback provided
      if (this.options.verifyClient) {
        const isValid = await this.options.verifyClient(req);
        if (!isValid) {
          this.rejectConnection(socket, 401, 'Unauthorized');
          return;
        }
      }

      // Check origin if specified
      if (this.options.allowOrigins && this.options.allowOrigins.length > 0) {
        const origin = req.headers.origin;
        if (!origin || !this.options.allowOrigins.includes(origin)) {
          this.rejectConnection(socket, 403, 'Forbidden Origin');
          return;
        }
      }

      // Perform WebSocket handshake
      const websocketKey = req.headers['sec-websocket-key'] as string;
      const acceptKey = this.generateAcceptKey(websocketKey);

      const responseHeaders = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${acceptKey}`,
      ];

      // Handle protocols
      const requestedProtocols = req.headers['sec-websocket-protocol'];
      if (requestedProtocols && this.options.protocols.length > 0) {
        const protocols = requestedProtocols.split(',').map((p) => p.trim());
        const supportedProtocol = protocols.find((p) =>
          this.options.protocols.includes(p)
        );
        if (supportedProtocol) {
          responseHeaders.push(`Sec-WebSocket-Protocol: ${supportedProtocol}`);
        }
      }

      socket.write(responseHeaders.join('\r\n') + '\r\n\r\n');

      // Create WebSocket connection
      const wsSocket = this.createWebSocket(socket, req);
      this.connections.set(wsSocket.id, wsSocket);
      this.stats.connections++;
      this.stats.totalConnections++;

      this.log('info', `WebSocket connection established: ${wsSocket.id}`);

      // Run middleware chain
      await this.runMiddleware(wsSocket, req as NextRushRequest);

      // Emit connection event
      this.emit('connection', wsSocket, req as NextRushRequest);
    } catch (error) {
      this.log('error', 'WebSocket upgrade failed', error);
      this.rejectConnection(socket, 500, 'Internal Server Error');
      this.stats.errors++;
    }
  }

  /**
   * Create WebSocket connection wrapper
   */
  private createWebSocket(
    socket: Socket,
    req: IncomingMessage
  ): NextRushWebSocket {
    const id = crypto.randomUUID();
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.socket.remoteAddress ||
      '127.0.0.1';

    // 🚀 Event emitter for individual WebSocket connections
    const eventHandlers = new Map<string, Function[]>();

    const wsSocket: NextRushWebSocket = {
      id,
      socket,
      readyState: WebSocketReadyState.OPEN,
      protocol: '',
      extensions: [],
      ip,
      userAgent: req.headers['user-agent'] || '',
      origin: req.headers.origin || '',
      rooms: new Set(),
      isAlive: true,
      lastPing: Date.now(),
      metadata: {},
      connectedAt: new Date(),
      lastActivity: new Date(),

      // Core WebSocket methods
      send: (data: string | Buffer | object) =>
        this.sendMessage(wsSocket, data),
      ping: (data?: Buffer) => this.sendPing(wsSocket, data),
      pong: (data?: Buffer) => this.sendPong(wsSocket, data),
      close: (code?: number, reason?: string) =>
        this.closeConnection(wsSocket, code, reason),

      // Enhanced methods
      broadcast: (data: string | Buffer | object, room?: string) =>
        this.broadcast(data, room, wsSocket.id),
      join: (room: string) => this.joinRoom(wsSocket, room),
      leave: (room: string) => this.leaveRoom(wsSocket, room),
      to: (room: string) => this.createRoomEmitter(room),
      emit: (event: string, ...args: any[]) =>
        this.emitToSocket(wsSocket, event, ...args),

      // 🚀 Event handling methods
      on: (event: string, handler: (...args: any[]) => void) => {
        if (!eventHandlers.has(event)) {
          eventHandlers.set(event, []);
        }
        eventHandlers.get(event)!.push(handler);
      },

      off: (event: string, handler?: (...args: any[]) => void) => {
        const handlers = eventHandlers.get(event);
        if (!handlers) return;

        if (handler) {
          const index = handlers.indexOf(handler);
          if (index > -1) {
            handlers.splice(index, 1);
          }
        } else {
          eventHandlers.delete(event);
        }
      },

      once: (event: string, handler: (...args: any[]) => void) => {
        const onceWrapper = (...args: any[]) => {
          handler(...args);
          wsSocket.off(event, onceWrapper);
        };
        wsSocket.on(event, onceWrapper);
      },
    };

    // Store event handlers reference for internal use
    (wsSocket as any)._eventHandlers = eventHandlers;

    // Set up socket event handlers
    this.setupSocketHandlers(wsSocket);

    return wsSocket;
  }

  /**
   * Set up socket event handlers
   */
  private setupSocketHandlers(wsSocket: NextRushWebSocket): void {
    wsSocket.socket.on('data', (data: Buffer) => {
      try {
        this.handleSocketData(wsSocket, data);
      } catch (error) {
        this.log('error', `Data handling error for ${wsSocket.id}`, error);
        this.emit('error', error as Error, wsSocket);
      }
    });

    wsSocket.socket.on('close', () => {
      this.handleSocketClose(wsSocket);
    });

    wsSocket.socket.on('error', (error: Error) => {
      this.log('error', `Socket error for ${wsSocket.id}`, error);
      this.emit('error', error, wsSocket);
      this.handleSocketClose(wsSocket);
    });
  }

  /**
   * Handle incoming socket data
   */
  private handleSocketData(wsSocket: NextRushWebSocket, data: Buffer): void {
    let offset = 0;

    while (offset < data.length) {
      const frame = this.parseWebSocketFrame(data, offset);
      if (!frame) break;

      offset += this.getFrameSize(frame);
      this.handleWebSocketFrame(wsSocket, frame);
    }

    wsSocket.lastActivity = new Date();
    this.stats.bytesReceived += data.length;
  }

  /**
   * Parse WebSocket frame according to RFC 6455
   */
  private parseWebSocketFrame(
    data: Buffer,
    offset: number
  ): WebSocketFrame | null {
    if (data.length < offset + 2) return null;

    const firstByte = data[offset];
    const secondByte = data[offset + 1];

    const fin = !!(firstByte & 0x80);
    const rsv1 = !!(firstByte & 0x40);
    const rsv2 = !!(firstByte & 0x20);
    const rsv3 = !!(firstByte & 0x10);
    const opcode = firstByte & 0x0f;

    const masked = !!(secondByte & 0x80);
    let payloadLength = secondByte & 0x7f;

    let currentOffset = offset + 2;

    // Extended payload length
    if (payloadLength === 126) {
      if (data.length < currentOffset + 2) return null;
      payloadLength = data.readUInt16BE(currentOffset);
      currentOffset += 2;
    } else if (payloadLength === 127) {
      if (data.length < currentOffset + 8) return null;
      const high = data.readUInt32BE(currentOffset);
      const low = data.readUInt32BE(currentOffset + 4);
      payloadLength = (high << 32) + low;
      currentOffset += 8;
    }

    // Check message size limit
    if (payloadLength > this.options.maxMessageSize) {
      throw new Error(`Message too large: ${payloadLength} bytes`);
    }

    let maskingKey: Buffer | undefined;
    if (masked) {
      if (data.length < currentOffset + 4) return null;
      maskingKey = data.slice(currentOffset, currentOffset + 4);
      currentOffset += 4;
    }

    if (data.length < currentOffset + payloadLength) return null;

    let payload = data.slice(currentOffset, currentOffset + payloadLength);

    // Unmask payload if needed
    if (masked && maskingKey) {
      for (let i = 0; i < payload.length; i++) {
        payload[i] ^= maskingKey[i % 4];
      }
    }

    return {
      fin,
      rsv1,
      rsv2,
      rsv3,
      opcode,
      masked,
      payloadLength,
      maskingKey,
      payload,
    };
  }

  /**
   * Handle parsed WebSocket frame
   */
  private handleWebSocketFrame(
    wsSocket: NextRushWebSocket,
    frame: WebSocketFrame
  ): void {
    switch (frame.opcode) {
      case WebSocketOpcode.TEXT:
        this.handleTextFrame(wsSocket, frame);
        break;
      case WebSocketOpcode.BINARY:
        this.handleBinaryFrame(wsSocket, frame);
        break;
      case WebSocketOpcode.CLOSE:
        this.handleCloseFrame(wsSocket, frame);
        break;
      case WebSocketOpcode.PING:
        this.handlePingFrame(wsSocket, frame);
        break;
      case WebSocketOpcode.PONG:
        this.handlePongFrame(wsSocket, frame);
        break;
      default:
        this.log('warn', `Unknown opcode: ${frame.opcode}`);
    }
  }

  /**
   * Handle text frame
   */
  private handleTextFrame(
    wsSocket: NextRushWebSocket,
    frame: WebSocketFrame
  ): void {
    try {
      const text = frame.payload.toString('utf8');
      const message: WebSocketMessage = {
        id: crypto.randomUUID(),
        type: 'text',
        data: text,
        timestamp: Date.now(),
        socket: wsSocket,
      };

      this.stats.messagesReceived++;

      // Emit to server-level handlers
      this.emit('message', message);

      // 🚀 Emit to individual WebSocket connection handlers
      this.emitToWebSocketHandlers(wsSocket, 'message', text);
    } catch (error) {
      this.log('error', 'Failed to parse text frame', error);
      this.emit('error', error as Error, wsSocket);
    }
  }

  /**
   * Handle binary frame
   */
  private handleBinaryFrame(
    wsSocket: NextRushWebSocket,
    frame: WebSocketFrame
  ): void {
    const message: WebSocketMessage = {
      id: crypto.randomUUID(),
      type: 'binary',
      data: frame.payload,
      timestamp: Date.now(),
      socket: wsSocket,
    };

    this.stats.messagesReceived++;
    this.emit('message', message);
  }

  /**
   * Handle close frame
   */
  private handleCloseFrame(
    wsSocket: NextRushWebSocket,
    frame: WebSocketFrame
  ): void {
    let code = WebSocketCloseCode.NORMAL_CLOSURE;
    let reason = '';

    if (frame.payload.length >= 2) {
      code = frame.payload.readUInt16BE(0);
      reason = frame.payload.slice(2).toString('utf8');
    }

    wsSocket.readyState = WebSocketReadyState.CLOSING;
    this.emit('close', wsSocket, code, reason);
    this.closeConnection(wsSocket, code, reason);
  }

  /**
   * Handle ping frame
   */
  private handlePingFrame(
    wsSocket: NextRushWebSocket,
    frame: WebSocketFrame
  ): void {
    wsSocket.isAlive = true;
    wsSocket.lastPing = Date.now();

    // Send pong response
    this.sendFrame(wsSocket, WebSocketOpcode.PONG, frame.payload);
    this.emit('ping', wsSocket, frame.payload);
  }

  /**
   * Handle pong frame
   */
  private handlePongFrame(
    wsSocket: NextRushWebSocket,
    frame: WebSocketFrame
  ): void {
    wsSocket.isAlive = true;
    this.emit('pong', wsSocket, frame.payload);
  }

  /**
   * Send message to WebSocket
   */
  private sendMessage(
    wsSocket: NextRushWebSocket,
    data: string | Buffer | object
  ): void {
    if (wsSocket.readyState !== WebSocketReadyState.OPEN) {
      return;
    }

    let payload: Buffer;
    let opcode: WebSocketOpcode;

    if (typeof data === 'string') {
      payload = Buffer.from(data, 'utf8');
      opcode = WebSocketOpcode.TEXT;
    } else if (Buffer.isBuffer(data)) {
      payload = data;
      opcode = WebSocketOpcode.BINARY;
    } else {
      payload = Buffer.from(JSON.stringify(data), 'utf8');
      opcode = WebSocketOpcode.TEXT;
    }

    this.sendFrame(wsSocket, opcode, payload);
    this.stats.messagesSent++;
    this.stats.bytesSent += payload.length;
  }

  /**
   * Send WebSocket frame
   */
  private sendFrame(
    wsSocket: NextRushWebSocket,
    opcode: WebSocketOpcode,
    payload: Buffer = Buffer.alloc(0)
  ): void {
    const payloadLength = payload.length;
    let frame: Buffer;

    // Calculate frame size
    let frameSize = 2; // Base frame size
    if (payloadLength < 126) {
      frameSize += payloadLength;
    } else if (payloadLength < 65536) {
      frameSize += 2 + payloadLength;
    } else {
      frameSize += 8 + payloadLength;
    }

    frame = Buffer.allocUnsafe(frameSize);
    let offset = 0;

    // First byte: FIN + RSV + Opcode
    frame[offset++] = 0x80 | opcode;

    // Second byte: MASK + Payload length
    if (payloadLength < 126) {
      frame[offset++] = payloadLength;
    } else if (payloadLength < 65536) {
      frame[offset++] = 126;
      frame.writeUInt16BE(payloadLength, offset);
      offset += 2;
    } else {
      frame[offset++] = 127;
      frame.writeUInt32BE(0, offset); // High 32 bits
      frame.writeUInt32BE(payloadLength, offset + 4); // Low 32 bits
      offset += 8;
    }

    // Copy payload
    payload.copy(frame, offset);

    try {
      wsSocket.socket.write(frame);
    } catch (error) {
      this.log('error', `Failed to send frame to ${wsSocket.id}`, error);
      this.emit('error', error as Error, wsSocket);
    }
  }

  /**
   * Send ping frame
   */
  private sendPing(wsSocket: NextRushWebSocket, data?: Buffer): void {
    this.sendFrame(wsSocket, WebSocketOpcode.PING, data || Buffer.alloc(0));
  }

  /**
   * Send pong frame
   */
  private sendPong(wsSocket: NextRushWebSocket, data?: Buffer): void {
    this.sendFrame(wsSocket, WebSocketOpcode.PONG, data || Buffer.alloc(0));
  }

  /**
   * Close WebSocket connection
   */
  private closeConnection(
    wsSocket: NextRushWebSocket,
    code = WebSocketCloseCode.NORMAL_CLOSURE,
    reason = ''
  ): void {
    if (wsSocket.readyState === WebSocketReadyState.CLOSED) {
      return;
    }

    wsSocket.readyState = WebSocketReadyState.CLOSING;

    // Send close frame
    const reasonBuffer = Buffer.from(reason, 'utf8');
    const closeFrame = Buffer.allocUnsafe(2 + reasonBuffer.length);
    closeFrame.writeUInt16BE(code, 0);
    reasonBuffer.copy(closeFrame, 2);

    this.sendFrame(wsSocket, WebSocketOpcode.CLOSE, closeFrame);

    // Clean up
    setTimeout(() => {
      this.handleSocketClose(wsSocket);
    }, 1000);
  }

  /**
   * Handle socket close
   */
  private handleSocketClose(wsSocket: NextRushWebSocket): void {
    if (wsSocket.readyState === WebSocketReadyState.CLOSED) {
      return;
    }

    wsSocket.readyState = WebSocketReadyState.CLOSED;
    this.connections.delete(wsSocket.id);
    this.stats.connections--;

    // Leave all rooms
    wsSocket.rooms.forEach((room) => {
      this.leaveRoom(wsSocket, room);
    });

    this.log('info', `WebSocket connection closed: ${wsSocket.id}`);
    wsSocket.socket.destroy();
  }

  /**
   * Join room
   */
  private async joinRoom(
    wsSocket: NextRushWebSocket,
    roomName: string
  ): Promise<void> {
    if (wsSocket.rooms.has(roomName)) {
      return;
    }

    if (this.rooms.size >= this.options.maxRooms) {
      throw new Error('Maximum number of rooms reached');
    }

    let room = this.rooms.get(roomName);
    if (!room) {
      room = {
        name: roomName,
        clients: new Set(),
        created: new Date(),
        lastActivity: new Date(),
        messageCount: 0,
        metadata: {},
      };
      this.rooms.set(roomName, room);
      this.stats.rooms++;
      this.emit('room:created', roomName);
    }

    room.clients.add(wsSocket);
    room.lastActivity = new Date();
    wsSocket.rooms.add(roomName);

    this.emit('room:join', wsSocket, roomName);
  }

  /**
   * Leave room
   */
  private async leaveRoom(
    wsSocket: NextRushWebSocket,
    roomName: string
  ): Promise<void> {
    const room = this.rooms.get(roomName);
    if (!room || !wsSocket.rooms.has(roomName)) {
      return;
    }

    room.clients.delete(wsSocket);
    wsSocket.rooms.delete(roomName);

    if (room.clients.size === 0) {
      this.rooms.delete(roomName);
      this.stats.rooms--;
      this.emit('room:destroyed', roomName);
    }

    this.emit('room:leave', wsSocket, roomName);
  }

  /**
   * Broadcast message
   */
  private broadcast(
    data: string | Buffer | object,
    roomName?: string,
    excludeId?: string
  ): void {
    const targets = roomName
      ? Array.from(this.rooms.get(roomName)?.clients || [])
      : Array.from(this.connections.values());

    targets
      .filter(
        (socket) =>
          socket.id !== excludeId &&
          socket.readyState === WebSocketReadyState.OPEN
      )
      .forEach((socket) => socket.send(data));
  }

  /**
   * Create room emitter
   */
  private createRoomEmitter(roomName: string): RoomEmitter {
    return {
      emit: (event: string, ...args: any[]) => {
        const room = this.rooms.get(roomName);
        if (room) {
          room.clients.forEach((socket) => {
            socket.emit(event, ...args);
          });
        }
      },
      send: (data: string | Buffer | object) => {
        this.broadcast(data, roomName);
      },
      broadcast: (data: string | Buffer | object) => {
        this.broadcast(data, roomName);
      },
      except: (socketId: string) => {
        return {
          ...this.createRoomEmitter(roomName),
          send: (data: string | Buffer | object) => {
            this.broadcast(data, roomName, socketId);
          },
        };
      },
      to: (targetRoom: string) => {
        return this.createRoomEmitter(targetRoom);
      },
    };
  }

  /**
   * Emit to specific socket
   */
  private emitToSocket(
    wsSocket: NextRushWebSocket,
    event: string,
    ...args: any[]
  ): void {
    const message = {
      event,
      data: args.length === 1 ? args[0] : args,
      timestamp: Date.now(),
    };
    wsSocket.send(JSON.stringify(message));
  }

  /**
   * Emit event to individual WebSocket handlers
   */
  private emitToWebSocketHandlers(
    wsSocket: NextRushWebSocket,
    event: string,
    ...args: any[]
  ): void {
    const eventHandlers = (wsSocket as any)._eventHandlers as Map<
      string,
      Function[]
    >;
    if (!eventHandlers) return;

    const handlers = eventHandlers.get(event) || [];
    handlers.forEach((handler) => {
      try {
        handler(...args);
      } catch (error) {
        this.log('error', `WebSocket event handler error for ${event}`, error);
      }
    });
  }

  /**
   * Validate WebSocket upgrade request
   */
  private isValidWebSocketUpgrade(req: IncomingMessage): boolean {
    return !!(
      req.headers.upgrade === 'websocket' &&
      req.headers.connection?.toLowerCase().includes('upgrade') &&
      req.headers['sec-websocket-key'] &&
      req.headers['sec-websocket-version'] === '13'
    );
  }

  /**
   * Generate WebSocket accept key
   */
  private generateAcceptKey(key: string): string {
    return crypto
      .createHash('sha1')
      .update(key + WebSocketServer.WEBSOCKET_MAGIC_STRING)
      .digest('base64');
  }

  /**
   * Reject WebSocket connection
   */
  private rejectConnection(
    socket: Socket,
    statusCode: number,
    statusMessage: string
  ): void {
    const response = `HTTP/1.1 ${statusCode} ${statusMessage}\r\n\r\n`;
    socket.write(response);
    socket.destroy();
  }

  /**
   * Run middleware chain
   */
  private async runMiddleware(
    wsSocket: NextRushWebSocket,
    req: NextRushRequest
  ): Promise<void> {
    for (const middleware of this.middleware) {
      await new Promise<void>((resolve, reject) => {
        try {
          const result = middleware(wsSocket, req, resolve);
          if (result instanceof Promise) {
            result.then(() => resolve()).catch(reject);
          }
        } catch (error) {
          reject(error);
        }
      });
    }
  }

  /**
   * Get frame size for parsing
   */
  private getFrameSize(frame: WebSocketFrame): number {
    let size = 2; // Base header

    if (frame.payloadLength < 126) {
      // No extended length
    } else if (frame.payloadLength < 65536) {
      size += 2; // 16-bit extended length
    } else {
      size += 8; // 64-bit extended length
    }

    if (frame.masked) {
      size += 4; // Masking key
    }

    size += frame.payloadLength; // Payload

    return size;
  }

  /**
   * Start periodic tasks
   */
  private startPeriodicTasks(): void {
    // Ping interval
    if (this.options.pingInterval > 0) {
      this.pingInterval = setInterval(() => {
        this.connections.forEach((wsSocket) => {
          if (wsSocket.readyState === WebSocketReadyState.OPEN) {
            if (!wsSocket.isAlive) {
              this.closeConnection(
                wsSocket,
                WebSocketCloseCode.GOING_AWAY,
                'Ping timeout'
              );
              return;
            }

            wsSocket.isAlive = false;
            wsSocket.ping();
          }
        });
      }, this.options.pingInterval);
    }

    // Room cleanup
    if (this.options.roomCleanupInterval > 0) {
      this.roomCleanupInterval = setInterval(() => {
        this.rooms.forEach((room, roomName) => {
          if (room.clients.size === 0) {
            this.rooms.delete(roomName);
            this.stats.rooms--;
          }
        });
      }, this.options.roomCleanupInterval);
    }
  }

  /**
   * Event emitter methods
   */
  private eventHandlers = new Map<string, Function[]>();

  on<K extends keyof ConnectionEvents>(
    event: K,
    handler: ConnectionEvents[K]
  ): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  private emit(event: string, ...args: any[]): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach((handler) => {
      try {
        handler(...args);
      } catch (error) {
        this.log('error', `Event handler error for ${event}`, error);
      }
    });
  }

  /**
   * Add middleware
   */
  use(middleware: WebSocketMiddleware): void {
    this.middleware.push(middleware);
  }

  /**
   * Get statistics
   */
  getStats(): WebSocketStats {
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.uptime,
    };
  }

  /**
   * Get all connections
   */
  getConnections(): NextRushWebSocket[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get room info
   */
  getRoom(name: string): RoomInfo | undefined {
    return this.rooms.get(name);
  }

  /**
   * Get all rooms
   */
  getRooms(): RoomInfo[] {
    return Array.from(this.rooms.values());
  }

  /**
   * Logging utility
   */
  private log(level: string, message: string, meta?: any): void {
    if (!this.options.debug && level === 'debug') {
      return;
    }

    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    if (meta) {
      console.log(logMessage, meta);
    } else {
      console.log(logMessage);
    }
  }

  /**
   * Graceful shutdown
   */
  async close(): Promise<void> {
    // Clear intervals
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    if (this.roomCleanupInterval) {
      clearInterval(this.roomCleanupInterval);
    }

    // Close all connections
    const closePromises = Array.from(this.connections.values()).map(
      (wsSocket) => {
        return new Promise<void>((resolve) => {
          wsSocket.close(WebSocketCloseCode.GOING_AWAY, 'Server shutdown');
          setTimeout(resolve, 1000);
        });
      }
    );

    await Promise.all(closePromises);
    this.log('info', 'WebSocket server closed');
  }
}
