/**
 * 🚀 NextRush WebSocket Plugin
 * Zero-dependency WebSocket implementation using raw Node.js
 * RFC 6455 compliant with advanced room and event management
 */

import * as crypto from 'crypto';
import { IncomingMessage, Server } from 'http';
import { Socket } from 'net';
import { Application } from '../../core/app/application';
import { NextRushRequest } from '../../types/express';
import {
  NextRushWebSocket,
  RoomEmitter,
  RoomInfo,
  WebSocketCloseCode,
  WebSocketFrame,
  WebSocketHandler,
  WebSocketMiddleware,
  WebSocketOpcode,
  WebSocketOptions,
  WebSocketReadyState,
  WebSocketStats,
} from '../../types/websocket';
import { BasePlugin, PluginRegistry } from '../core/base-plugin';

/**
 * WebSocket Plugin for NextRush
 * Provides zero-dependency WebSocket support with rooms, events, and middleware
 */
export class WebSocketPlugin extends BasePlugin {
  name = 'WebSocket';

  private server?: Server;
  private app?: Application;
  private isEnabled = false;
  private options: Required<WebSocketOptions>;
  private connections = new Map<string, NextRushWebSocket>();
  private rooms = new Map<string, RoomInfo>();
  private routes = new Map<string, WebSocketHandler>();
  private middleware: WebSocketMiddleware[] = [];
  private stats: WebSocketStats;
  private pingInterval?: NodeJS.Timeout | null;
  private roomCleanupInterval?: NodeJS.Timeout | null;

  // WebSocket GUID for handshake (RFC 6455)
  private static readonly WEBSOCKET_MAGIC_STRING =
    '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

  constructor(registry: PluginRegistry) {
    super(registry);
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
      verifyClient: () => true,
      allowOrigins: [],
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
  }

  /**
   * Install WebSocket plugin into application
   */
  install(app: Application): void {
    // Add WebSocket methods to application
    (app as any).enableWebSocket = (options?: WebSocketOptions) => {
      this.updateOptions(options || {});
      // Store app reference to setup server later
      this.app = app;
      this.isEnabled = true;
      return app;
    };

    (app as any).ws = (path: string, handler: WebSocketHandler) => {
      this.routes.set(path, handler);
      return app;
    };

    (app as any).wsUse = (middleware: WebSocketMiddleware) => {
      this.middleware.push(middleware);
      return app;
    };

    (app as any).wsBroadcast = (data: any, room?: string) => {
      this.broadcast(data, room);
      return app;
    };

    (app as any).getWebSocketStats = () => {
      return this.getStats();
    };

    (app as any).getWebSocketConnections = () => {
      return Array.from(this.connections.values());
    };

    // Listen for server creation
    this.registry.on('application:server-created', () => {
      if (this.isEnabled && this.app) {
        this.setupServer(this.app);
      }
    });
  }

  /**
   * Start the WebSocket plugin
   */
  start(): void {
    this.startPeriodicTasks();
    this.emit('websocket:started');
    this.log('info', '🚀 NextRush WebSocket Plugin started');
  }

  /**
   * Stop the WebSocket plugin
   */
  stop(): void {
    this.stopPeriodicTasks();
    this.closeAllConnections();
    this.emit('websocket:stopped');
    this.log('info', '🛑 NextRush WebSocket Plugin stopped');
  }

