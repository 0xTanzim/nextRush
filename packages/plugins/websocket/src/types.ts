/**
 * @nextrush/websocket - Type Definitions
 *
 * Clean, minimal types for WebSocket functionality.
 *
 * @packageDocumentation
 */

import type { IncomingMessage } from 'node:http';

/**
 * Maximum room name length to prevent memory exhaustion attacks
 */
export const MAX_ROOM_NAME_LENGTH = 256;

/**
 * Default maximum rooms a single connection can join
 */
export const DEFAULT_MAX_ROOMS_PER_CONNECTION = 100;

/**
 * WebSocket ready state: OPEN
 */
export const WS_READY_STATE_OPEN = 1;

/**
 * WebSocket connection representing a single client
 */
export interface WSConnection {
  /** Unique connection ID */
  readonly id: string;

  /** Connection URL path */
  readonly url: string;

  /** Whether the connection is open */
  readonly isOpen: boolean;

  /** Original HTTP request that initiated the upgrade */
  readonly request: IncomingMessage;

  /** Send a message to this connection */
  send(data: string | Buffer): void;

  /** Send JSON data (automatically stringified) */
  json(data: unknown): void;

  /** Close the connection */
  close(code?: number, reason?: string): void;

  /** Join a room/channel */
  join(room: string): void;

  /** Leave a room/channel */
  leave(room: string): void;

  /** Leave all rooms */
  leaveAll(): void;

  /** Get rooms this connection is in */
  getRooms(): string[];

  /** Broadcast to a room (excluding self) */
  broadcast(room: string, data: string | Buffer): void;

  /** Broadcast JSON to a room (excluding self) */
  broadcastJson(room: string, data: unknown): void;

  /** Register message handler */
  on(event: 'message', handler: (data: string | Buffer) => void): void;

  /** Register close handler */
  on(event: 'close', handler: (code: number, reason: string) => void): void;

  /** Register error handler */
  on(event: 'error', handler: (error: Error) => void): void;

  /** Register ping handler */
  on(event: 'ping', handler: (data: Buffer) => void): void;

  /** Register pong handler */
  on(event: 'pong', handler: (data: Buffer) => void): void;

  /** Remove event handler */
  off(event: string, handler: (...args: unknown[]) => void): void;

  /** Send ping to client */
  ping(data?: Buffer): void;

  /** Send pong to client */
  pong(data?: Buffer): void;
}

/**
 * WebSocket handler function
 */
export type WSHandler = (
  connection: WSConnection,
  request: IncomingMessage
) => void | Promise<void>;

/**
 * WebSocket middleware function
 */
export type WSMiddleware = (
  connection: WSConnection,
  request: IncomingMessage,
  next: () => void | Promise<void>
) => void | Promise<void>;

/**
 * WebSocket route definition
 */
export interface WSRoute {
  /** Route path pattern */
  path: string;

  /** Route handler */
  handler: WSHandler;
}

/**
 * WebSocket plugin options
 */
export interface WebSocketOptions {
  /**
   * Allowed paths for WebSocket connections
   * @default ['/']
   */
  path?: string | string[];

  /**
   * Maximum message size in bytes
   * @default 1048576 (1MB)
   */
  maxPayload?: number;

  /**
   * Heartbeat interval in milliseconds (0 to disable)
   * @default 30000 (30 seconds)
   */
  heartbeatInterval?: number;

  /**
   * Client timeout in milliseconds (no pong response)
   * Connections that don't respond to ping within this time are terminated
   * @default 60000 (60 seconds)
   */
  clientTimeout?: number;

  /**
   * Maximum number of connections (0 for unlimited)
   * @default 0
   */
  maxConnections?: number;

  /**
   * Maximum rooms a single connection can join (0 for unlimited)
   * @default 100
   */
  maxRoomsPerConnection?: number;

  /**
   * Allowed origins for CORS (empty array allows all)
   * When origins are configured, requests without Origin header are denied
   * Supports wildcards: 'https://*.example.com'
   * @default []
   */
  allowedOrigins?: string[];

  /**
   * Custom client verification function
   * Return true to allow, false to reject
   */
  verifyClient?: (request: IncomingMessage) => boolean | Promise<boolean>;

  /**
   * Enable per-message deflate compression
   * @default false
   */
  perMessageDeflate?: boolean;

  /**
   * Called when a connection is established
   */
  onConnection?: (connection: WSConnection) => void;

  /**
   * Called when a connection is closed
   */
  onClose?: (connection: WSConnection, code: number, reason: string) => void;

  /**
   * Called when an error occurs
   */
  onError?: (connection: WSConnection, error: Error) => void;
}

/**
 * WebSocket server interface
 */
export interface WSServer {
  /** Get all active connections */
  getConnections(): WSConnection[];

  /** Get connection count */
  getConnectionCount(): number;

  /** Broadcast to all connections */
  broadcast(data: string | Buffer, exclude?: WSConnection): void;

  /** Broadcast JSON to all connections */
  broadcastJson(data: unknown, exclude?: WSConnection): void;

  /** Broadcast to a specific room */
  broadcastToRoom(room: string, data: string | Buffer, exclude?: WSConnection): void;

  /** Broadcast JSON to a specific room */
  broadcastJsonToRoom(room: string, data: unknown, exclude?: WSConnection): void;

  /** Get all room names */
  getRooms(): string[];

  /** Get connections in a room */
  getRoomConnections(room: string): WSConnection[];

  /** Close all connections */
  closeAll(code?: number, reason?: string): void;
}

/**
 * Default WebSocket options
 */
export const DEFAULT_WS_OPTIONS: Required<
  Omit<WebSocketOptions, 'verifyClient' | 'onConnection' | 'onClose' | 'onError'>
> = {
  path: ['/'],
  maxPayload: 1048576, // 1MB
  heartbeatInterval: 30000, // 30 seconds
  clientTimeout: 60000, // 60 seconds
  maxConnections: 0, // unlimited
  maxRoomsPerConnection: 100, // default limit
  allowedOrigins: [], // allow all
  perMessageDeflate: false,
};

/**
 * Escape special regex characters in a string
 * Used for origin pattern matching
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validate a room name
 * @throws TypeError if invalid
 */
export function validateRoomName(room: string): void {
  if (typeof room !== 'string') {
    throw new TypeError('Room name must be a string');
  }
  if (room.length === 0) {
    throw new TypeError('Room name cannot be empty');
  }
  if (room.length > MAX_ROOM_NAME_LENGTH) {
    throw new TypeError(
      `Room name exceeds maximum length of ${MAX_ROOM_NAME_LENGTH} characters`
    );
  }
}
