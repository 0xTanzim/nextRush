/**
 * 🌐 WebSocket Core Types & Interfaces
 * Core type definitions for NextRush WebSocket system
 */

import { IncomingMessage } from 'http';
import { Socket } from 'net';
import { NextRushRequest } from '../../types/express';

/**
 * WebSocket connection state
 */
export enum WebSocketState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3,
}

/**
 * WebSocket opcodes for frame types
 */
export enum WSOpcode {
  CONTINUATION = 0x0,
  TEXT = 0x1,
  BINARY = 0x2,
  CLOSE = 0x8,
  PING = 0x9,
  PONG = 0xa,
}

/**
 * WebSocket close codes
 */
export enum WSCloseCode {
  NORMAL_CLOSURE = 1000,
  GOING_AWAY = 1001,
  PROTOCOL_ERROR = 1002,
  UNSUPPORTED_DATA = 1003,
  NO_STATUS_RCVD = 1005,
  ABNORMAL_CLOSURE = 1006,
  INVALID_FRAME_PAYLOAD_DATA = 1007,
  POLICY_VIOLATION = 1008,
  MESSAGE_TOO_BIG = 1009,
  MANDATORY_EXTENSION = 1010,
  INTERNAL_SERVER_ERROR = 1011,
}

/**
 * WebSocket frame structure
 */
export interface WSFrame {
  fin: boolean;
  rsv1: boolean;
  rsv2: boolean;
  rsv3: boolean;
  opcode: WSOpcode;
  masked: boolean;
  payloadLength: number;
  maskingKey?: Buffer;
  payload: Buffer;
}

/**
 * WebSocket connection wrapper
 */
export interface WSConnection {
  id: string;
  socket: Socket;
  readyState: WebSocketState;
  protocol: string;
  extensions: string[];
  ip: string;
  userAgent: string;
  origin: string;
  rooms: Set<string>;
  isAlive: boolean;
  lastPing: number;
  metadata: Record<string, any>;
  connectedAt: Date;
  lastActivity: Date;

  // Core methods
  send(data: string | Buffer | object): void;
  ping(data?: Buffer): void;
  pong(data?: Buffer): void;
  close(code?: number, reason?: string): void;

  // Enhanced methods
  broadcast(data: any, room?: string): void;
  join(room: string): void;
  leave(room: string): void;
  to(room: string): RoomEmitter;
  emit(event: string, ...args: any[]): void;

  // Event handling
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler?: (...args: any[]) => void): void;
  once(event: string, handler: (...args: any[]) => void): void;
}

/**
 * Room information
 */
export interface RoomInfo {
  name: string;
  clients: Set<WSConnection>;
  created: Date;
  lastActivity: Date;
  messageCount: number;
  metadata: Record<string, any>;
}

/**
 * Room emitter for targeted messaging
 */
export interface RoomEmitter {
  emit(event: string, ...args: any[]): void;
  send(data: any): void;
  broadcast(data: any): void;
  except(socketId: string): RoomEmitter;
  to(room: string): RoomEmitter;
}

/**
 * WebSocket handler function
 */
export type WSHandler = (
  socket: WSConnection,
  req: NextRushRequest
) => void | Promise<void>;

/**
 * WebSocket middleware function
 */
export type WSMiddleware = (
  socket: WSConnection,
  req: NextRushRequest,
  next: () => void
) => void | Promise<void>;

/**
 * WebSocket configuration options
 */
export interface WSOptions {
  maxConnections?: number;
  pingInterval?: number;
  pongTimeout?: number;
  maxMessageSize?: number;
  protocols?: string[];
  extensions?: string[];
  maxRooms?: number;
  roomCleanupInterval?: number;
  compression?: boolean;
  binaryType?: 'buffer' | 'arraybuffer';
  debug?: boolean;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
  verifyClient?: (req: IncomingMessage) => boolean | Promise<boolean>;
  allowOrigins?: string[];
}

/**
 * WebSocket statistics
 */
export interface WSStats {
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
 * Default WebSocket options
 */
export const DEFAULT_WS_OPTIONS: Required<WSOptions> = {
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
};

/**
 * WebSocket magic string for handshake (RFC 6455)
 */
export const WS_MAGIC_STRING = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
