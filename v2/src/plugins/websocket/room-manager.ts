import { EventEmitter } from 'node:events';
import type { WSConnection } from '@/types/context';

export class WSRoomManager extends EventEmitter {
  private rooms = new Map<string, Set<WSConnection>>();

  add(socket: WSConnection, room: string): void {
    let set = this.rooms.get(room);
    if (!set) {
      set = new Set();
      this.rooms.set(room, set);
      this.emit('room:created', room);
    }
    set.add(socket);
  }

  remove(socket: WSConnection, room: string): void {
    const set = this.rooms.get(room);
    if (!set) return;
    set.delete(socket);
    if (set.size === 0) {
      this.rooms.delete(room);
      this.emit('room:destroyed', room);
    }
  }

  leaveAll(socket: WSConnection): void {
    for (const [room, set] of this.rooms) {
      if (set.delete(socket) && set.size === 0) {
        this.rooms.delete(room);
        this.emit('room:destroyed', room);
      }
    }
  }

  broadcast(room: string, data: string | Buffer, exclude?: WSConnection): void {
    const set = this.rooms.get(room);
    if (!set) return;
    for (const s of set) {
      if (exclude && s === exclude) continue;
      try {
        s.send(data);
      } catch {
        // Ignore send errors for individual connections
      }
    }
  }

  getRooms(): string[] {
    return Array.from(this.rooms.keys());
  }
}
