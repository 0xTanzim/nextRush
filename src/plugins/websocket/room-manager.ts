/**
 * 🏠 WebSocket Room Manager
 * Advanced room management with automatic cleanup and statistics
 */

import { EventEmitter } from 'events';
import { RoomEmitter, RoomInfo, WSConnection } from './types';

/**
 * Room manager for WebSocket connections
 */
export class WSRoomManager extends EventEmitter {
  private rooms = new Map<string, RoomInfo>();
  private maxRooms: number;
  private cleanupInterval: number;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(maxRooms: number = 1000, cleanupInterval: number = 300000) {
    super();
    this.maxRooms = maxRooms;
    this.cleanupInterval = cleanupInterval;
    this.startCleanupTimer();
  }

  /**
   * Join a room
   */
  async joinRoom(socket: WSConnection, roomName: string): Promise<void> {
    if (this.rooms.size >= this.maxRooms) {
      throw new Error('Maximum number of rooms reached');
    }

    if (!this.rooms.has(roomName)) {
      this.rooms.set(roomName, {
        name: roomName,
        clients: new Set(),
        created: new Date(),
        lastActivity: new Date(),
        messageCount: 0,
        metadata: {},
      });
      this.emit('room:created', roomName);
    }

    const room = this.rooms.get(roomName)!;
    room.clients.add(socket);
    room.lastActivity = new Date();
    socket.rooms.add(roomName);

    this.emit('room:join', socket, roomName);
  }

  /**
   * Leave a room
   */
  async leaveRoom(socket: WSConnection, roomName: string): Promise<void> {
    const room = this.rooms.get(roomName);
    if (!room) return;

    room.clients.delete(socket);
    socket.rooms.delete(roomName);

    if (room.clients.size === 0) {
      this.rooms.delete(roomName);
      this.emit('room:destroyed', roomName);
    }

    this.emit('room:leave', socket, roomName);
  }

  /**
   * Leave all rooms for a socket
   */
  async leaveAllRooms(socket: WSConnection): Promise<void> {
    for (const roomName of Array.from(socket.rooms)) {
      await this.leaveRoom(socket, roomName);
    }
  }

  /**
   * Get room information
   */
  getRoom(roomName: string): RoomInfo | undefined {
    return this.rooms.get(roomName);
  }

  /**
   * Get all rooms
   */
  getAllRooms(): Map<string, RoomInfo> {
    return new Map(this.rooms);
  }

  /**
   * Get room count
   */
  getRoomCount(): number {
    return this.rooms.size;
  }

  /**
   * Get users in room
   */
  getRoomUsers(roomName: string): WSConnection[] {
    const room = this.rooms.get(roomName);
    return room ? Array.from(room.clients) : [];
  }

  /**
   * Get room user count
   */
  getRoomUserCount(roomName: string): number {
    const room = this.rooms.get(roomName);
    return room ? room.clients.size : 0;
  }

  /**
   * Broadcast to room
   */
  broadcastToRoom(roomName: string, data: any, excludeSocketId?: string): void {
    const room = this.rooms.get(roomName);
    if (!room) return;

    for (const socket of Array.from(room.clients)) {
      if (excludeSocketId && socket.id === excludeSocketId) continue;
      socket.send(data);
    }

    room.messageCount++;
    room.lastActivity = new Date();
  }

  /**
   * Emit event to room
   */
  emitToRoom(
    roomName: string,
    event: string,
    args: any[],
    excludeSocketId?: string
  ): void {
    const room = this.rooms.get(roomName);
    if (!room) return;

    const message = {
      type: 'event',
      event,
      data: args,
      timestamp: Date.now(),
    };

    for (const socket of Array.from(room.clients)) {
      if (excludeSocketId && socket.id === excludeSocketId) continue;
      socket.send(message);
    }
  }

  /**
   * Create room emitter for targeted messaging
   */
  createRoomEmitter(roomName: string, excludeSocketId?: string): RoomEmitter {
    return {
      emit: (event: string, ...args: any[]) => {
        this.emitToRoom(roomName, event, args, excludeSocketId);
      },
      send: (data: any) => {
        this.broadcastToRoom(roomName, data, excludeSocketId);
      },
      broadcast: (data: any) => {
        this.broadcastToRoom(roomName, data, excludeSocketId);
      },
      except: (socketId: string) => {
        return this.createRoomEmitter(roomName, socketId);
      },
      to: (room: string) => {
        return this.createRoomEmitter(room, excludeSocketId);
      },
    };
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupEmptyRooms();
    }, this.cleanupInterval);
  }

  /**
   * Stop cleanup timer
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Clean up empty rooms
   */
  private cleanupEmptyRooms(): void {
    for (const [roomName, room] of Array.from(this.rooms.entries())) {
      if (room.clients.size === 0) {
        this.rooms.delete(roomName);
        this.emit('room:destroyed', roomName);
      }
    }
  }

  /**
   * Clear all rooms
   */
  clearAllRooms(): void {
    this.rooms.clear();
    this.emit('rooms:cleared');
  }

  /**
   * Get room statistics
   */
  getStats(): {
    totalRooms: number;
    totalUsers: number;
    averageUsersPerRoom: number;
    mostPopularRoom: { name: string; users: number } | null;
  } {
    const totalRooms = this.rooms.size;
    let totalUsers = 0;
    let mostPopularRoom: { name: string; users: number } | null = null;

    for (const [roomName, room] of this.rooms) {
      totalUsers += room.clients.size;

      if (!mostPopularRoom || room.clients.size > mostPopularRoom.users) {
        mostPopularRoom = { name: roomName, users: room.clients.size };
      }
    }

    return {
      totalRooms,
      totalUsers,
      averageUsersPerRoom: totalRooms > 0 ? totalUsers / totalRooms : 0,
      mostPopularRoom,
    };
  }
}
