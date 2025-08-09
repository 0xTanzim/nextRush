import { WSRoomManager } from '@/plugins/websocket/room-manager';
import type { WSConnection } from '@/plugins/websocket/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('WSRoomManager', () => {
  let roomManager: WSRoomManager;
  let mockConnection1: WSConnection;
  let mockConnection2: WSConnection;
  let mockConnection3: WSConnection;

  beforeEach(() => {
    roomManager = new WSRoomManager();

    mockConnection1 = {
      id: 'conn1',
      send: vi.fn(),
      close: vi.fn(),
      join: vi.fn(),
      leave: vi.fn(),
      onMessage: vi.fn(),
      onClose: vi.fn(),
      ping: vi.fn(),
      isAlive: true,
      url: '/test1',
      lastPong: Date.now(),
      markAlive: vi.fn(),
    } as WSConnection;

    mockConnection2 = {
      id: 'conn2',
      send: vi.fn(),
      close: vi.fn(),
      join: vi.fn(),
      leave: vi.fn(),
      onMessage: vi.fn(),
      onClose: vi.fn(),
      ping: vi.fn(),
      isAlive: true,
      url: '/test2',
      lastPong: Date.now(),
      markAlive: vi.fn(),
    } as WSConnection;

    mockConnection3 = {
      id: 'conn3',
      send: vi.fn(),
      close: vi.fn(),
      join: vi.fn(),
      leave: vi.fn(),
      onMessage: vi.fn(),
      onClose: vi.fn(),
      ping: vi.fn(),
      isAlive: true,
      url: '/test3',
      lastPong: Date.now(),
      markAlive: vi.fn(),
    } as WSConnection;
  });

  describe('Room Management', () => {
    it('should add connections to rooms', () => {
      const roomCreatedSpy = vi.fn();
      roomManager.on('room:created', roomCreatedSpy);

      roomManager.add(mockConnection1, 'room1');

      expect(roomCreatedSpy).toHaveBeenCalledWith('room1');
    });

    it('should add multiple connections to the same room', () => {
      const roomCreatedSpy = vi.fn();
      roomManager.on('room:created', roomCreatedSpy);

      roomManager.add(mockConnection1, 'room1');
      roomManager.add(mockConnection2, 'room1');

      // Room created event should only fire once
      expect(roomCreatedSpy).toHaveBeenCalledTimes(1);
      expect(roomCreatedSpy).toHaveBeenCalledWith('room1');
    });

    it('should emit room:created event for new rooms', () => {
      const roomCreatedSpy = vi.fn();
      roomManager.on('room:created', roomCreatedSpy);

      roomManager.add(mockConnection1, 'room1');
      roomManager.add(mockConnection2, 'room2');

      expect(roomCreatedSpy).toHaveBeenCalledTimes(2);
      expect(roomCreatedSpy).toHaveBeenNthCalledWith(1, 'room1');
      expect(roomCreatedSpy).toHaveBeenNthCalledWith(2, 'room2');
    });

    it('should handle adding the same connection to multiple rooms', () => {
      const roomCreatedSpy = vi.fn();
      roomManager.on('room:created', roomCreatedSpy);

      roomManager.add(mockConnection1, 'room1');
      roomManager.add(mockConnection1, 'room2');

      expect(roomCreatedSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Room Removal', () => {
    it('should remove connections from rooms', () => {
      const roomDestroyedSpy = vi.fn();
      roomManager.on('room:destroyed', roomDestroyedSpy);

      roomManager.add(mockConnection1, 'room1');
      roomManager.remove(mockConnection1, 'room1');

      expect(roomDestroyedSpy).toHaveBeenCalledWith('room1');
    });

    it('should emit room:destroyed when room becomes empty', () => {
      const roomDestroyedSpy = vi.fn();
      roomManager.on('room:destroyed', roomDestroyedSpy);

      roomManager.add(mockConnection1, 'room1');
      roomManager.add(mockConnection2, 'room1');

      roomManager.remove(mockConnection1, 'room1');
      expect(roomDestroyedSpy).not.toHaveBeenCalled(); // Room still has connection2

      roomManager.remove(mockConnection2, 'room1');
      expect(roomDestroyedSpy).toHaveBeenCalledWith('room1'); // Now room is empty
    });

    it('should handle removing from non-existent room gracefully', () => {
      expect(() => {
        roomManager.remove(mockConnection1, 'nonexistent');
      }).not.toThrow();
    });

    it('should handle removing non-existent connection from room', () => {
      roomManager.add(mockConnection1, 'room1');

      expect(() => {
        roomManager.remove(mockConnection2, 'room1');
      }).not.toThrow();
    });
  });

  describe('Leave All Rooms', () => {
    it('should remove connection from all rooms it belongs to', () => {
      const roomDestroyedSpy = vi.fn();
      roomManager.on('room:destroyed', roomDestroyedSpy);

      roomManager.add(mockConnection1, 'room1');
      roomManager.add(mockConnection1, 'room2');
      roomManager.add(mockConnection1, 'room3');

      roomManager.leaveAll(mockConnection1);

      expect(roomDestroyedSpy).toHaveBeenCalledTimes(3);
      expect(roomDestroyedSpy).toHaveBeenCalledWith('room1');
      expect(roomDestroyedSpy).toHaveBeenCalledWith('room2');
      expect(roomDestroyedSpy).toHaveBeenCalledWith('room3');
    });

    it('should only remove the specific connection from shared rooms', () => {
      const roomDestroyedSpy = vi.fn();
      roomManager.on('room:destroyed', roomDestroyedSpy);

      roomManager.add(mockConnection1, 'room1');
      roomManager.add(mockConnection2, 'room1');
      roomManager.add(mockConnection1, 'room2');

      roomManager.leaveAll(mockConnection1);

      // Only room2 should be destroyed since room1 still has mockConnection2
      expect(roomDestroyedSpy).toHaveBeenCalledTimes(1);
      expect(roomDestroyedSpy).toHaveBeenCalledWith('room2');
    });

    it('should handle leaving all rooms for non-existent connection', () => {
      roomManager.add(mockConnection1, 'room1');

      expect(() => {
        roomManager.leaveAll(mockConnection2);
      }).not.toThrow();
    });
  });

  describe('Broadcasting', () => {
    it('should broadcast to all connections in a room', () => {
      roomManager.add(mockConnection1, 'room1');
      roomManager.add(mockConnection2, 'room1');
      roomManager.add(mockConnection3, 'room2');

      roomManager.broadcast('room1', 'Hello room1');

      expect(mockConnection1.send).toHaveBeenCalledWith('Hello room1');
      expect(mockConnection2.send).toHaveBeenCalledWith('Hello room1');
      expect(mockConnection3.send).not.toHaveBeenCalled();
    });

    it('should exclude sender from broadcast', () => {
      roomManager.add(mockConnection1, 'room1');
      roomManager.add(mockConnection2, 'room1');

      roomManager.broadcast('room1', 'Hello others', mockConnection1);

      expect(mockConnection1.send).not.toHaveBeenCalled();
      expect(mockConnection2.send).toHaveBeenCalledWith('Hello others');
    });

    it('should handle broadcasting to empty room', () => {
      expect(() => {
        roomManager.broadcast('empty', 'Hello');
      }).not.toThrow();
    });

    it('should handle broadcasting to non-existent room', () => {
      expect(() => {
        roomManager.broadcast('nonexistent', 'Hello');
      }).not.toThrow();
    });

    it('should handle connection send errors gracefully', () => {
      vi.mocked(mockConnection1.send).mockImplementation(() => {
        throw new Error('Send failed');
      });

      roomManager.add(mockConnection1, 'room1');
      roomManager.add(mockConnection2, 'room1');

      // The broadcast should continue even if one connection fails
      roomManager.broadcast('room1', 'Hello');

      expect(mockConnection1.send).toHaveBeenCalledWith('Hello');
      expect(mockConnection2.send).toHaveBeenCalledWith('Hello');
    });

    it('should support binary data broadcasting', () => {
      const binaryData = Buffer.from('binary data');

      roomManager.add(mockConnection1, 'room1');
      roomManager.add(mockConnection2, 'room1');

      roomManager.broadcast('room1', binaryData);

      expect(mockConnection1.send).toHaveBeenCalledWith(binaryData);
      expect(mockConnection2.send).toHaveBeenCalledWith(binaryData);
    });
  });

  describe('Event Handling', () => {
    it('should emit room:created events', () => {
      const createdSpy = vi.fn();
      roomManager.on('room:created', createdSpy);

      roomManager.add(mockConnection1, 'test-room');

      expect(createdSpy).toHaveBeenCalledWith('test-room');
    });

    it('should emit room:destroyed events', () => {
      const destroyedSpy = vi.fn();
      roomManager.on('room:destroyed', destroyedSpy);

      roomManager.add(mockConnection1, 'test-room');
      roomManager.remove(mockConnection1, 'test-room');

      expect(destroyedSpy).toHaveBeenCalledWith('test-room');
    });

    it('should handle multiple event listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      roomManager.on('room:created', listener1);
      roomManager.on('room:created', listener2);

      roomManager.add(mockConnection1, 'test-room');

      expect(listener1).toHaveBeenCalledWith('test-room');
      expect(listener2).toHaveBeenCalledWith('test-room');
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid add/remove operations', () => {
      const createdSpy = vi.fn();
      const destroyedSpy = vi.fn();

      roomManager.on('room:created', createdSpy);
      roomManager.on('room:destroyed', destroyedSpy);

      for (let i = 0; i < 100; i++) {
        roomManager.add(mockConnection1, `room${i % 5}`);
      }

      for (let i = 0; i < 100; i++) {
        roomManager.remove(mockConnection1, `room${i % 5}`);
      }

      // Should have created 5 rooms and destroyed them
      expect(createdSpy).toHaveBeenCalledTimes(5);
      expect(destroyedSpy).toHaveBeenCalledTimes(5);
    });

    it('should handle special characters in room names', () => {
      const specialRoomName = 'room-with-special@#$%^&*()_+characters';
      const createdSpy = vi.fn();

      roomManager.on('room:created', createdSpy);
      roomManager.add(mockConnection1, specialRoomName);

      expect(createdSpy).toHaveBeenCalledWith(specialRoomName);
    });

    it('should handle empty string room names', () => {
      const createdSpy = vi.fn();

      roomManager.on('room:created', createdSpy);
      roomManager.add(mockConnection1, '');

      expect(createdSpy).toHaveBeenCalledWith('');
    });

    it('should handle very long room names', () => {
      const longRoomName = 'a'.repeat(1000);
      const createdSpy = vi.fn();

      roomManager.on('room:created', createdSpy);
      roomManager.add(mockConnection1, longRoomName);

      expect(createdSpy).toHaveBeenCalledWith(longRoomName);
    });

    it('should handle duplicate room creation attempts', () => {
      const createdSpy = vi.fn();
      roomManager.on('room:created', createdSpy);

      roomManager.add(mockConnection1, 'room1');
      roomManager.add(mockConnection1, 'room1'); // Same connection, same room

      expect(createdSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Memory Management', () => {
    it('should properly clean up when all connections leave', () => {
      const destroyedSpy = vi.fn();
      roomManager.on('room:destroyed', destroyedSpy);

      // Add connections to multiple rooms
      roomManager.add(mockConnection1, 'room1');
      roomManager.add(mockConnection2, 'room2');
      roomManager.add(mockConnection3, 'room1');

      // Remove all connections
      roomManager.leaveAll(mockConnection1);
      roomManager.leaveAll(mockConnection2);
      roomManager.leaveAll(mockConnection3);

      expect(destroyedSpy).toHaveBeenCalledTimes(2); // room1 and room2
    });

    it('should not leak memory with frequent room creation/deletion', () => {
      const createdSpy = vi.fn();
      const destroyedSpy = vi.fn();

      roomManager.on('room:created', createdSpy);
      roomManager.on('room:destroyed', destroyedSpy);

      // Create and destroy many rooms
      for (let i = 0; i < 100; i++) {
        roomManager.add(mockConnection1, `temp-room-${i}`);
        roomManager.remove(mockConnection1, `temp-room-${i}`);
      }

      expect(createdSpy).toHaveBeenCalledTimes(100);
      expect(destroyedSpy).toHaveBeenCalledTimes(100);
    });
  });
});
