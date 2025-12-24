/**
 * @nextrush/websocket - Room Manager
 *
 * Manages WebSocket rooms/channels for organized message broadcasting.
 *
 * @packageDocumentation
 */

import type { WSConnection } from './types';

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

  /**
   * Add a connection to a room
   */
  join(connection: WSConnection, room: string): void {
    let roomSet = this.rooms.get(room);
    if (!roomSet) {
      roomSet = new Set();
      this.rooms.set(room, roomSet);
    }
    roomSet.add(connection);

    let connRooms = this.connectionRooms.get(connection);
    if (!connRooms) {
      connRooms = new Set();
      this.connectionRooms.set(connection, connRooms);
    }
    connRooms.add(room);
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
    this.broadcast(room, JSON.stringify(data), exclude);
  }

  /**
   * Clear all rooms (for cleanup)
   */
  clear(): void {
    this.rooms.clear();
    this.connectionRooms.clear();
  }
}
