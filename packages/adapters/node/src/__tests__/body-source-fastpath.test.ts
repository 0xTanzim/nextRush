/**
 * @nextrush/adapter-node - NodeBodySource.buffer() fast-path behavior contract
 *
 * Change: node-body-read-fastpath (HP-16). Pins the observable contract of
 * `buffer()`/`text()`/`json()` — bytes, error types, limits, cache/consumed
 * semantics, all chunk types, and the stream-lifecycle edge cases the
 * `for await…of` form handled implicitly — so the event-listener rewrite is
 * proven byte-identical and never hangs or double-settles.
 */

import { BadRequestError } from '@nextrush/errors';
import { BodyConsumedError, BodyTooLargeError } from '@nextrush/runtime';
import type { IncomingMessage } from 'node:http';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createEmptyBodySource, createNodeBodySource, NodeBodySource } from '../body-source';

type RawChunk = Buffer | string | Uint8Array | ArrayBuffer;

interface MockReqOptions {
  headers?: Record<string, string>;
  /** objectMode lets us emit non-Buffer chunk types (string/Uint8Array/ArrayBuffer) verbatim. */
  objectMode?: boolean;
}

/**
 * Build a Readable cast as IncomingMessage that emits the given chunks then ends.
 * Emission is deferred to the next tick so `buffer()` attaches its listeners first
 * (mirroring Node keeping the request paused until a consumer attaches).
 */
function makeReq(chunks: RawChunk[], options: MockReqOptions = {}): IncomingMessage {
  const readable = new Readable({ objectMode: options.objectMode ?? false, read() {} });
  const req = readable as unknown as IncomingMessage;
  req.headers = options.headers ?? {};
  setImmediate(() => {
    for (const chunk of chunks) {
      readable.push(chunk as Buffer);
    }
    readable.push(null);
  });
  return req;
}

/** A req whose stream is already fully consumed (readableEnded === true) before buffer(). */
async function makeEndedReq(
  chunks: RawChunk[],
  headers: Record<string, string> = {}
): Promise<IncomingMessage> {
  const readable = new Readable({ read() {} });
  const req = readable as unknown as IncomingMessage;
  req.headers = headers;
  for (const chunk of chunks) {
    readable.push(chunk as Buffer);
  }
  readable.push(null);
  // Drain to end so readableEnded flips true.
  await new Promise<void>((resolve) => {
    readable.on('end', () => resolve());
    readable.resume();
  });
  return req;
}

// --- Reference (legacy) reader: mirrors the pre-change for-await…of implementation. ---
const DEFAULT_LIMIT = 1024 * 1024;

function refChunkToBuffer(raw: unknown): Buffer {
  if (Buffer.isBuffer(raw)) return raw;
  if (typeof raw === 'string') return Buffer.from(raw, 'utf8');
  if (raw instanceof Uint8Array) return Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength);
  if (raw instanceof ArrayBuffer) return Buffer.from(raw);
  throw new TypeError('Unexpected body chunk type');
}

