/**
 * @nextrush/websocket - Connection Wrapper
 *
 * Wraps the ws library WebSocket with a clean, simple API.
 *
 * @packageDocumentation
 */

const randomUUID = (): string => crypto.randomUUID();
import type { IncomingMessage } from 'node:http';
import type { RoomManager } from './room-manager';
import { WS_READY_STATE_OPEN, type WSConnection } from './types';

/**
 * Internal ws instance interface (avoids external type dependency)
 */
interface WsInstance {
  readyState: number;
  send(data: string | Buffer): void;
  close(code?: number, reason?: string): void;
  ping(data?: Buffer): void;
  pong(data?: Buffer): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
}

// Event handler types
type MessageHandler = (data: string | Buffer) => void;
type CloseHandler = (code: number, reason: string) => void;
type ErrorHandler = (error: Error) => void;
type PingPongHandler = (data: Buffer) => void;

/**
 * WebSocket connection wrapper
 *
 * Provides a clean API over the ws library WebSocket:
 * - Simplified send/receive
 * - Room support via RoomManager
 * - JSON helpers
 * - Event handling
 */
export class Connection implements WSConnection {
  readonly id: string;
  readonly url: string;
  readonly request: IncomingMessage;

  private readonly ws: WsInstance;
  private readonly roomManager: RoomManager;

  constructor(ws: WsInstance, request: IncomingMessage, roomManager: RoomManager) {
    this.id = randomUUID();
    this.url = request.url ?? '/';
    this.request = request;
    this.ws = ws;
    this.roomManager = roomManager;
  }

  get isOpen(): boolean {
    return this.ws.readyState === WS_READY_STATE_OPEN;
  }

  send(data: string | Buffer): void {
    if (this.isOpen) {
      this.ws.send(data);
    }
  }

  json(data: unknown): void {
    try {
      this.send(JSON.stringify(data));
    } catch {
      // JSON.stringify can fail on circular references or BigInt
      // Silently ignore to prevent crashing the server
    }
  }

  close(code = 1000, reason = 'Normal closure'): void {
    this.roomManager.leaveAll(this);
    this.ws.close(code, reason);
  }

  join(room: string): void {
    this.roomManager.join(this, room);
  }

  leave(room: string): void {
    this.roomManager.leave(this, room);
  }

  leaveAll(): void {
    this.roomManager.leaveAll(this);
  }

  getRooms(): string[] {
    return this.roomManager.getRooms(this);
  }

  broadcast(room: string, data: string | Buffer): void {
    this.roomManager.broadcast(room, data, this);
  }

  broadcastJson(room: string, data: unknown): void {
    this.roomManager.broadcastJson(room, data, this);
  }

  on(event: 'message', handler: MessageHandler): void;
  on(event: 'close', handler: CloseHandler): void;
  on(event: 'error', handler: ErrorHandler): void;
  on(event: 'ping', handler: PingPongHandler): void;
  on(event: 'pong', handler: PingPongHandler): void;
  on(
    event: 'message' | 'close' | 'error' | 'ping' | 'pong',
    handler: MessageHandler | CloseHandler | ErrorHandler | PingPongHandler
  ): void {
    switch (event) {
      case 'message':
        this.ws.on('message', (rawData: unknown, isBinary: unknown) => {
          const buffer = Buffer.isBuffer(rawData) ? rawData : Buffer.from(rawData as ArrayBuffer);
          (handler as MessageHandler)(isBinary ? buffer : buffer.toString('utf8'));
        });
        break;

      case 'close':
        this.ws.on('close', (code: unknown, reason: unknown) => {
          this.roomManager.leaveAll(this);
          const reasonStr = Buffer.isBuffer(reason)
            ? reason.toString('utf8')
            : String(reason ?? '');
          (handler as CloseHandler)(code as number, reasonStr);
        });
        break;

      case 'error':
        this.ws.on('error', (error: unknown) => {
          (handler as ErrorHandler)(error as Error);
        });
        break;

      case 'ping':
        this.ws.on('ping', (data: unknown) => {
          (handler as PingPongHandler)(data as Buffer);
        });
        break;

      case 'pong':
        this.ws.on('pong', (data: unknown) => {
          (handler as PingPongHandler)(data as Buffer);
        });
        break;
    }
  }

  off(event: string, handler: (...args: unknown[]) => void): void {
    this.ws.off(event, handler);
  }

  ping(data?: Buffer): void {
    if (this.isOpen) {
      this.ws.ping(data);
    }
  }

  pong(data?: Buffer): void {
    if (this.isOpen) {
      this.ws.pong(data);
    }
  }
}
