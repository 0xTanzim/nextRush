import {
  performHandshake,
  reject,
  verifyOrigin,
} from '@/plugins/websocket/handshake';
import { createHash } from 'node:crypto';
import { IncomingMessage } from 'node:http';
import { Socket } from 'node:net';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('WebSocket Handshake', () => {
  let mockSocket: Socket;
  let mockReq: IncomingMessage;

  beforeEach(() => {
    mockSocket = {
      write: vi.fn(),
      destroy: vi.fn(),
    } as any;

    mockReq = {
      headers: {},
      url: '/ws',
    } as IncomingMessage;
  });

  describe('performHandshake', () => {
    it('should perform successful handshake with valid headers', () => {
      const wsKey = Buffer.from('test-key').toString('base64');
      mockReq.headers = {
        upgrade: 'websocket',
        connection: 'Upgrade',
        'sec-websocket-version': '13',
        'sec-websocket-key': wsKey,
      };

      const result = performHandshake(mockReq, mockSocket);

      expect(result).toBe(true);
      expect(mockSocket.write).toHaveBeenCalled();

      // Verify the response contains correct headers
      const calls = vi.mocked(mockSocket.write).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const response = calls[0]?.[0] as string;
      expect(response).toContain('HTTP/1.1 101 Switching Protocols');
      expect(response).toContain('Upgrade: websocket');
      expect(response).toContain('Connection: Upgrade');
      expect(response).toContain('Sec-WebSocket-Accept:');
    });

    it('should generate correct Sec-WebSocket-Accept header', () => {
      const wsKey = 'dGhlIHNhbXBsZSBub25jZQ==';
      mockReq.headers = {
        upgrade: 'websocket',
        connection: 'Upgrade',
        'sec-websocket-version': '13',
        'sec-websocket-key': wsKey,
      };

      performHandshake(mockReq, mockSocket);

      const calls = vi.mocked(mockSocket.write).mock.calls;
      const response = calls[0]?.[0] as string;

      // Calculate expected accept key
      const magic = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
      const expectedAccept = createHash('sha1')
        .update(wsKey + magic)
        .digest('base64');

      expect(response).toContain(`Sec-WebSocket-Accept: ${expectedAccept}`);
    });

    it('should fail handshake with missing WebSocket key', () => {
      mockReq.headers = {
        upgrade: 'websocket',
        connection: 'Upgrade',
        'sec-websocket-version': '13',
      };

      const result = performHandshake(mockReq, mockSocket);

      expect(result).toBe(false);
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('400 Bad Request')
      );
    });

    it('should handle array WebSocket key (invalid)', () => {
      // TypeScript would prevent this at compile time, but simulate runtime scenario
      mockReq.headers = {
        upgrade: 'websocket',
        connection: 'Upgrade',
        'sec-websocket-version': '13',
      };
      // Simulate the runtime scenario where key is array (should be caught by validation)
      (mockReq.headers as any)['sec-websocket-key'] = ['key1', 'key2'];

      const result = performHandshake(mockReq, mockSocket);

      expect(result).toBe(false);
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('400 Bad Request')
      );
    });

    it('should handle protocol selection', () => {
      const wsKey = Buffer.from('test-key').toString('base64');
      mockReq.headers = {
        upgrade: 'websocket',
        connection: 'Upgrade',
        'sec-websocket-version': '13',
        'sec-websocket-key': wsKey,
        'sec-websocket-protocol': 'chat, superchat',
      };

      const result = performHandshake(mockReq, mockSocket, ['chat']);

      expect(result).toBe(true);
      const calls = vi.mocked(mockSocket.write).mock.calls;
      const response = calls[0]?.[0] as string;
      expect(response).toContain('Sec-WebSocket-Protocol: chat');
    });

    it('should accept any protocols when provided', () => {
      const wsKey = Buffer.from('test-key').toString('base64');
      mockReq.headers = {
        upgrade: 'websocket',
        connection: 'Upgrade',
        'sec-websocket-version': '13',
        'sec-websocket-key': wsKey,
        'sec-websocket-protocol': 'unsupported',
      };

      const result = performHandshake(mockReq, mockSocket, ['chat']);

      expect(result).toBe(true);
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('101 Switching Protocols')
      );
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('Sec-WebSocket-Protocol: chat')
      );
    });
  });

  describe('verifyOrigin', () => {
    it('should accept requests with no origin restrictions', () => {
      mockReq.headers = { origin: 'https://example.com' };

      const result = verifyOrigin(mockReq, []);

      expect(result).toBe(true);
    });

    it('should accept requests with matching allowed origins', () => {
      mockReq.headers = { origin: 'https://allowed.com' };
      const allowedOrigins = [
        'https://allowed.com',
        'https://also-allowed.com',
      ];

      const result = verifyOrigin(mockReq, allowedOrigins);

      expect(result).toBe(true);
    });

    it('should reject requests with non-matching origins', () => {
      mockReq.headers = { origin: 'https://evil.com' };
      const allowedOrigins = ['https://allowed.com'];

      const result = verifyOrigin(mockReq, allowedOrigins);

      expect(result).toBe(false);
    });

    it('should reject requests with no origin header when origins specified', () => {
      const allowedOrigins = ['https://example.com'];
      mockReq.headers.origin = undefined; // No origin header

      const result = verifyOrigin(mockReq, allowedOrigins);

      expect(result).toBe(false);
    });

    it('should handle regex patterns for origins', () => {
      mockReq.headers = { origin: 'https://sub.example.com' };
      const allowedOrigins = [/^https:\/\/.*\.example\.com$/];

      const result = verifyOrigin(mockReq, allowedOrigins);

      expect(result).toBe(true);
    });

    it("should reject regex patterns that don't match", () => {
      mockReq.headers = { origin: 'https://evil.com' };
      const allowedOrigins = [/^https:\/\/.*\.example\.com$/];

      const result = verifyOrigin(mockReq, allowedOrigins);

      expect(result).toBe(false);
    });

    it('should handle empty allowed origins list', () => {
      mockReq.headers = { origin: 'https://example.com' };
      const allowedOrigins: string[] = [];

      const result = verifyOrigin(mockReq, allowedOrigins);

      expect(result).toBe(true);
    });
  });

  describe('reject', () => {
    it('should send custom status code and message', () => {
      reject(mockSocket, 404, 'Not Found');

      const calls = vi.mocked(mockSocket.write).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const response = calls[0]?.[0] as string;
      expect(response).toContain('HTTP/1.1 404 Not Found');
      expect(mockSocket.destroy).toHaveBeenCalled();
    });

    it('should include required headers', () => {
      reject(mockSocket, 400, 'Bad Request');

      const calls = vi.mocked(mockSocket.write).mock.calls;
      const response = calls[0]?.[0] as string;
      expect(response).toContain('Connection: close');
      expect(response).toContain('Content-Length: 0');
    });

    it('should handle socket write errors gracefully', () => {
      vi.mocked(mockSocket.write).mockImplementation(() => {
        throw new Error('Socket error');
      });

      expect(() => reject(mockSocket, 500, 'Error')).toThrow('Socket error');
      expect(mockSocket.destroy).toHaveBeenCalled();
    });

    it('should handle socket destroy errors gracefully', () => {
      vi.mocked(mockSocket.destroy).mockImplementation(() => {
        throw new Error('Socket error');
      });

      expect(() => reject(mockSocket, 500, 'Error')).not.toThrow();
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete handshake flow with origin verification', () => {
      const wsKey = Buffer.from('test-key').toString('base64');
      mockReq.headers = {
        upgrade: 'websocket',
        connection: 'Upgrade',
        'sec-websocket-version': '13',
        'sec-websocket-key': wsKey,
        origin: 'https://allowed.com',
      };

      // First verify origin
      const originOk = verifyOrigin(mockReq, ['https://allowed.com']);
      expect(originOk).toBe(true);

      // Then perform handshake
      const handshakeOk = performHandshake(mockReq, mockSocket);
      expect(handshakeOk).toBe(true);
    });

    it('should reject handshake for invalid origin', () => {
      mockReq.headers = {
        origin: 'https://evil.com',
      };

      const originOk = verifyOrigin(mockReq, ['https://allowed.com']);
      expect(originOk).toBe(false);

      if (!originOk) {
        reject(mockSocket, 403, 'Forbidden');
        expect(mockSocket.write).toHaveBeenCalledWith(
          expect.stringContaining('403 Forbidden')
        );
      }
    });
  });
});
