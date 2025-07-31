/**
 * 🔌 WebSocket Connection Handler
 * Manages individual WebSocket connections with event handling
 */

import * as crypto from 'crypto';
import { IncomingMessage } from 'http';
import { Socket } from 'net';
import { WSFrameParser } from './frame-parser';
import {
  WebSocketState,
  WSCloseCode,
  WSConnection,
  WSFrame,
  WSOpcode,
} from './types';

/**
 * WebSocket connection implementation
 */
export class WSConnectionHandler {
  private frameParser: WSFrameParser;

  constructor(maxMessageSize: number = 1024 * 1024) {
    this.frameParser = new WSFrameParser(maxMessageSize);
  }

  /**
   * Create WebSocket connection wrapper
   */
  createConnection(
    socket: Socket,
    req: IncomingMessage,
    roomManager: any
  ): WSConnection {
    const id = crypto.randomUUID();
    const ip = this.extractIP(req);

    // Event emitter for individual WebSocket connections
    const eventHandlers = new Map<string, Function[]>();

    const wsSocket: WSConnection = {
      id,
      socket,
      readyState: WebSocketState.OPEN,
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
        this.broadcast(wsSocket, data, room, roomManager),
      join: (room: string) => roomManager.joinRoom(wsSocket, room),
      leave: (room: string) => roomManager.leaveRoom(wsSocket, room),
      to: (room: string) => roomManager.createRoomEmitter(room, wsSocket.id),
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
   * Extract IP address from request
   */
  private extractIP(req: IncomingMessage): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.socket.remoteAddress ||
      '127.0.0.1'
    );
  }

  /**
   * Setup socket event handlers for frame processing
   */
  private setupSocketHandlers(
    wsSocket: WSConnection,
    eventHandlers: Map<string, Function[]>
  ): void {
    wsSocket.socket.on('data', (buffer: Buffer) => {
      try {
        const frames = this.frameParser.parseFrames(buffer);
        for (const frame of frames) {
          this.handleFrame(wsSocket, frame, eventHandlers);
        }
      } catch (error) {
        console.error(`Frame parsing error for ${wsSocket.id}:`, error);
        this.closeConnection(wsSocket, WSCloseCode.PROTOCOL_ERROR);
      }
    });

    wsSocket.socket.on('close', (hadError: boolean) => {
      this.handleSocketClose(wsSocket, hadError);
    });

    wsSocket.socket.on('error', (error: Error) => {
      console.error(`Socket error for ${wsSocket.id}:`, error);
      this.emitToHandlers(eventHandlers, 'error', error);
    });
  }

  /**
   * Handle WebSocket frame
   */
  private handleFrame(
    wsSocket: WSConnection,
    frame: WSFrame,
    eventHandlers: Map<string, Function[]>
  ): void {
    wsSocket.lastActivity = new Date();

    switch (frame.opcode) {
      case WSOpcode.TEXT:
        const textData = frame.payload.toString('utf8');
        this.emitToHandlers(eventHandlers, 'message', textData);
        break;

      case WSOpcode.BINARY:
        this.emitToHandlers(eventHandlers, 'message', frame.payload);
        break;

      case WSOpcode.CLOSE:
        const closeCode =
          frame.payload.length >= 2
            ? frame.payload.readUInt16BE(0)
            : WSCloseCode.NORMAL_CLOSURE;
        const closeReason =
          frame.payload.length > 2
            ? frame.payload.slice(2).toString('utf8')
            : '';
        this.closeConnection(wsSocket, closeCode, closeReason);
        break;

      case WSOpcode.PING:
        this.sendPong(wsSocket, frame.payload);
        this.emitToHandlers(eventHandlers, 'ping', frame.payload);
        break;

      case WSOpcode.PONG:
        wsSocket.isAlive = true;
        wsSocket.lastPing = Date.now();
        this.emitToHandlers(eventHandlers, 'pong', frame.payload);
        break;
    }
  }

  /**
   * Send message to WebSocket client
   */
  private sendMessage(
    wsSocket: WSConnection,
    data: string | Buffer | object
  ): void {
    if (wsSocket.readyState !== WebSocketState.OPEN) {
      return;
    }

    let frame: Buffer;

    if (typeof data === 'string') {
      frame = this.frameParser.createTextFrame(data);
    } else if (Buffer.isBuffer(data)) {
      frame = this.frameParser.createBinaryFrame(data);
    } else {
      frame = this.frameParser.createTextFrame(JSON.stringify(data));
    }

    wsSocket.socket.write(frame);
  }

  /**
   * Send ping to client
   */
  private sendPing(wsSocket: WSConnection, data?: Buffer): void {
    const frame = this.frameParser.createPingFrame(data);
    wsSocket.socket.write(frame);
  }

  /**
   * Send pong to client
   */
  private sendPong(wsSocket: WSConnection, data?: Buffer): void {
    const frame = this.frameParser.createPongFrame(data);
    wsSocket.socket.write(frame);
  }

  /**
   * Close WebSocket connection
   */
  private closeConnection(
    wsSocket: WSConnection,
    code?: number,
    reason?: string
  ): void {
    if (wsSocket.readyState === WebSocketState.CLOSED) return;

    wsSocket.readyState = WebSocketState.CLOSING;

    const frame = this.frameParser.createCloseFrame(code, reason);
    wsSocket.socket.write(frame);

    setTimeout(() => {
      if (wsSocket.readyState !== WebSocketState.CLOSED) {
        wsSocket.socket.destroy();
      }
    }, 1000);
  }

  /**
   * Handle socket close
   */
  private handleSocketClose(wsSocket: WSConnection, hadError: boolean): void {
    wsSocket.readyState = WebSocketState.CLOSED;
    console.log(
      `WebSocket connection closed: ${wsSocket.id} (error: ${hadError})`
    );
  }

  /**
   * Broadcast message
   */
  private broadcast(
    wsSocket: WSConnection,
    data: any,
    room?: string,
    roomManager?: any
  ): void {
    if (room && roomManager) {
      roomManager.broadcastToRoom(room, data, wsSocket.id);
    } else {
      // Global broadcast would need connection manager
      console.log('Global broadcast not implemented in connection handler');
    }
  }

  /**
   * Emit event to socket
   */
  private emitToSocket(
    wsSocket: WSConnection,
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

  /**
   * Emit to event handlers
   */
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
          console.error(`Event handler error for ${event}:`, error);
        }
      }
    }
  }
}
