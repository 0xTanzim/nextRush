/**
 * 🔒 WebSocket Handshake Handler
 * RFC 6455 compliant WebSocket handshake implementation
 */

import * as crypto from 'crypto';
import { IncomingMessage } from 'http';
import { Socket } from 'net';
import { WS_MAGIC_STRING } from './types';

/**
 * WebSocket handshake handler
 */
export class WSHandshakeHandler {
  /**
   * Validate WebSocket upgrade request
   */
  static isValidUpgrade(req: IncomingMessage): boolean {
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

  /**
   * Generate WebSocket accept key
   */
  static generateAcceptKey(key: string): string {
    return crypto
      .createHash('sha1')
      .update(key + WS_MAGIC_STRING)
      .digest('base64');
  }

  /**
   * Perform WebSocket handshake
   */
  static performHandshake(
    req: IncomingMessage,
    socket: Socket,
    protocols: string[] = []
  ): boolean {
    try {
      if (!this.isValidUpgrade(req)) {
        this.rejectConnection(socket, 400, 'Bad Request');
        return false;
      }

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
      if (requestedProtocols && protocols.length > 0) {
        const clientProtocols = requestedProtocols
          .split(',')
          .map((p) => p.trim());
        const supportedProtocol = clientProtocols.find((p) =>
          protocols.includes(p)
        );
        if (supportedProtocol) {
          responseHeaders.push(`Sec-WebSocket-Protocol: ${supportedProtocol}`);
        }
      }

      socket.write(responseHeaders.join('\r\n') + '\r\n\r\n');
      return true;
    } catch (error) {
      this.rejectConnection(socket, 500, 'Internal Server Error');
      return false;
    }
  }

  /**
   * Reject WebSocket connection
   */
  static rejectConnection(
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

  /**
   * Verify client origin
   */
  static verifyOrigin(req: IncomingMessage, allowedOrigins: string[]): boolean {
    if (!allowedOrigins || allowedOrigins.length === 0) {
      return true;
    }

    const origin = req.headers.origin;
    return !!(origin && allowedOrigins.includes(origin));
  }

  /**
   * Extract protocols from request
   */
  static extractProtocols(req: IncomingMessage): string[] {
    const protocolHeader = req.headers['sec-websocket-protocol'];
    if (!protocolHeader) return [];

    return protocolHeader.split(',').map((p) => p.trim());
  }

  /**
   * Extract extensions from request
   */
  static extractExtensions(req: IncomingMessage): string[] {
    const extensionHeader = req.headers['sec-websocket-extensions'];
    if (!extensionHeader) return [];

    return extensionHeader.split(',').map((e) => e.trim());
  }
}
