/**
 * @nextrush/runtime — UTF-8 size bounds for a decoded body.
 *
 * @remarks
 * Kept separate from {@link WebBodySource} so the bounds can be tested as pure
 * functions and so the size logic stays out of an already large class.
 *
 * @packageDocumentation
 */

const UTF8_ENCODER = new TextEncoder();

/**
 * Whether a decoded string exceeds a UTF-8 byte limit.
 *
 * @param text - Decoded body.
 * @param limit - Maximum allowed UTF-8 byte length.
 * @returns `true` when the encoded form is larger than `limit`.
 *
 * @remarks
 * A UTF-16 code unit encodes to at least one and at most three UTF-8 bytes, so
 * `text.length` is a lower bound and `text.length * 3` an upper bound on the
 * encoded size. The exact encoding runs only when the limit falls between the
 * two bounds, which keeps the common ASCII case free of extra work.
 */
export function exceedsUtf8Limit(text: string, limit: number): boolean {
  if (text.length > limit) return true;
  if (text.length * 3 <= limit) return false;
  return utf8ByteLength(text) > limit;
}

/**
 * Exact UTF-8 byte length of a decoded string.
 *
 * @param text - Decoded body.
 * @returns The number of bytes `text` occupies when UTF-8 encoded.
 *
 * @remarks
 * Used on rejection paths, where the byte count is user-visible in
 * {@link BodyTooLargeError.received}. `text.length` is a code-unit count and
 * under-reports any non-ASCII body.
 */
export function utf8ByteLength(text: string): number {
  return UTF8_ENCODER.encode(text).byteLength;
}
