/**
 * @nextrush/multipart - Boundary Scanner
 *
 * Boyer-Moore-Horspool-based byte sequence scanner for finding
 * multipart boundaries in binary data streams.
 *
 * Works exclusively with Uint8Array — no Node.js dependencies.
 *
 * @packageDocumentation
 */

/**
 * Result of a boundary search within a chunk.
 */
export interface ScanResult {
  /** Index where the boundary starts, or -1 if not found */
  readonly index: number;
  /** Whether this is the final boundary (ends with `--`) */
  readonly isFinal: boolean;
}

/**
 * Finds multipart boundary markers in binary data.
 *
 * Uses the Boyer-Moore-Horspool algorithm for efficient byte pattern matching.
 * Handles boundaries split across chunk edges via a lookback buffer.
 */
export class BoundaryScanner {
  /** The full boundary pattern: `\r\n--<boundary>` */
  private readonly pattern: Uint8Array;
  /** Skip table for Boyer-Moore-Horspool */
  private readonly skipTable: Uint8Array;
  /** Encoder for string→bytes */
  private static readonly encoder = new TextEncoder();

  constructor(boundary: string) {
    // The delimiter in the body is `\r\n--<boundary>`
    // The first part doesn't have the leading `\r\n` — handled by the parser
    const raw = `\r\n--${boundary}`;
    this.pattern = BoundaryScanner.encoder.encode(raw);
    this.skipTable = buildSkipTable(this.pattern);
  }

  /** Length of the boundary pattern */
  get length(): number {
    return this.pattern.length;
  }

  /**
   * Search for the boundary pattern within `data`, starting at `offset`.
   *
   * @returns The byte offset where the boundary starts, or -1 if not found.
   */
  indexOf(data: Uint8Array, offset = 0): number {
    return boyerMooreHorspool(data, this.pattern, this.skipTable, offset);
  }

  /**
   * Check whether `data` at `offset` is followed by `--` (final boundary).
   *
   * A final boundary looks like `\r\n--<boundary>--`.
   */
  isFinalBoundary(data: Uint8Array, boundaryEnd: number): boolean {
    return (
      boundaryEnd + 1 < data.length &&
      data[boundaryEnd] === 0x2d && // '-'
      data[boundaryEnd + 1] === 0x2d // '-'
    );
  }
}

// ---------------------------------------------------------------------------
// Boyer-Moore-Horspool Implementation
// ---------------------------------------------------------------------------

/**
 * Build the skip/shift table for Boyer-Moore-Horspool.
 *
 * For each byte value, stores how far we can skip on a mismatch.
 * Default skip = pattern length. For bytes that appear in the pattern,
 * skip = distance from that byte's last occurrence to the pattern end.
 */
function buildSkipTable(pattern: Uint8Array): Uint8Array {
  const len = pattern.length;
  const table = new Uint8Array(256).fill(len);

  // Populate with the last occurrence distance (excluding the last byte)
  for (let i = 0; i < len - 1; i++) {
    table[pattern[i]!] = len - 1 - i;
  }

  return table;
}

/**
 * Boyer-Moore-Horspool search for a byte pattern in a data array.
 *
 * @returns Index of the first match, or -1 if not found.
 */
function boyerMooreHorspool(
  data: Uint8Array,
  pattern: Uint8Array,
  skipTable: Uint8Array,
  offset: number
): number {
  const dataLen = data.length;
  const patternLen = pattern.length;

  if (patternLen === 0) return offset;
  if (dataLen - offset < patternLen) return -1;

  let i = offset + patternLen - 1; // Align to end of pattern

  while (i < dataLen) {
    let j = patternLen - 1;
    let k = i;

    // Compare backwards from the end of the pattern
    while (j >= 0 && data[k] === pattern[j]) {
      j--;
      k--;
    }

    if (j < 0) {
      // Full match found
      return k + 1;
    }

    // Skip based on the mismatched byte in the data
    i += skipTable[data[i]!]!;
  }

  return -1;
}
