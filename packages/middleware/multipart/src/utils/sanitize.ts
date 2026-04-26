/**
 * @nextrush/multipart - Filename Sanitization
 *
 * Multi-step pipeline to make client-supplied filenames safe for filesystem use.
 * Prevents path traversal, null byte injection, and platform-specific issues.
 *
 * Uses Web Crypto API (globalThis.crypto) — works on all runtimes.
 *
 * @packageDocumentation
 */

import { MAX_FILENAME_LENGTH, UNSAFE_FILENAME_CHARS } from '../constants.js';

/**
 * Windows reserved device names (case-insensitive).
 * Files with these names (with or without extension) can cause issues on Windows.
 */
const WINDOWS_RESERVED = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;

/**
 * Sanitize a client-supplied filename for safe filesystem storage.
 *
 * Steps:
 * 1. Strip path components (directory traversal)
 * 2. Remove null bytes and control characters
 * 3. Strip leading dots (hidden files)
 * 4. Replace unsafe characters
 * 5. Truncate to safe length
 * 6. Fall back to UUID if result is empty
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || filename.trim().length === 0) {
    return generateFallbackName('');
  }

  let safe = filename;

  // 1. Strip path components — take only the basename
  //    Handles both forward and back slashes
  const lastSlash = Math.max(safe.lastIndexOf('/'), safe.lastIndexOf('\\'));
  if (lastSlash >= 0) {
    safe = safe.slice(lastSlash + 1);
  }

  // 2. Remove null bytes and control characters (0x00-0x1F)
  safe = safe.replace(UNSAFE_FILENAME_CHARS, '_');

  // 3. Strip leading dots (prevent hidden files like .htaccess)
  safe = safe.replace(/^\.+/, '');

  // 4. Normalize repeated underscores/dots
  safe = safe.replace(/_{2,}/g, '_');
  safe = safe.replace(/\.{2,}/g, '.');

  // 5. Trim whitespace and trailing dots (Windows compatibility)
  safe = safe.trim().replace(/\.+$/, '');

  // 6. Check for Windows reserved device names (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
  const dotIdx = safe.indexOf('.');
  const baseName = dotIdx > 0 ? safe.slice(0, dotIdx) : safe;
  if (WINDOWS_RESERVED.test(baseName)) {
    safe = `_${safe}`;
  }

  // 7. Truncate to safe length (preserve extension)
  if (safe.length > MAX_FILENAME_LENGTH) {
    const ext = getExtension(safe);
    const nameLimit = MAX_FILENAME_LENGTH - ext.length;
    safe = safe.slice(0, nameLimit) + ext;
  }

  // 8. If nothing remains, generate a fallback
  if (safe.length === 0) {
    return generateFallbackName(filename);
  }

  return safe;
}

/**
 * Generate a UUID-based fallback filename, preserving the original extension if possible.
 */
function generateFallbackName(original: string): string {
  const ext = original ? getExtension(original) : '';
  const safeExt = ext.replace(UNSAFE_FILENAME_CHARS, '');
  return `upload-${globalThis.crypto.randomUUID()}${safeExt}`;
}

/**
 * Extract file extension from a filename (pure string operation).
 * Equivalent to path.extname() but without Node.js dependency.
 */
function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === filename.length - 1) return '';
  return filename.slice(lastDot);
}
