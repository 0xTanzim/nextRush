import { RawWSConnection } from '@/plugins/websocket/connection';
import { WSRoomManager } from '@/plugins/websocket/room-manager';
import { IncomingMessage } from 'node:http';
import { Socket } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('WSConnection', () => {
  let mockSocket: Socket;
  let mockReq: IncomingMessage;
  let roomManager: WSRoomManager;
  let connection: RawWSConnection;

  beforeEach(() => {
    mockSocket = {
      write: vi.fn(),
      destroy: vi.fn(),
      on: vi.fn(),
    } as any;

    mockReq = {
      url: '/test',
      headers: {},
    } as IncomingMessage;

    roomManager = new WSRoomManager();
    connection = new RawWSConnection(mockSocket, mockReq, roomManager, 1024);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Properties', () => {
    it('should have a unique ID', () => {
      const conn1 = new RawWSConnection(mockSocket, mockReq, roomManager, 1024);
      const conn2 = new RawWSConnection(mockSocket, mockReq, roomManager, 1024);

      expect(conn1.id).toBeTruthy();
      expect(conn2.id).toBeTruthy();
      expect(conn1.id).not.toBe(conn2.id);
    });

    it('should set URL from request', () => {
      expect(connection.url).toBe('/test');
    });

    it('should initialize as alive', () => {
      expect(connection.isAlive).toBe(true);
    });

    it('should have lastPong timestamp', () => {
      expect(connection.lastPong).toBeTypeOf('number');
    });
  });

  describe('Message Sending', () => {
    it('should send text messages', () => {
      connection.send('hello');

      expect(mockSocket.write).toHaveBeenCalledWith(expect.any(Buffer));
    });

    it('should send binary messages', () => {
      const buffer = Buffer.from('binary data');
      connection.send(buffer);

      expect(mockSocket.write).toHaveBeenCalledWith(expect.any(Buffer));
    });

    it('should frame text messages correctly', () => {
      connection.send('test');

      const calls = vi.mocked(mockSocket.write).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const frame = calls[0]?.[0] as Buffer;

      // Check WebSocket frame structure
      expect(frame[0]).toBe(0x81); // FIN + Text frame
      expect(frame[1]).toBe(4); // Length 4 (unmasked)
      expect(frame.slice(2).toString()).toBe('test');
    });
  });

  describe('Connection Closing', () => {
    it('should close connection with default code and reason', () => {
      connection.close();

      expect(mockSocket.write).toHaveBeenCalled();
      expect(mockSocket.destroy).toHaveBeenCalled();
      expect(connection.isAlive).toBe(false);
    });

    it('should close connection with custom code and reason', () => {
      connection.close(1001, 'Going away');

      expect(mockSocket.write).toHaveBeenCalled();
      expect(mockSocket.destroy).toHaveBeenCalled();
      expect(connection.isAlive).toBe(false);
    });

    it('should emit close event', async () => {
      let closeData: { code: number; reason: string } | null = null;

      connection.onClose((code, reason) => {
        closeData = { code, reason };
      });

      connection.close(1001, 'Going away');

      // Wait a bit for the event
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(closeData).toEqual({
        code: 1001,
        reason: 'Going away',
      });
    });

    it('should handle socket destroy errors gracefully', () => {
      vi.mocked(mockSocket.destroy).mockImplementation(() => {
        throw new Error('Socket error');
      });

      expect(() => connection.close()).not.toThrow();
    });
  });

  describe('Room Management', () => {
    it('should join rooms', () => {
      const spy = vi.spyOn(roomManager, 'add');

      connection.join('room1');

      expect(spy).toHaveBeenCalledWith(connection, 'room1');
    });

    it('should leave rooms', () => {
      const spy = vi.spyOn(roomManager, 'remove');

      connection.leave('room1');

      expect(spy).toHaveBeenCalledWith(connection, 'room1');
    });
  });

  describe('Event Listeners', () => {
    it('should register message listeners', () => {
      const listener = vi.fn();
      connection.onMessage(listener);

      // Trigger a message event
      connection.emit('message', 'test');

      expect(listener).toHaveBeenCalledWith('test');
    });

    it('should register close listeners', () => {
      const listener = vi.fn();
      connection.onClose(listener);

      // Trigger a close event
      connection.emit('close', 1000, 'Normal');

      expect(listener).toHaveBeenCalledWith(1000, 'Normal');
    });
  });

  describe('Ping/Pong', () => {
    it('should send ping frames', () => {
      connection.ping();

      const calls = vi.mocked(mockSocket.write).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const frame = calls[0]?.[0] as Buffer;

      expect(frame[0]).toBe(0x89); // FIN + Ping frame
      expect(frame[1]).toBe(0); // No payload
    });

    it('should mark connection as alive when pong received', async () => {
      const originalLastPong = connection.lastPong;

      // Wait a bit to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10));
      connection.markAlive();

      expect(connection.lastPong).toBeGreaterThan(originalLastPong);
      expect(connection.isAlive).toBe(true);
    });
  });

  describe('Frame Parsing', () => {
    it('should setup data event handler', () => {
      expect(mockSocket.on).toHaveBeenCalledWith('data', expect.any(Function));
    });

    it('should setup close event handler', () => {
      expect(mockSocket.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should setup error event handler', () => {
      expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should handle message events directly', () => {
      const messageListener = vi.fn();
      connection.onMessage(messageListener);

      // Directly emit a message event to test the connection
      connection.emit('message', 'test message');

      expect(messageListener).toHaveBeenCalledWith('test message');
    });
  });

  describe('Socket Event Handlers', () => {
    it('should setup socket event listeners', () => {
      const closeListener = vi.fn();

      connection.onClose(closeListener);

      // Verify event listeners are set up
      expect(mockSocket.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('data', expect.any(Function));
    });

    it('should handle close event directly', () => {
      const closeListener = vi.fn();

      connection.onClose(closeListener);

      // Directly emit close event
      connection.emit('close', 1000, 'Normal close');

      expect(closeListener).toHaveBeenCalledWith(1000, 'Normal close');
    });
  });

  describe('Frame Construction Helpers', () => {
    it('should construct frames with correct headers for different payload sizes', () => {
      // Test small payload (< 126 bytes)
      connection.send('small');
      let calls = vi.mocked(mockSocket.write).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      let frame = calls[0]?.[0] as Buffer;
      expect(frame[1]).toBe(5); // Direct length

      vi.clearAllMocks();

      // Test medium payload (126-65535 bytes)
      const mediumPayload = 'x'.repeat(200);
      connection.send(mediumPayload);
      calls = vi.mocked(mockSocket.write).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      frame = calls[0]?.[0] as Buffer;
      expect(frame[1]).toBe(126); // Extended length indicator
      expect(frame.readUInt16BE(2)).toBe(200); // Actual length

      vi.clearAllMocks();

      // Test large payload (> 65535 bytes) - though we won't actually send that much
      // Just verify the framing logic
      expect(() => connection.send('x'.repeat(70000))).not.toThrow();
    });
  });
});
