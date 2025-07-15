/**
 * 🚀 NextRush WebSocket - Type Definitions
 * Zero-dependency WebSocket implementation using raw Node.js
 * RFC 6455 compliant with advanced room and event management
 */

import { IncomingMessage } from 'http';
import { Socket } from 'net';
import { NextRushRequest } from './express';

/**
 * WebSocket connection states (RFC 6455)
 */
export enum WebSocketReadyState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3,
}

/**
 * WebSocket frame opcodes (RFC 6455)
 */
export enum WebSocketOpcode {
  CONTINUATION = 0x0,
  TEXT = 0x1,
  BINARY = 0x2,
  CLOSE = 0x8,
  PING = 0x9,
  PONG = 0xa,
}

/**
 * WebSocket close codes (RFC 6455)
 */
export enum WebSocketCloseCode {
  NORMAL_CLOSURE = 1000,
  GOING_AWAY = 1001,
  PROTOCOL_ERROR = 1002,
  UNSUPPORTED_DATA = 1003,
  NO_STATUS_RECEIVED = 1005,
  ABNORMAL_CLOSURE = 1006,
  INVALID_FRAME_PAYLOAD_DATA = 1007,
  POLICY_VIOLATION = 1008,
  MESSAGE_TOO_BIG = 1009,
  MANDATORY_EXTENSION = 1010,
  INTERNAL_ERROR = 1011,
  SERVICE_RESTART = 1012,
  TRY_AGAIN_LATER = 1013,
  TLS_HANDSHAKE = 1015,
}

/**
 * NextRush WebSocket Connection
 * Pure Node.js implementation with advanced features
 */
export interface NextRushWebSocket {
  // Core properties
  id: string;
  socket: Socket;
  readyState: WebSocketReadyState;
  protocol: string;
  extensions: string[];

  // Core WebSocket methods (RFC 6455)
  send(data: string | Buffer | object): void;
  ping(data?: Buffer): void;
  pong(data?: Buffer): void;
  close(code?: number, reason?: string): void;

  // Enhanced NextRush methods
  broadcast(data: string | Buffer | object, room?: string): void;
  join(room: string): Promise<void>;
  leave(room: string): Promise<void>;
  to(room: string): RoomEmitter;
  emit(event: string, ...args: any[]): void;

  // Connection metadata
  ip: string;
  userAgent: string;
  origin: string;
  rooms: Set<string>;
  isAlive: boolean;
  lastPing: number;
  metadata: Record<string, any>;

  // Timing information
  connectedAt: Date;
  lastActivity: Date;
}

/**
 * WebSocket frame structure for parsing
 */
export interface WebSocketFrame {
  fin: boolean;
  rsv1: boolean;
  rsv2: boolean;
  rsv3: boolean;
  opcode: WebSocketOpcode;
  masked: boolean;
  payloadLength: number;
  maskingKey?: Buffer;
  payload: Buffer;
}

/**
 * Room-based messaging interface
 */
export interface RoomEmitter {
  emit(event: string, ...args: any[]): void;
  send(data: string | Buffer | object): void;
  broadcast(data: string | Buffer | object): void;
  except(socketId: string): RoomEmitter;
  to(room: string): RoomEmitter;
}

/**
 * Room information and management
 */
export interface RoomInfo {
  name: string;
  clients: Set<NextRushWebSocket>;
  created: Date;
  lastActivity: Date;
  messageCount: number;
  metadata: Record<string, any>;
}

/**
 * WebSocket server configuration options
 */
export interface WebSocketOptions {
  // Connection management
  maxConnections?: number;
  pingInterval?: number;
  pongTimeout?: number;

  // Security and validation
  verifyClient?: (req: IncomingMessage) => boolean | Promise<boolean>;
  allowOrigins?: string[];
  maxMessageSize?: number;

  // Protocol support
  protocols?: string[];
  extensions?: string[];

  // Room management
  maxRooms?: number;
  roomCleanupInterval?: number;

  // Performance tuning
  compression?: boolean;
  binaryType?: 'buffer' | 'arraybuffer';

  // Development features
  debug?: boolean;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
}

/**
 * WebSocket message structure
 */
export interface WebSocketMessage<T = any> {
  id: string;
  type: 'text' | 'binary' | 'ping' | 'pong' | 'close';
  data: T;
  timestamp: number;
  socket: NextRushWebSocket;
  room?: string;
}

/**
 * WebSocket event handlers
 */
export type WebSocketHandler = (
  socket: NextRushWebSocket,
  req: NextRushRequest
) => void | Promise<void>;
export type WebSocketMessageHandler<T = any> = (
  data: T,
  socket: NextRushWebSocket
) => void | Promise<void>;
export type WebSocketErrorHandler = (
  error: Error,
  socket: NextRushWebSocket
) => void;
export type WebSocketCloseHandler = (
  code: number,
  reason: string,
  socket: NextRushWebSocket
) => void;

/**
 * Connection event handlers
 */
export interface ConnectionEvents {
  connection: (socket: NextRushWebSocket, req: NextRushRequest) => void;
  message: (message: WebSocketMessage) => void;
  error: (error: Error, socket?: NextRushWebSocket) => void;
  close: (socket: NextRushWebSocket, code: number, reason: string) => void;
  ping: (socket: NextRushWebSocket, data?: Buffer) => void;
  pong: (socket: NextRushWebSocket, data?: Buffer) => void;

  // Room events
  'room:join': (socket: NextRushWebSocket, room: string) => void;
  'room:leave': (socket: NextRushWebSocket, room: string) => void;
  'room:created': (room: string) => void;
  'room:destroyed': (room: string) => void;
}

/**
 * WebSocket middleware for connection handling
 */
export type WebSocketMiddleware = (
  socket: NextRushWebSocket,
  req: NextRushRequest,
  next: () => void
) => void | Promise<void>;

/**
 * WebSocket server statistics
 */
export interface WebSocketStats {
  connections: number;
  totalConnections: number;
  messagesSent: number;
  messagesReceived: number;
  rooms: number;
  uptime: number;
  bytesReceived: number;
  bytesSent: number;
  errors: number;
  reconnections: number;
}

/**
 * WebSocket error interface
 */
export interface WebSocketError extends Error {
  code: string;
  socket?: NextRushWebSocket;
  closeCode?: WebSocketCloseCode;
}

/**
 * Broadcasting options
 */
export interface BroadcastOptions {
  rooms?: string[];
  except?: string | string[];
  volatile?: boolean;
  compress?: boolean;
}

/**
 * Type-safe event definitions for better DX
 */
export interface TypedWebSocketEvents {
  // System events
  'system:heartbeat': { timestamp: number };
  'system:reconnect': { attempt: number };
  'system:error': { message: string; code?: string };

  // User events
  'user:join': { userId: string; room: string };
  'user:leave': { userId: string; room: string };
  'user:message': { message: string; userId: string; room?: string };

  // Custom events (extensible)
  [key: string]: any;
}
