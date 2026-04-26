/**
 * @nextrush/websocket - Room Manager
 *
 * Manages WebSocket rooms/channels for organized message broadcasting.
 *
 * @packageDocumentation
 */

import {
    DEFAULT_MAX_ROOMS_PER_CONNECTION,
    validateRoomName,
    type WSConnection,
} from './types';

/**
 * Error thrown when a connection tries to join too many rooms
 */
export class MaxRoomsExceededError extends Error {
  constructor(maxRooms: number) {
    super(`Connection cannot join more than ${maxRooms} rooms`);
    this.name = 'MaxRoomsExceededError';
  }
}

/**
 * Room manager for WebSocket connections
 *
 * Provides channel/room functionality for organized messaging:
 * - Join/leave rooms
 * - Broadcast to rooms
 * - Room membership tracking
 */
export class RoomManager {
  /** Map of room name to set of connections */
  private rooms = new Map<string, Set<WSConnection>>();

  /** Map of connection to set of rooms */
  private connectionRooms = new Map<WSConnection, Set<string>>();

  /** Maximum rooms per connection (0 = unlimited) */
  private maxRoomsPerConnection: number;

  constructor(maxRoomsPerConnection = DEFAULT_MAX_ROOMS_PER_CONNECTION) {
    this.maxRoomsPerConnection = maxRoomsPerConnection;
  }

  /**
   * Add a connection to a room
   * @throws TypeError if room name is invalid
   * @throws MaxRoomsExceededError if connection is in too many rooms
   */
  join(connection: WSConnection, room: string): void {
    validateRoomName(room);

    // Check max rooms per connection
    const connRooms = this.connectionRooms.get(connection);
    if (
      this.maxRoomsPerConnection > 0 &&
      connRooms &&
      connRooms.size >= this.maxRoomsPerConnection &&
      !connRooms.has(room) // Allow rejoining same room
    ) {
      throw new MaxRoomsExceededError(this.maxRoomsPerConnection);
    }

    let roomSet = this.rooms.get(room);
    if (!roomSet) {
      roomSet = new Set();
      this.rooms.set(room, roomSet);
    }
    roomSet.add(connection);

    let roomsForConn = connRooms;
    if (!roomsForConn) {
      roomsForConn = new Set();
      this.connectionRooms.set(connection, roomsForConn);
    }
    roomsForConn.add(room);
  }

  /**
   * Remove a connection from a room
   */
  leave(connection: WSConnection, room: string): void {
    const roomSet = this.rooms.get(room);
    if (roomSet) {
      roomSet.delete(connection);
      if (roomSet.size === 0) {
        this.rooms.delete(room);
      }
    }

    const connRooms = this.connectionRooms.get(connection);
    if (connRooms) {
      connRooms.delete(room);
      if (connRooms.size === 0) {
        this.connectionRooms.delete(connection);
      }
    }
  }

  /**
   * Remove a connection from all rooms
   */
  leaveAll(connection: WSConnection): void {
    const connRooms = this.connectionRooms.get(connection);
    if (!connRooms) return;

    for (const room of connRooms) {
      const roomSet = this.rooms.get(room);
      if (roomSet) {
        roomSet.delete(connection);
        if (roomSet.size === 0) {
          this.rooms.delete(room);
        }
      }
    }

    this.connectionRooms.delete(connection);
  }

  /**
   * Get all rooms a connection is in
   */
  getRooms(connection: WSConnection): string[] {
    const connRooms = this.connectionRooms.get(connection);
    return connRooms ? Array.from(connRooms) : [];
  }

  /**
   * Get all connections in a room
   */
  getConnections(room: string): WSConnection[] {
    const roomSet = this.rooms.get(room);
    return roomSet ? Array.from(roomSet) : [];
  }

  /**
   * Get all room names
   */
  getAllRooms(): string[] {
    return Array.from(this.rooms.keys());
  }

  /**
   * Get room size
   */
  getRoomSize(room: string): number {
    return this.rooms.get(room)?.size ?? 0;
  }

  /**
   * Check if a connection is in a room
   */
  isInRoom(connection: WSConnection, room: string): boolean {
    const roomSet = this.rooms.get(room);
    return roomSet?.has(connection) ?? false;
  }

  /**
   * Broadcast to all connections in a room
   */
  broadcast(
    room: string,
    data: string | Buffer,
    exclude?: WSConnection
  ): void {
    const roomSet = this.rooms.get(room);
    if (!roomSet) return;

    for (const conn of roomSet) {
      if (exclude && conn === exclude) continue;
      try {
        conn.send(data);
      } catch {
        // Connection may be closed, ignore errors
      }
    }
  }

  /**
   * Broadcast JSON to all connections in a room
   */
  broadcastJson(room: string, data: unknown, exclude?: WSConnection): void {
    try {
      this.broadcast(room, JSON.stringify(data), exclude);
    } catch {
      // JSON.stringify can fail on circular references or BigInt
      // Silently ignore to prevent crashing the server
    }
  }

  /**
   * Clear all rooms (for cleanup)
   */
  clear(): void {
    this.rooms.clear();
    this.connectionRooms.clear();
  }

  /**
   * Set max rooms per connection
   */
  setMaxRoomsPerConnection(max: number): void {
    this.maxRoomsPerConnection = max;
  }

  /**
   * Get max rooms per connection
   */
  getMaxRoomsPerConnection(): number {
    return this.maxRoomsPerConnection;
  }
}
