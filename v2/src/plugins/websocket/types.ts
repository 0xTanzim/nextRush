import type { IncomingMessage } from 'node:http';

export interface WebSocketPluginOptions {
  path?: string | string[]; // accepted paths (exact or wildcard *)
  heartbeatMs?: number; // ping interval
  pongTimeoutMs?: number; // close if no pong
  maxConnections?: number;
  maxMessageSize?: number; // bytes
  allowOrigins?: (string | RegExp)[];
  verifyClient?: (req: IncomingMessage) => Promise<boolean> | boolean;
  debug?: boolean;
}

export type WSHandler = (
  socket: WSConnection,
  req: IncomingMessage
) => void | Promise<void>;
export type WSMiddleware = (
  socket: WSConnection,
  req: IncomingMessage,
  next: () => void
) => void | Promise<void>;

export interface WSConnection {
  id: string;
  url: string;
  isAlive: boolean;
  lastPong: number;
  send(data: string | Buffer): void;
  close(code?: number, reason?: string): void;
  join(room: string): void;
  leave(room: string): void;
  onMessage(listener: (data: string | Buffer) => void): void;
  onClose(listener: (code: number, reason: string) => void): void;
}

export const DEFAULT_OPTIONS: Required<WebSocketPluginOptions> = {
  path: '/ws',
  heartbeatMs: 30000,
  pongTimeoutMs: 45000,
  maxConnections: 10000,
  maxMessageSize: 1 << 20, // 1MB
  allowOrigins: [],
  verifyClient: () => true,
  debug: false,
};