async function legacyBuffer(req: IncomingMessage, limit = DEFAULT_LIMIT): Promise<Buffer> {
  const contentLengthHeader = req.headers['content-length'];
  if (typeof contentLengthHeader === 'string') {
    const parsed = parseInt(contentLengthHeader, 10);
    if (!Number.isNaN(parsed) && parsed > limit) {
      throw new BodyTooLargeError(limit, parsed);
    }
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const raw of req) {
    const chunk = refChunkToBuffer(raw);
    total += chunk.length;
    if (total > limit) {
      req.destroy();
      throw new BodyTooLargeError(limit, total);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

describe('NodeBodySource.buffer() — behavior matrix (§2)', () => {
  it('2.1a normal body → correct bytes', async () => {
    const source = new NodeBodySource(makeReq(['hello ', 'world']));
    const buf = await source.buffer();
    expect(Buffer.from(buf).toString('utf8')).toBe('hello world');
  });

  it('2.1b empty body → empty buffer (no hang, no error)', async () => {
    const source = new NodeBodySource(makeReq([]));
    const buf = await source.buffer();
    expect(buf.length).toBe(0);
  });

  it('2.1c text() and json() delegate to buffer() identically', async () => {
    const textSource = new NodeBodySource(makeReq(['plain text']));
    expect(await textSource.text()).toBe('plain text');

    const jsonSource = new NodeBodySource(makeReq(['{"a":', '1}']));
    expect(await jsonSource.json()).toEqual({ a: 1 });
  });

  it('2.1d invalid JSON → BadRequestError', async () => {
    const source = new NodeBodySource(makeReq(['{not json']));
    await expect(source.json()).rejects.toBeInstanceOf(BadRequestError);
  });

  it('2.2 content-length over limit → BodyTooLargeError before any bytes consumed', async () => {
    const req = makeReq(['x'.repeat(200)], { headers: { 'content-length': '200' } });
    const source = new NodeBodySource(req, { limit: 50 });
    await expect(source.buffer()).rejects.toBeInstanceOf(BodyTooLargeError);
    // No listeners attached — the pre-check threw synchronously before reading.
    expect(req.listenerCount('data')).toBe(0);
  });

  it('2.3 streamed body over limit (no content-length) → graceful stop + BodyTooLargeError mid-stream (BP-K)', async () => {
    const req = makeReq(['x'.repeat(30), 'y'.repeat(30)]);
    const source = new NodeBodySource(req, { limit: 40 });
    await expect(source.buffer()).rejects.toBeInstanceOf(BodyTooLargeError);
    // BP-K: reject without destroying the socket (an immediate destroy raced the 413).
    expect(req.destroyed).toBe(false);
  });

  it('2.4a second read → BodyConsumedError', async () => {
    const req = makeReq(['abc']);
    const source = new NodeBodySource(req);
    await source.buffer();
    // Force the un-cached consumed state: a fresh source over a consumed stream.
    const source2 = new NodeBodySource(makeReq(['abc']));
    // @ts-expect-error — drive the consumed-without-cache branch directly.
    source2._consumed = true;
    await expect(source2.buffer()).rejects.toBeInstanceOf(BodyConsumedError);
  });

  it('2.4b re-read after success → cached buffer, no re-attach', async () => {
    const req = makeReq(['cached']);
    const source = new NodeBodySource(req);
    const first = await source.buffer();
    const second = await source.buffer();
    expect(second).toBe(first); // same reference — served from cache
    expect(req.listenerCount('data')).toBe(0);
  });

  it('2.5 all chunk types (Buffer/string/Uint8Array/ArrayBuffer) concatenate correctly', async () => {
    const ab = new ArrayBuffer(2);
    new Uint8Array(ab).set([0x21, 0x21]); // "!!"
    const chunks: RawChunk[] = [
      Buffer.from('A'),
      'B',
      new Uint8Array([0x43]), // "C"
      ab,
    ];
    const source = new NodeBodySource(makeReq(chunks, { objectMode: true }));
    const buf = await source.buffer();
    expect(Buffer.from(buf).toString('utf8')).toBe('ABC!!');
  });
});

describe('NodeBodySource.buffer() — stream-lifecycle edge cases (§3)', () => {
  it('3.1 already-ended stream → resolves empty without hanging', async () => {
    const req = await makeEndedReq(['ignored']);
    expect(req.readableEnded).toBe(true);
    const source = new NodeBodySource(req);
    const buf = await source.buffer();
    expect(buf.length).toBe(0);
  });

  it('3.2 stream error mid-read → rejects with that error', async () => {
    const readable = new Readable({ read() {} });
    const req = readable as unknown as IncomingMessage;
    req.headers = {};
    const boom = new Error('stream boom');
    setImmediate(() => {
      readable.push('partial');
      readable.destroy(boom);
    });
    const source = new NodeBodySource(req);
    await expect(source.buffer()).rejects.toBe(boom);
  });

  it('3.3 client disconnect / premature close mid-body → rejects (never left pending)', async () => {
    const readable = new Readable({ read() {} });
    const req = readable as unknown as IncomingMessage;
    req.headers = {};
    setImmediate(() => {
      readable.push('partial body');
      readable.destroy(); // close with no error and no end
    });
    const source = new NodeBodySource(req);
    await expect(source.buffer()).rejects.toBeInstanceOf(Error);
  });

  it('3.4 limit breach near end → settles exactly once (single BodyTooLargeError)', async () => {
    const readable = new Readable({ read() {} });
    const req = readable as unknown as IncomingMessage;
    req.headers = {};
    setImmediate(() => {
      readable.push('x'.repeat(100)); // over limit
      readable.push(null); // end races the breach
    });
    const source = new NodeBodySource(req, { limit: 10 });
    await expect(source.buffer()).rejects.toBeInstanceOf(BodyTooLargeError);
  });

  it('3.5 on settle → all data/end/error/close listeners removed (no leak)', async () => {
    const req = makeReq(['payload']);
    const source = new NodeBodySource(req);
    await source.buffer();
    expect(req.listenerCount('data')).toBe(0);
    expect(req.listenerCount('end')).toBe(0);
    expect(req.listenerCount('error')).toBe(0);
    expect(req.listenerCount('close')).toBe(0);
  });

  it('3.5b on limit-breach settle → listeners removed, socket not destroyed (BP-K)', async () => {
    const req = makeReq(['x'.repeat(100)]);
    const source = new NodeBodySource(req, { limit: 10 });
    await expect(source.buffer()).rejects.toBeInstanceOf(BodyTooLargeError);
    expect(req.listenerCount('data')).toBe(0);
    expect(req.listenerCount('end')).toBe(0);
    expect(req.listenerCount('error')).toBe(0);
    expect(req.listenerCount('close')).toBe(0);
    expect(req.destroyed).toBe(false); // BP-K: graceful stop, not a socket teardown
  });

  it('3.x unexpected chunk type → rejects (TypeError) and destroys the stream', async () => {
    // objectMode lets a non-Buffer/string/typed-array chunk reach chunkToBuffer.
    const req = makeReq([42 as unknown as RawChunk], { objectMode: true });
    const source = new NodeBodySource(req);
    await expect(source.buffer()).rejects.toBeInstanceOf(TypeError);
    expect(req.destroyed).toBe(true);
  });
});

describe('NodeBodySource.stream() — regression guard (§3.6)', () => {
  it('stream() still size-enforces and throws BodyConsumedError on re-use', async () => {
    const source = new NodeBodySource(makeReq(['data']));
    const s = source.stream();
    expect(s).toBeDefined();
    expect(() => source.stream()).toThrow(BodyConsumedError);
  });
});

describe('NodeBodySource.buffer() — differential harness vs legacy reader (§1.2/§5.1)', () => {
  interface Corpus {
    name: string;
    chunks: RawChunk[];
    headers?: Record<string, string>;
    limit?: number;
    objectMode?: boolean;
    expectError?: typeof BodyTooLargeError;
  }

  const corpus: Corpus[] = [
    { name: 'empty', chunks: [] },
    { name: 'small', chunks: ['hi'] },
    { name: 'multi-chunk', chunks: ['a', 'b', 'c', 'd'] },
    { name: 'large-under-limit', chunks: ['z'.repeat(500)], limit: 1024 },
    {
      name: 'over-limit via content-length',
      chunks: ['z'.repeat(200)],
      headers: { 'content-length': '200' },
      limit: 50,
      expectError: BodyTooLargeError,
    },
    {
      name: 'over-limit via streaming',
      chunks: ['z'.repeat(30), 'z'.repeat(30)],
      limit: 40,
      expectError: BodyTooLargeError,
    },
    {
      name: 'mixed chunk types',
      chunks: [Buffer.from('x'), 'y', new Uint8Array([0x7a])],
      objectMode: true,
    },
  ];

  for (const entry of corpus) {
    it(`matches legacy reader: ${entry.name}`, async () => {
      const limit = entry.limit ?? DEFAULT_LIMIT;
      const mkOpts = { headers: entry.headers, objectMode: entry.objectMode };

      const source = new NodeBodySource(makeReq(entry.chunks, mkOpts), { limit });
      const legacyReq = makeReq(entry.chunks, mkOpts);

      if (entry.expectError) {
        await expect(source.buffer()).rejects.toBeInstanceOf(entry.expectError);
        await expect(legacyBuffer(legacyReq, limit)).rejects.toBeInstanceOf(entry.expectError);
        return;
      }

      const newResult = Buffer.from(await source.buffer());
      const legacyResult = await legacyBuffer(legacyReq, limit);
      expect(newResult.equals(legacyResult)).toBe(true);
    });
  }
});

describe('NodeBodySource — factories, EmptyBodySource & stream() enforcement (coverage)', () => {
  it('createNodeBodySource returns a NodeBodySource', () => {
    expect(createNodeBodySource(makeReq(['x']))).toBeInstanceOf(NodeBodySource);
  });

  it('stream() enforces the size limit mid-stream', async () => {
    const source = new NodeBodySource(makeReq(['x'.repeat(100)]), { limit: 10 });
    const s = source.stream() as unknown as Readable;
    await expect(
      new Promise<void>((resolve, reject) => {
        s.on('data', () => {});
        s.on('error', reject);
        s.on('end', resolve);
      })
    ).rejects.toBeInstanceOf(BodyTooLargeError);
  });

  it('EmptyBodySource: json() rejects with BadRequestError; stream() yields an empty readable', async () => {
    const empty = createEmptyBodySource();
    await expect(empty.json()).rejects.toBeInstanceOf(BadRequestError);
    const s = empty.stream() as unknown as Readable;
    const chunks: Buffer[] = [];
    for await (const c of s) {
      chunks.push(c as Buffer);
    }
    expect(Buffer.concat(chunks).length).toBe(0);
  });
});
