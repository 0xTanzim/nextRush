import { createHash } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';

export function verifyOrigin(
  req: IncomingMessage,
  allow: (string | RegExp)[]
): boolean {
  if (!allow || allow.length === 0) return true;
  const origin = req.headers.origin;
  if (!origin) return false; // No origin header = reject when origins are specified
  return allow.some(rule =>
    typeof rule === 'string' ? rule === origin : rule.test(origin)
  );
}

export function reject(socket: Socket, code: number, reason: string): void {
  const response =
    `HTTP/1.1 ${code} ${reason}\r\n` +
    'Connection: close\r\n' +
    'Content-Length: 0\r\n' +
    '\r\n';

  try {
    // Write response and close immediately for tests
    socket.write(response, err => {
      if (err) {
        console.error('Failed to write WebSocket rejection:', err);
      }
      try {
        socket.end();
      } catch {
        // Ignore errors
      }
    });
  } catch (error) {
    // If write fails, just destroy the socket
    console.error('Failed to reject WebSocket handshake:', error);
    try {
      socket.destroy();
    } catch {
      // Ignore errors
    }
  }
}

export function performHandshake(
  req: IncomingMessage,
  socket: Socket,
  protocols?: string[]
): boolean {
  const key = req.headers['sec-websocket-key'];
  if (!key || Array.isArray(key)) {
    reject(socket, 400, 'Bad Request');
    return false;
  }
  const accept = createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');

  const protoHeader =
    protocols && protocols.length > 0
      ? `Sec-WebSocket-Protocol: ${protocols[0]}\r\n`
      : '';

  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n` +
      protoHeader +
      '\r\n'
  );

  return true;
}