  /**
   * Update WebSocket options
   */
  private updateOptions(options: WebSocketOptions): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Setup WebSocket server on HTTP upgrade
   */
  private setupServer(app: Application): void {
    // Get the HTTP server from the application
    const server = (app as any).httpServer;
    if (!server) {
      throw new Error(
        'HTTP server not found. Make sure app.listen() is called first.'
      );
    }

    this.server = server;

    if (this.server) {
      // Handle HTTP upgrade to WebSocket
      this.server.on(
        'upgrade',
        (req: IncomingMessage, socket: Socket, head: Buffer) => {
          this.handleUpgrade(req, socket, head);
        }
      );

      this.log('info', '🔌 WebSocket server setup completed');
    } else {
      throw new Error('HTTP server not found');
    }
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
      // Find matching route
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      const handler = this.findHandler(url.pathname);

      if (!handler) {
        this.rejectConnection(socket, 404, 'WebSocket route not found');
        return;
      }

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

      // Call the route handler
      await handler(wsSocket, req as NextRushRequest);
    } catch (error) {
      this.log('error', 'WebSocket upgrade failed', error);
      this.rejectConnection(socket, 500, 'Internal Server Error');
      this.stats.errors++;
    }
  }

  /**
   * Find WebSocket handler for path
   */
  private findHandler(path: string): WebSocketHandler | undefined {
    // Exact match first
    if (this.routes.has(path)) {
      return this.routes.get(path);
    }

    // Wildcard matching
    for (const [routePath, handler] of Array.from(this.routes.entries())) {
      if (routePath.includes('*')) {
        const regex = new RegExp('^' + routePath.replace(/\*/g, '.*') + '$');
        if (regex.test(path)) {
          return handler;
        }
      }
    }

    return undefined;
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

    // Event emitter for individual WebSocket connections
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
      rooms: new Set<string>(),
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

      // Enhanced NextRush methods
      broadcast: (data: any, room?: string) =>
        this.broadcast(data, room, wsSocket.id),
      join: (room: string) => this.joinRoom(wsSocket, room),
      leave: (room: string) => this.leaveRoom(wsSocket, room),
      to: (room: string) => this.createRoomEmitter(room, wsSocket.id),
      emit: (event: string, ...args: any[]) =>
        this.emitToSocket(wsSocket, event, ...args),

      // Event handling
      on: (event: string, handler: (...args: any[]) => void) => {
        if (!eventHandlers.has(event)) {
          eventHandlers.set(event, []);
        }
        eventHandlers.get(event)!.push(handler);
      },
      off: (event: string, handler?: (...args: any[]) => void) => {
        if (!eventHandlers.has(event)) return;
        const handlers = eventHandlers.get(event)!;
        if (handler) {
          const index = handlers.indexOf(handler);
          if (index > -1) handlers.splice(index, 1);
        } else {
          eventHandlers.set(event, []);
        }
      },
      once: (event: string, handler: (...args: any[]) => void) => {
        const onceHandler = (...args: any[]) => {
          handler(...args);
          wsSocket.off(event, onceHandler);
        };
        wsSocket.on(event, onceHandler);
      },
    };

    // Setup socket event handlers
    this.setupSocketHandlers(wsSocket, eventHandlers);

    return wsSocket;
  }

  /**
   * Setup socket event handlers for frame processing
   */
  private setupSocketHandlers(
    wsSocket: NextRushWebSocket,
    eventHandlers: Map<string, Function[]>
  ): void {
    wsSocket.socket.on('data', (buffer: Buffer) => {
      try {
        const frames = this.parseFrames(buffer);
        for (const frame of frames) {
          this.handleFrame(wsSocket, frame, eventHandlers);
        }
      } catch (error) {
        this.log('error', `Frame parsing error for ${wsSocket.id}:`, error);
        this.closeConnection(wsSocket, WebSocketCloseCode.PROTOCOL_ERROR);
      }
    });

    wsSocket.socket.on('close', (hadError: boolean) => {
      this.handleSocketClose(wsSocket, hadError);
    });

    wsSocket.socket.on('error', (error: Error) => {
      this.log('error', `Socket error for ${wsSocket.id}:`, error);
      this.stats.errors++;
      this.emitToHandlers(eventHandlers, 'error', error);
    });
  }

  /**
   * Handle WebSocket frame
   */
  private handleFrame(
    wsSocket: NextRushWebSocket,
    frame: WebSocketFrame,
    eventHandlers: Map<string, Function[]>
  ): void {
    wsSocket.lastActivity = new Date();

    switch (frame.opcode) {
      case WebSocketOpcode.TEXT:
        const textData = frame.payload.toString('utf8');
        this.stats.messagesReceived++;
        this.stats.bytesReceived += frame.payload.length;
        this.emitToHandlers(eventHandlers, 'message', textData);
        break;

      case WebSocketOpcode.BINARY:
        this.stats.messagesReceived++;
        this.stats.bytesReceived += frame.payload.length;
        this.emitToHandlers(eventHandlers, 'message', frame.payload);
        break;

      case WebSocketOpcode.CLOSE:
        const closeCode =
          frame.payload.length >= 2
            ? frame.payload.readUInt16BE(0)
            : WebSocketCloseCode.NORMAL_CLOSURE;
        const closeReason =
          frame.payload.length > 2
            ? frame.payload.slice(2).toString('utf8')
            : '';
        this.closeConnection(wsSocket, closeCode, closeReason);
        break;

      case WebSocketOpcode.PING:
        this.sendPong(wsSocket, frame.payload);
        this.emitToHandlers(eventHandlers, 'ping', frame.payload);
        break;

      case WebSocketOpcode.PONG:
        wsSocket.isAlive = true;
        wsSocket.lastPing = Date.now();
        this.emitToHandlers(eventHandlers, 'pong', frame.payload);
        break;
    }
  }

  /**
   * Parse WebSocket frames from buffer
   */
  private parseFrames(buffer: Buffer): WebSocketFrame[] {
    const frames: WebSocketFrame[] = [];
    let offset = 0;

    while (offset < buffer.length) {
      if (buffer.length - offset < 2) break;

      const firstByte = buffer[offset];
      const secondByte = buffer[offset + 1];

      const fin = (firstByte & 0x80) === 0x80;
      const rsv1 = (firstByte & 0x40) === 0x40;
      const rsv2 = (firstByte & 0x20) === 0x20;
      const rsv3 = (firstByte & 0x10) === 0x10;
      const opcode = firstByte & 0x0f;
      const masked = (secondByte & 0x80) === 0x80;
      let payloadLength = secondByte & 0x7f;

      offset += 2;

      // Extended payload length
      if (payloadLength === 126) {
        if (buffer.length - offset < 2) break;
        payloadLength = buffer.readUInt16BE(offset);
        offset += 2;
      } else if (payloadLength === 127) {
        if (buffer.length - offset < 8) break;
        const high = buffer.readUInt32BE(offset);
        const low = buffer.readUInt32BE(offset + 4);
        payloadLength = (high << 32) + low;
        offset += 8;
      }

      // Check message size limit
      if (payloadLength > this.options.maxMessageSize) {
        throw new Error('Message too large');
      }

      // Masking key
      let maskingKey: Buffer | undefined;
      if (masked) {
        if (buffer.length - offset < 4) break;
        maskingKey = buffer.slice(offset, offset + 4);
        offset += 4;
      }

      // Payload
      if (buffer.length - offset < payloadLength) break;
      let payload = buffer.slice(offset, offset + payloadLength);
      offset += payloadLength;

      // Unmask payload if needed
      if (masked && maskingKey) {
        for (let i = 0; i < payload.length; i++) {
          payload[i] ^= maskingKey[i % 4];
        }
      }

      frames.push({
        fin,
        rsv1,
        rsv2,
        rsv3,
        opcode,
        masked,
        payloadLength,
        maskingKey,
        payload,
      });
    }

    return frames;
  }

  /**
   * Send message to WebSocket client
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

    const frame = this.createFrame(opcode, payload);
    wsSocket.socket.write(frame);

    this.stats.messagesSent++;
    this.stats.bytesSent += payload.length;
  }

  /**
   * Create WebSocket frame
   */
  private createFrame(opcode: WebSocketOpcode, payload: Buffer): Buffer {
    const payloadLength = payload.length;
    let headerLength = 2;

    if (payloadLength > 65535) {
      headerLength += 8;
    } else if (payloadLength > 125) {
      headerLength += 2;
    }

    const frame = Buffer.allocUnsafe(headerLength + payloadLength);
    let offset = 0;

    // First byte: FIN (1) + RSV (000) + Opcode (4)
    frame[offset++] = 0x80 | opcode;

    // Second byte: MASK (0) + Payload length
    if (payloadLength > 65535) {
      frame[offset++] = 127;
      frame.writeBigUInt64BE(BigInt(payloadLength), offset);
      offset += 8;
    } else if (payloadLength > 125) {
      frame[offset++] = 126;
      frame.writeUInt16BE(payloadLength, offset);
      offset += 2;
    } else {
      frame[offset++] = payloadLength;
    }

    // Copy payload
    payload.copy(frame, offset);

    return frame;
  }

  /**
   * Room management methods
   */
  private async joinRoom(
    wsSocket: NextRushWebSocket,
    roomName: string
  ): Promise<void> {
    if (this.rooms.size >= this.options.maxRooms) {
      throw new Error('Maximum number of rooms reached');
    }

    if (!this.rooms.has(roomName)) {
      this.rooms.set(roomName, {
        name: roomName,
        clients: new Set(),
        created: new Date(),
        lastActivity: new Date(),
        messageCount: 0,
        metadata: {},
      });
      this.stats.rooms++;
    }

    const room = this.rooms.get(roomName)!;
    room.clients.add(wsSocket);
    room.lastActivity = new Date();
    wsSocket.rooms.add(roomName);

    this.emit('room:join', wsSocket, roomName);
  }

  private async leaveRoom(
    wsSocket: NextRushWebSocket,
    roomName: string
  ): Promise<void> {
    const room = this.rooms.get(roomName);
    if (!room) return;

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
   * Create room emitter for targeted messaging
   */
  private createRoomEmitter(
    roomName: string,
    excludeSocketId?: string
  ): RoomEmitter {
    return {
      emit: (event: string, ...args: any[]) => {
        this.emitToRoom(roomName, event, args, excludeSocketId);
      },
      send: (data: any) => {
        this.broadcast(data, roomName, excludeSocketId);
      },
      broadcast: (data: any) => {
        this.broadcast(data, roomName, excludeSocketId);
      },
      except: (socketId: string) => {
        return this.createRoomEmitter(roomName, socketId);
      },
      to: (room: string) => {
        return this.createRoomEmitter(room, excludeSocketId);
      },
    };
  }

  /**
   * Broadcasting methods
   */
  private broadcast(
    data: any,
    roomName?: string,
    excludeSocketId?: string
  ): void {
    if (roomName) {
      const room = this.rooms.get(roomName);
      if (room) {
        for (const socket of Array.from(room.clients)) {
          if (excludeSocketId && socket.id === excludeSocketId) continue;
          socket.send(data);
        }
        room.messageCount++;
        room.lastActivity = new Date();
      }
    } else {
      for (const socket of Array.from(this.connections.values())) {
        if (excludeSocketId && socket.id === excludeSocketId) continue;
        socket.send(data);
      }
    }
  }

  /**
   * Utility methods
   */
  private isValidWebSocketUpgrade(req: IncomingMessage): boolean {
    const upgrade = req.headers.upgrade;
    const connection = req.headers.connection;
    const version = req.headers['sec-websocket-version'];
    const key = req.headers['sec-websocket-key'];

    return !!(
      upgrade &&
      upgrade.toLowerCase() === 'websocket' &&
      connection &&
      connection.toLowerCase().includes('upgrade') &&
      version === '13' &&
      key
    );
  }

  private generateAcceptKey(key: string): string {
    return crypto
      .createHash('sha1')
      .update(key + WebSocketPlugin.WEBSOCKET_MAGIC_STRING)
      .digest('base64');
  }

  private rejectConnection(
    socket: Socket,
    status: number,
    message: string
  ): void {
    const response = [
      `HTTP/1.1 ${status} ${message}`,
      'Connection: close',
      '\r\n',
    ].join('\r\n');

    socket.write(response);
    socket.end();
  }

  private sendPing(wsSocket: NextRushWebSocket, data?: Buffer): void {
    const payload = data || Buffer.alloc(0);
    const frame = this.createFrame(WebSocketOpcode.PING, payload);
    wsSocket.socket.write(frame);
  }

  private sendPong(wsSocket: NextRushWebSocket, data?: Buffer): void {
    const payload = data || Buffer.alloc(0);
    const frame = this.createFrame(WebSocketOpcode.PONG, payload);
    wsSocket.socket.write(frame);
  }

  private closeConnection(
    wsSocket: NextRushWebSocket,
    code?: number,
    reason?: string
  ): void {
    if (wsSocket.readyState === WebSocketReadyState.CLOSED) return;

    wsSocket.readyState = WebSocketReadyState.CLOSING;

    const closeCode = code || WebSocketCloseCode.NORMAL_CLOSURE;
    const closeReason = reason || '';
    const payload = Buffer.alloc(2 + Buffer.byteLength(closeReason));
    payload.writeUInt16BE(closeCode, 0);
    Buffer.from(closeReason).copy(payload, 2);

    const frame = this.createFrame(WebSocketOpcode.CLOSE, payload);
    wsSocket.socket.write(frame);

    setTimeout(() => {
      if (wsSocket.readyState !== WebSocketReadyState.CLOSED) {
        wsSocket.socket.destroy();
      }
    }, 1000);
  }

  private handleSocketClose(
    wsSocket: NextRushWebSocket,
    hadError: boolean
  ): void {
    wsSocket.readyState = WebSocketReadyState.CLOSED;
    this.connections.delete(wsSocket.id);
    this.stats.connections--;

    // Remove from all rooms
    for (const roomName of Array.from(wsSocket.rooms)) {
      this.leaveRoom(wsSocket, roomName);
    }

    this.log(
      'info',
      `WebSocket connection closed: ${wsSocket.id} (error: ${hadError})`
    );
  }

  private async runMiddleware(
    wsSocket: NextRushWebSocket,
    req: NextRushRequest
  ): Promise<void> {
    for (const middleware of this.middleware) {
      await new Promise<void>((resolve, reject) => {
        const next = () => resolve();
        try {
          const result = middleware(wsSocket, req, next);
          if (result instanceof Promise) {
            result.catch(reject);
          }
        } catch (error) {
          reject(error);
        }
      });
    }
  }

  private emitToSocket(
    wsSocket: NextRushWebSocket,
    event: string,
    ...args: any[]
  ): void {
    const message = {
      type: 'event',
      event,
      data: args,
      timestamp: Date.now(),
    };
    wsSocket.send(message);
  }

  private emitToRoom(
    roomName: string,
    event: string,
    args: any[],
    excludeSocketId?: string
  ): void {
    const room = this.rooms.get(roomName);
    if (!room) return;

    const message = {
      type: 'event',
      event,
      data: args,
      timestamp: Date.now(),
    };

    for (const socket of Array.from(room.clients)) {
      if (excludeSocketId && socket.id === excludeSocketId) continue;
      socket.send(message);
    }
  }

  private emitToHandlers(
    eventHandlers: Map<string, Function[]>,
    event: string,
    ...args: any[]
  ): void {
    const handlers = eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(...args);
        } catch (error) {
          this.log('error', `Event handler error for ${event}:`, error);
        }
      }
    }
  }

  private startPeriodicTasks(): void {
    // Ping interval for keeping connections alive
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      for (const socket of Array.from(this.connections.values())) {
        if (now - socket.lastPing > this.options.pongTimeout) {
          socket.isAlive = false;
          this.closeConnection(
            socket,
            WebSocketCloseCode.GOING_AWAY,
            'Ping timeout'
          );
        } else {
          socket.ping();
        }
      }
    }, this.options.pingInterval);

    // Room cleanup interval
    this.roomCleanupInterval = setInterval(() => {
      for (const [roomName, room] of Array.from(this.rooms.entries())) {
        if (room.clients.size === 0) {
          this.rooms.delete(roomName);
          this.stats.rooms--;
        }
      }
    }, this.options.roomCleanupInterval);
  }

  private stopPeriodicTasks(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.roomCleanupInterval) {
      clearInterval(this.roomCleanupInterval);
      this.roomCleanupInterval = null;
    }
  }

  private closeAllConnections(): void {
    for (const socket of Array.from(this.connections.values())) {
      this.closeConnection(
        socket,
        WebSocketCloseCode.GOING_AWAY,
        'Server shutdown'
      );
    }
    this.connections.clear();
    this.rooms.clear();
    this.stats.connections = 0;
    this.stats.rooms = 0;
  }

  private getStats(): WebSocketStats {
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.uptime,
    };
  }

  private log(level: string, message: string, ...args: any[]): void {
    if (this.options.debug) {
      console.log(`[WebSocket] ${message}`, ...args);
    }
  }
}
