/**
 * 🔧 WebSocket Frame Parser
 * RFC 6455 compliant frame parsing and creation
 */

import { WSCloseCode, WSFrame, WSOpcode } from './types';

/**
 * WebSocket frame parser for handling incoming data
 */
export class WSFrameParser {
  private maxMessageSize: number;

  constructor(maxMessageSize: number = 1024 * 1024) {
    this.maxMessageSize = maxMessageSize;
  }

  /**
   * Parse WebSocket frames from buffer
   */
  parseFrames(buffer: Buffer): WSFrame[] {
    const frames: WSFrame[] = [];
    let offset = 0;

    while (offset < buffer.length) {
      if (buffer.length - offset < 2) break;

      const firstByte = buffer[offset];
      const secondByte = buffer[offset + 1];

      const fin = (firstByte & 0x80) === 0x80;
      const rsv1 = (firstByte & 0x40) === 0x40;
      const rsv2 = (firstByte & 0x20) === 0x20;
      const rsv3 = (firstByte & 0x10) === 0x10;
      const opcode = firstByte & 0x0f;
      const masked = (secondByte & 0x80) === 0x80;
      let payloadLength = secondByte & 0x7f;

      offset += 2;

      // Extended payload length
      if (payloadLength === 126) {
        if (buffer.length - offset < 2) break;
        payloadLength = buffer.readUInt16BE(offset);
        offset += 2;
      } else if (payloadLength === 127) {
        if (buffer.length - offset < 8) break;
        const high = buffer.readUInt32BE(offset);
        const low = buffer.readUInt32BE(offset + 4);
        payloadLength = (high << 32) + low;
        offset += 8;
      }

      // Check message size limit
      if (payloadLength > this.maxMessageSize) {
        throw new Error('Message too large');
      }

      // Masking key
      let maskingKey: Buffer | undefined;
      if (masked) {
        if (buffer.length - offset < 4) break;
        maskingKey = buffer.slice(offset, offset + 4);
        offset += 4;
      }

      // Payload
      if (buffer.length - offset < payloadLength) break;
      let payload = buffer.slice(offset, offset + payloadLength);
      offset += payloadLength;

      // Unmask payload if needed
      if (masked && maskingKey) {
        for (let i = 0; i < payload.length; i++) {
          payload[i] ^= maskingKey[i % 4];
        }
      }

      frames.push({
        fin,
        rsv1,
        rsv2,
        rsv3,
        opcode,
        masked,
        payloadLength,
        ...(maskingKey && { maskingKey }),
        payload,
      });
    }

    return frames;
  }

  /**
   * Create WebSocket frame
   */
  createFrame(opcode: WSOpcode, payload: Buffer): Buffer {
    const payloadLength = payload.length;
    let headerLength = 2;

    if (payloadLength > 65535) {
      headerLength += 8;
    } else if (payloadLength > 125) {
      headerLength += 2;
    }

    const frame = Buffer.allocUnsafe(headerLength + payloadLength);
    let offset = 0;

    // First byte: FIN (1) + RSV (000) + Opcode (4)
    frame[offset++] = 0x80 | opcode;

    // Second byte: MASK (0) + Payload length
    if (payloadLength > 65535) {
      frame[offset++] = 127;
      frame.writeBigUInt64BE(BigInt(payloadLength), offset);
      offset += 8;
    } else if (payloadLength > 125) {
      frame[offset++] = 126;
      frame.writeUInt16BE(payloadLength, offset);
      offset += 2;
    } else {
      frame[offset++] = payloadLength;
    }

    // Copy payload
    payload.copy(frame, offset);

    return frame;
  }

  /**
   * Create text frame
   */
  createTextFrame(text: string): Buffer {
    const payload = Buffer.from(text, 'utf8');
    return this.createFrame(WSOpcode.TEXT, payload);
  }

  /**
   * Create binary frame
   */
  createBinaryFrame(data: Buffer): Buffer {
    return this.createFrame(WSOpcode.BINARY, data);
  }

  /**
   * Create ping frame
   */
  createPingFrame(data?: Buffer): Buffer {
    const payload = data || Buffer.alloc(0);
    return this.createFrame(WSOpcode.PING, payload);
  }

  /**
   * Create pong frame
   */
  createPongFrame(data?: Buffer): Buffer {
    const payload = data || Buffer.alloc(0);
    return this.createFrame(WSOpcode.PONG, payload);
  }

  /**
   * Create close frame
   */
  createCloseFrame(code?: number, reason?: string): Buffer {
    const closeCode = code || WSCloseCode.NORMAL_CLOSURE;
    const closeReason = reason || '';
    const payload = Buffer.alloc(2 + Buffer.byteLength(closeReason));
    payload.writeUInt16BE(closeCode, 0);
    Buffer.from(closeReason).copy(payload, 2);

    return this.createFrame(WSOpcode.CLOSE, payload);
  }
}

/**
 * Create a shared frame parser instance
 */
export function createFrameParser(maxMessageSize?: number): WSFrameParser {
  return new WSFrameParser(maxMessageSize);
}
