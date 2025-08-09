import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import { WSRoomManager } from './room-manager';
import type { WSConnection } from './types';

export class RawWSConnection extends EventEmitter implements WSConnection {
  public id = randomUUID();
  public url: string;
  public isAlive = true;
  public lastPong = Date.now();
  private readonly socket: Socket;
  private readonly maxMessageSize: number;
  private readonly roomManager: WSRoomManager;

  constructor(
    socket: Socket,
    req: IncomingMessage,
    roomManager: WSRoomManager,
    maxMessageSize: number
  ) {
    super();
    this.socket = socket;
    this.url = req.url || '/';
    this.maxMessageSize = maxMessageSize;
    this.roomManager = roomManager;
    this.setupListeners();
  }

  send(data: string | Buffer): void {
    const frame = frameText(
      typeof data === 'string' ? Buffer.from(data) : data
    );
    this.socket.write(frame);
  }

  close(code = 1000, reason = 'Normal Closure'): void {
    try {
      const payload = Buffer.concat([
        Buffer.from([(code >> 8) & 0xff, code & 0xff]),
        Buffer.from(reason),
      ]);
      this.socket.write(frameClose(payload));
    } finally {
      this.isAlive = false;
      try {
        this.socket.destroy();
      } catch {
        /* noop */
      }
      this.emit('close', code, reason);
    }
  }

  join(room: string): void {
    this.roomManager.add(this, room);
  }
  leave(room: string): void {
    this.roomManager.remove(this, room);
  }

  onMessage(listener: (data: string | Buffer) => void): void {
    this.on('message', listener);
  }
  onClose(listener: (code: number, reason: string) => void): void {
    this.on('close', listener as any);
  }

  ping(): void {
    this.socket.write(framePing());
  }

  markAlive(): void {
    this.isAlive = true;
    this.lastPong = Date.now();
  }

  private setupListeners(): void {
    // Use ArrayBufferLike so both ArrayBuffer and SharedArrayBuffer backed Buffers are assignable
    let buffer: Buffer<ArrayBufferLike> = Buffer.alloc(0) as Buffer<ArrayBufferLike>;

    this.socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      while (true) {
        let parsed: { opcode: number; payload: Buffer; rest: Buffer } | null;
        try {
          parsed = parseFrame(buffer, this.maxMessageSize);
        } catch {
          // Message too large or malformed
          this.close(1009, 'Message too big');
          return;
        }
        if (!parsed) break;
        buffer = parsed.rest;
        const { opcode, payload } = parsed;
        // 0x1 text, 0x2 binary, 0x8 close, 0x9 ping, 0xA pong
        if (opcode === 0x1 || opcode === 0x2) {
          this.emit(
            'message',
            opcode === 0x1 ? payload.toString('utf8') : payload
          );
        } else if (opcode === 0x9) {
          // ping -> pong
          this.socket.write(framePong(payload));
        } else if (opcode === 0xa) {
          this.markAlive();
        } else if (opcode === 0x8) {
          this.close(1000, 'Client close');
        }
      }
    });

    this.socket.on('close', () => {
      this.roomManager.leaveAll(this);
      this.emit('close', 1006, 'Abnormal Closure');
    });

    this.socket.on('error', () => {
      this.close(1011, 'Internal Error');
    });
  }
}

// Minimal framing helpers
function frameHeader(finOpcode: number, payloadLen: number): Buffer {
  const header: number[] = [finOpcode, 0]; // server to client not masked
  if (payloadLen < 126) {
    header[1] = payloadLen;
    return Buffer.from(header);
  } else if (payloadLen < 65536) {
    header[1] = 126;
    const ext = Buffer.alloc(2);
    ext.writeUInt16BE(payloadLen, 0);
    return Buffer.concat([Buffer.from(header), ext]);
  } else {
    header[1] = 127;
    const ext = Buffer.alloc(8);
    ext.writeUInt32BE(0, 0);
    ext.writeUInt32BE(payloadLen, 4);
    return Buffer.concat([Buffer.from(header), ext]);
  }
}

function frameText(data: Buffer): Buffer {
  const header = frameHeader(0x80 | 0x1, data.length);
  return Buffer.concat([header, data]);
}
function framePing(): Buffer {
  return frameHeader(0x80 | 0x9, 0);
}
function framePong(data: Buffer): Buffer {
  return Buffer.concat([frameHeader(0x80 | 0xa, data.length), data]);
}
function frameClose(data: Buffer): Buffer {
  return Buffer.concat([frameHeader(0x80 | 0x8, data.length), data]);
}

function parseFrame(
  buf: Buffer,
  max: number
): { opcode: number; payload: Buffer; rest: Buffer } | null {
  if (buf.length < 2) return null;
  const b0 = buf.readUInt8(0);
  const b1 = buf.readUInt8(1);
  const opcode = b0 & 0x0f;
  const masked = (b1 & 0x80) !== 0;
  let len = b1 & 0x7f;
  let off = 2;
  if (len === 126) {
    if (buf.length < off + 2) return null;
    len = buf.readUInt16BE(off);
    off += 2;
  } else if (len === 127) {
    if (buf.length < off + 8) return null;
    const hi = buf.readUInt32BE(off);
    const lo = buf.readUInt32BE(off + 4);
    off += 8;
    if (hi !== 0) throw new Error('payload too large');
    len = lo;
  }
  if (masked) {
    if (buf.length < off + 4) return null;
  }
  if (buf.length < off + (masked ? 4 : 0) + len) return null;
  const mask: Buffer | null = masked
    ? Buffer.from(buf.subarray(off, off + 4))
    : null;
  off += masked ? 4 : 0;
  const payload: Buffer = buf.subarray(off, off + len);
  if (masked && mask) {
    const m = mask as Buffer;
    for (let i = 0; i < payload.length; i++) {
      const mi = m.readUInt8(i & 3);
      const b = payload.readUInt8(i);
      payload.writeUInt8(b ^ mi, i);
    }
  }
  if (payload.length > max) throw new Error('Message too large');
  const rest: Buffer = buf.subarray(off + len);
  return { opcode, payload, rest };
}
