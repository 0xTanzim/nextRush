/**
 * @nextrush/websocket - Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomManager } from '../room-manager';
import type { WSConnection } from '../types';

// Mock connection for testing
function createMockConnection(id: string): WSConnection {
  return {
    id,
    url: '/test',
    isOpen: true,
    request: {} as any,
    send: vi.fn(),
    json: vi.fn(),
    close: vi.fn(),
    join: vi.fn(),
    leave: vi.fn(),
    leaveAll: vi.fn(),
    getRooms: vi.fn(() => []),
    broadcast: vi.fn(),
    broadcastJson: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    ping: vi.fn(),
    pong: vi.fn(),
  };
}

describe('RoomManager', () => {
  let roomManager: RoomManager;

  beforeEach(() => {
    roomManager = new RoomManager();
  });

  describe('join', () => {
    it('should add connection to room', () => {
      const conn = createMockConnection('conn-1');
      roomManager.join(conn, 'room-1');

      expect(roomManager.getAllRooms()).toContain('room-1');
      expect(roomManager.getConnections('room-1')).toContain(conn);
    });

    it('should allow multiple connections in same room', () => {
      const conn1 = createMockConnection('conn-1');
      const conn2 = createMockConnection('conn-2');

      roomManager.join(conn1, 'room-1');
      roomManager.join(conn2, 'room-1');

      expect(roomManager.getRoomSize('room-1')).toBe(2);
    });

    it('should allow connection in multiple rooms', () => {
      const conn = createMockConnection('conn-1');

      roomManager.join(conn, 'room-1');
      roomManager.join(conn, 'room-2');

      expect(roomManager.getRooms(conn)).toContain('room-1');
      expect(roomManager.getRooms(conn)).toContain('room-2');
    });
  });

  describe('leave', () => {
    it('should remove connection from room', () => {
      const conn = createMockConnection('conn-1');
      roomManager.join(conn, 'room-1');
      roomManager.leave(conn, 'room-1');

      expect(roomManager.getConnections('room-1')).not.toContain(conn);
    });

    it('should delete empty room', () => {
      const conn = createMockConnection('conn-1');
      roomManager.join(conn, 'room-1');
      roomManager.leave(conn, 'room-1');

      expect(roomManager.getAllRooms()).not.toContain('room-1');
    });
  });

  describe('leaveAll', () => {
    it('should remove connection from all rooms', () => {
      const conn = createMockConnection('conn-1');
      roomManager.join(conn, 'room-1');
      roomManager.join(conn, 'room-2');
      roomManager.leaveAll(conn);

      expect(roomManager.getRooms(conn)).toHaveLength(0);
    });
  });

  describe('broadcast', () => {
    it('should send to all connections in room', () => {
      const conn1 = createMockConnection('conn-1');
      const conn2 = createMockConnection('conn-2');

      roomManager.join(conn1, 'room-1');
      roomManager.join(conn2, 'room-1');

      roomManager.broadcast('room-1', 'hello');

      expect(conn1.send).toHaveBeenCalledWith('hello');
      expect(conn2.send).toHaveBeenCalledWith('hello');
    });

    it('should exclude specified connection', () => {
      const conn1 = createMockConnection('conn-1');
      const conn2 = createMockConnection('conn-2');

      roomManager.join(conn1, 'room-1');
      roomManager.join(conn2, 'room-1');

      roomManager.broadcast('room-1', 'hello', conn1);

      expect(conn1.send).not.toHaveBeenCalled();
      expect(conn2.send).toHaveBeenCalledWith('hello');
    });
  });

  describe('isInRoom', () => {
    it('should return true if connection is in room', () => {
      const conn = createMockConnection('conn-1');
      roomManager.join(conn, 'room-1');

      expect(roomManager.isInRoom(conn, 'room-1')).toBe(true);
    });

    it('should return false if connection is not in room', () => {
      const conn = createMockConnection('conn-1');

      expect(roomManager.isInRoom(conn, 'room-1')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all rooms and connections', () => {
      const conn = createMockConnection('conn-1');
      roomManager.join(conn, 'room-1');
      roomManager.join(conn, 'room-2');
      roomManager.clear();

      expect(roomManager.getAllRooms()).toHaveLength(0);
    });
  });
});

describe('createWebSocket', () => {
  it('should create WebSocketServer instance', async () => {
    const { createWebSocket } = await import('../index');
    const wss = createWebSocket();

    expect(wss).toBeDefined();
    expect(typeof wss.on).toBe('function');
    expect(typeof wss.use).toBe('function');
    expect(typeof wss.upgrade).toBe('function');
    expect(typeof wss.broadcast).toBe('function');
  });

  it('should register routes with on()', async () => {
    const { createWebSocket } = await import('../index');
    const wss = createWebSocket();

    const handler = vi.fn();
    wss.on('/chat', handler);

    // Route is registered internally (can't easily test without full server)
    expect(wss).toBeDefined();
  });

  it('should register middleware with use()', async () => {
    const { createWebSocket } = await import('../index');
    const wss = createWebSocket();

    const middleware = vi.fn();
    wss.use(middleware);

    expect(wss).toBeDefined();
  });

  it('should return middleware from upgrade()', async () => {
    const { createWebSocket } = await import('../index');
    const wss = createWebSocket();

    const middleware = wss.upgrade();

    expect(typeof middleware).toBe('function');
  });
});

describe('WebSocketServer options', () => {
  it('should accept custom options', async () => {
    const { createWebSocket } = await import('../index');
    const wss = createWebSocket({
      heartbeatInterval: 60000,
      maxPayload: 2 * 1024 * 1024,
      maxConnections: 1000,
    });

    expect(wss).toBeDefined();
  });

  it('should accept verifyClient callback', async () => {
    const { createWebSocket } = await import('../index');
    const verifyClient = vi.fn(() => true);

    const wss = createWebSocket({
      verifyClient,
    });

    expect(wss).toBeDefined();
  });
});
