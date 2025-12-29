/**
 * @nextrush/websocket - Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MaxRoomsExceededError, RoomManager } from '../room-manager';
import type { WSConnection } from '../types';
import {
    DEFAULT_MAX_ROOMS_PER_CONNECTION,
    DEFAULT_WS_OPTIONS,
    escapeRegex,
    MAX_ROOM_NAME_LENGTH,
    validateRoomName,
    WS_READY_STATE_OPEN,
} from '../types';

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

    it('should reject empty room name', () => {
      const conn = createMockConnection('conn-1');
      expect(() => roomManager.join(conn, '')).toThrow(TypeError);
      expect(() => roomManager.join(conn, '')).toThrow('cannot be empty');
    });

    it('should reject room name exceeding max length', () => {
      const conn = createMockConnection('conn-1');
      const longName = 'a'.repeat(MAX_ROOM_NAME_LENGTH + 1);
      expect(() => roomManager.join(conn, longName)).toThrow(TypeError);
      expect(() => roomManager.join(conn, longName)).toThrow('exceeds maximum length');
    });

    it('should accept room name at max length', () => {
      const conn = createMockConnection('conn-1');
      const maxName = 'a'.repeat(MAX_ROOM_NAME_LENGTH);
      roomManager.join(conn, maxName);
      expect(roomManager.isInRoom(conn, maxName)).toBe(true);
    });

    it('should throw MaxRoomsExceededError when limit reached', () => {
      const maxRooms = 3;
      const manager = new RoomManager(maxRooms);
      const conn = createMockConnection('conn-1');

      manager.join(conn, 'room-1');
      manager.join(conn, 'room-2');
      manager.join(conn, 'room-3');

      expect(() => manager.join(conn, 'room-4')).toThrow(MaxRoomsExceededError);
    });

    it('should allow rejoining same room without throwing', () => {
      const maxRooms = 3;
      const manager = new RoomManager(maxRooms);
      const conn = createMockConnection('conn-1');

      manager.join(conn, 'room-1');
      manager.join(conn, 'room-2');
      manager.join(conn, 'room-3');

      // Rejoining same room should not throw
      expect(() => manager.join(conn, 'room-1')).not.toThrow();
    });

    it('should allow unlimited rooms when maxRoomsPerConnection is 0', () => {
      const manager = new RoomManager(0);
      const conn = createMockConnection('conn-1');

      for (let i = 0; i < 200; i++) {
        manager.join(conn, `room-${i}`);
      }

      expect(manager.getRooms(conn)).toHaveLength(200);
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

  describe('broadcastJson', () => {
    it('should handle JSON.stringify errors gracefully', () => {
      const conn = createMockConnection('conn-1');
      roomManager.join(conn, 'room-1');

      // Create circular reference
      const circular: Record<string, unknown> = {};
      circular.self = circular;

      // Should not throw
      expect(() => roomManager.broadcastJson('room-1', circular)).not.toThrow();
      expect(conn.send).not.toHaveBeenCalled();
    });
  });

  describe('setMaxRoomsPerConnection', () => {
    it('should update max rooms limit', () => {
      roomManager.setMaxRoomsPerConnection(5);
      expect(roomManager.getMaxRoomsPerConnection()).toBe(5);
    });
  });
});

describe('validateRoomName', () => {
  it('should accept valid room names', () => {
    expect(() => validateRoomName('chat')).not.toThrow();
    expect(() => validateRoomName('room-123')).not.toThrow();
    expect(() => validateRoomName('user:alice')).not.toThrow();
    expect(() => validateRoomName('a')).not.toThrow();
  });

  it('should reject non-string values', () => {
    expect(() => validateRoomName(null as unknown as string)).toThrow('must be a string');
    expect(() => validateRoomName(123 as unknown as string)).toThrow('must be a string');
    expect(() => validateRoomName(undefined as unknown as string)).toThrow('must be a string');
  });

  it('should reject empty strings', () => {
    expect(() => validateRoomName('')).toThrow('cannot be empty');
  });

  it('should reject strings exceeding max length', () => {
    const longName = 'a'.repeat(MAX_ROOM_NAME_LENGTH + 1);
    expect(() => validateRoomName(longName)).toThrow('exceeds maximum length');
  });
});

describe('escapeRegex', () => {
  it('should escape special regex characters', () => {
    expect(escapeRegex('.')).toBe('\\.');
    expect(escapeRegex('.*')).toBe('\\.\\*');
    expect(escapeRegex('example.com')).toBe('example\\.com');
    expect(escapeRegex('a+b')).toBe('a\\+b');
    expect(escapeRegex('a?b')).toBe('a\\?b');
    expect(escapeRegex('[abc]')).toBe('\\[abc\\]');
    expect(escapeRegex('(a|b)')).toBe('\\(a\\|b\\)');
    expect(escapeRegex('^start$end')).toBe('\\^start\\$end');
  });

  it('should not modify alphanumeric characters', () => {
    expect(escapeRegex('abc123')).toBe('abc123');
    expect(escapeRegex('hello-world')).toBe('hello-world');
  });
});

describe('Constants', () => {
  it('should export MAX_ROOM_NAME_LENGTH', () => {
    expect(MAX_ROOM_NAME_LENGTH).toBe(256);
  });

  it('should export DEFAULT_MAX_ROOMS_PER_CONNECTION', () => {
    expect(DEFAULT_MAX_ROOMS_PER_CONNECTION).toBe(100);
  });

  it('should export WS_READY_STATE_OPEN', () => {
    expect(WS_READY_STATE_OPEN).toBe(1);
  });

  it('should export DEFAULT_WS_OPTIONS with correct values', () => {
    expect(DEFAULT_WS_OPTIONS.path).toEqual(['/']);
    expect(DEFAULT_WS_OPTIONS.maxPayload).toBe(1048576);
    expect(DEFAULT_WS_OPTIONS.heartbeatInterval).toBe(30000);
    expect(DEFAULT_WS_OPTIONS.clientTimeout).toBe(60000);
    expect(DEFAULT_WS_OPTIONS.maxConnections).toBe(0);
    expect(DEFAULT_WS_OPTIONS.maxRoomsPerConnection).toBe(100);
    expect(DEFAULT_WS_OPTIONS.allowedOrigins).toEqual([]);
    expect(DEFAULT_WS_OPTIONS.perMessageDeflate).toBe(false);
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

  it('should accept maxRoomsPerConnection option', async () => {
    const { createWebSocket } = await import('../index');
    const wss = createWebSocket({
      maxRoomsPerConnection: 50,
    });

    expect(wss).toBeDefined();
  });

  it('should accept allowedOrigins option', async () => {
    const { createWebSocket } = await import('../index');
    const wss = createWebSocket({
      allowedOrigins: ['https://example.com', 'https://*.example.com'],
    });

    expect(wss).toBeDefined();
  });
});

describe('WebSocketServer API', () => {
  it('should export getConnections method', async () => {
    const { createWebSocket } = await import('../index');
    const wss = createWebSocket();

    expect(typeof wss.getConnections).toBe('function');
    expect(wss.getConnections()).toEqual([]);
  });

  it('should export getConnectionCount method', async () => {
    const { createWebSocket } = await import('../index');
    const wss = createWebSocket();

    expect(typeof wss.getConnectionCount).toBe('function');
    expect(wss.getConnectionCount()).toBe(0);
  });

  it('should export broadcast method', async () => {
    const { createWebSocket } = await import('../index');
    const wss = createWebSocket();

    expect(typeof wss.broadcast).toBe('function');
  });

  it('should export broadcastJson method', async () => {
    const { createWebSocket } = await import('../index');
    const wss = createWebSocket();

    expect(typeof wss.broadcastJson).toBe('function');
  });

  it('should export getRooms method', async () => {
    const { createWebSocket } = await import('../index');
    const wss = createWebSocket();

    expect(typeof wss.getRooms).toBe('function');
    expect(wss.getRooms()).toEqual([]);
  });

  it('should export closeAll method', async () => {
    const { createWebSocket } = await import('../index');
    const wss = createWebSocket();

    expect(typeof wss.closeAll).toBe('function');
  });

  it('should export close method', async () => {
    const { createWebSocket } = await import('../index');
    const wss = createWebSocket();

    expect(typeof wss.close).toBe('function');
  });
});

describe('Exports', () => {
  it('should export all required types and classes', async () => {
    const exports = await import('../index');

    // Factory functions
    expect(typeof exports.createWebSocket).toBe('function');
    expect(typeof exports.withWebSocket).toBe('function');

    // Classes
    expect(exports.WebSocketServer).toBeDefined();
    expect(exports.Connection).toBeDefined();
    expect(exports.RoomManager).toBeDefined();
    expect(exports.MaxRoomsExceededError).toBeDefined();

    // Constants
    expect(exports.MAX_ROOM_NAME_LENGTH).toBe(256);
    expect(exports.DEFAULT_MAX_ROOMS_PER_CONNECTION).toBe(100);
    expect(exports.WS_READY_STATE_OPEN).toBe(1);
    expect(exports.DEFAULT_WS_OPTIONS).toBeDefined();
  });
});
