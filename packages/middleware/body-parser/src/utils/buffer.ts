/**
 * @nextrush/body-parser - Buffer Utilities
 *
 * Runtime-agnostic byte helpers (BP-1). Uses the Web-standard `TextDecoder`
 * and `Uint8Array` so the package loads and runs on every runtime — Node.js,
 * Bun, Deno, and true edge runtimes (Cloudflare Workers, Vercel/Netlify Edge).
 * There is no `node:string_decoder` import and no unconditional `Buffer` use.
 *
 * @packageDocumentation
 */

/**
 * Map supported charset labels (and their common aliases) to a canonical
 * `TextDecoder` encoding label. Fixes the alias mismatch (BP-4) that previously
 * threw a raw `TypeError` for dashed forms like `ucs-2` / `utf-16le`.
 */
const DECODER_LABELS: Readonly<Record<string, string>> = {
  'utf-8': 'utf-8',
  utf8: 'utf-8',
  'utf-16le': 'utf-16le',
  utf16le: 'utf-16le',
  'ucs-2': 'utf-16le',
  ucs2: 'utf-16le',
  latin1: 'iso-8859-1',
  binary: 'iso-8859-1',
  'iso-8859-1': 'iso-8859-1',
  ascii: 'ascii',
};

/** Cache decoder instances (stateless for one-shot decode) to avoid per-call allocation. */
const decoderCache = new Map<string, TextDecoder>();

function decoderFor(charset: string): TextDecoder {
  const label = DECODER_LABELS[charset.toLowerCase()] ?? 'utf-8';
  let decoder = decoderCache.get(label);
  if (decoder === undefined) {
    decoder = new TextDecoder(label);
    decoderCache.set(label, decoder);
  }
  return decoder;
}

/**
 * Decode bytes to a string using a Web-standard `TextDecoder`.
 *
 * @param bytes - Bytes to decode
 * @param charset - Character set (default `'utf-8'`); unknown charsets fall back to UTF-8
 * @returns Decoded string
 */
export function bufferToString(bytes: Uint8Array, charset = 'utf-8'): string {
  if (bytes.length === 0) {
    return '';
  }
  // BP-G: on Node-family runtimes the body bytes are already a `Buffer`, and
  // `Buffer.toString('utf8')` decodes measurably faster than `TextDecoder` for the
  // common small-to-mid UTF-8 payload (see the decode micro-bench) with byte-identical
  // output — including U+FFFD replacement for malformed sequences. The exact-string
  // charset checks avoid a per-call `toLowerCase()` allocation on the hot path. Falls
  // back to the cached `TextDecoder` for non-UTF-8 charsets and true edge runtimes
  // (plain `Uint8Array`, no `Buffer` global).
  if (
    (charset === 'utf-8' || charset === 'utf8') &&
    typeof Buffer !== 'undefined' &&
    Buffer.isBuffer(bytes)
  ) {
    return bytes.toString('utf8');
  }
  return decoderFor(charset).decode(bytes);
}

/**
 * Concatenate byte chunks into a single `Uint8Array`.
 *
 * @param chunks - Array of byte chunks
 * @param totalLength - Pre-calculated total length
 * @returns Concatenated bytes
 */
export function concatBuffers(chunks: Uint8Array[], totalLength: number): Uint8Array {
  // Empty case
  if (chunks.length === 0) {
    return new Uint8Array(0);
  }

  // Single chunk optimization - avoid allocation/copy
  if (chunks.length === 1) {
    return chunks[0] ?? new Uint8Array(0);
  }

  // Multiple chunks - copy into one contiguous buffer
  const out = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/**
 * Present raw bytes to user code as a Node `Buffer` when the runtime provides
 * one (nicer DX: `ctx.rawBody.toString('utf8')`, `.readUInt32BE`, etc.), and as
 * the plain `Uint8Array` otherwise. Never imports `node:buffer` — it only reads
 * the optional `Buffer` global, so edge runtimes simply get the `Uint8Array`.
 *
 * @param bytes - Raw body bytes
 * @returns A `Buffer` on Node/Bun/Deno, or the original `Uint8Array` on edge
 */
export function toRawBody(bytes: Uint8Array): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    // Zero-copy view over the same memory.
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  return bytes;
}
