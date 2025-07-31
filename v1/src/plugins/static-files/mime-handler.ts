/**
 * 🎭 MIME Type Handler
 * Comprehensive MIME type detection and management
 */

import * as path from 'path';
import { MIME_TYPES } from './types';

/**
 * MIME type handler for static files
 */
export class MimeTypeHandler {
  private customTypes = new Map<string, string>();

  constructor() {
    // Pre-populate with default types
    this.initializeDefaults();
  }

  /**
   * Get MIME type for file extension
   */
  getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();

    // Check custom types first
    if (this.customTypes.has(ext)) {
      return this.customTypes.get(ext)!;
    }

    // Check default types
    if (MIME_TYPES.has(ext)) {
      return MIME_TYPES.get(ext)!;
    }

    // Default fallback
    return 'application/octet-stream';
  }

  /**
   * Add custom MIME type mapping
   */
  addType(extension: string, mimeType: string): void {
    const ext = extension.startsWith('.') ? extension : '.' + extension;
    this.customTypes.set(ext.toLowerCase(), mimeType);
  }

  /**
   * Remove custom MIME type mapping
   */
  removeType(extension: string): boolean {
    const ext = extension.startsWith('.') ? extension : '.' + extension;
    return this.customTypes.delete(ext.toLowerCase());
  }

  /**
   * Check if MIME type is text-based
   */
  isTextType(mimeType: string): boolean {
    return (
      mimeType.startsWith('text/') ||
      mimeType.includes('javascript') ||
      mimeType.includes('json') ||
      mimeType.includes('xml') ||
      mimeType === 'image/svg+xml'
    );
  }

  /**
   * Check if MIME type is an image
   */
  isImageType(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  /**
   * Check if MIME type is video
   */
  isVideoType(mimeType: string): boolean {
    return mimeType.startsWith('video/');
  }

  /**
   * Check if MIME type is audio
   */
  isAudioType(mimeType: string): boolean {
    return mimeType.startsWith('audio/');
  }

  /**
   * Check if MIME type supports range requests (streaming)
   */
  supportsRangeRequests(mimeType: string): boolean {
    return (
      this.isVideoType(mimeType) ||
      this.isAudioType(mimeType) ||
      mimeType === 'application/pdf' ||
      mimeType === 'application/octet-stream'
    );
  }

  /**
   * Get appropriate charset for MIME type
   */
  getCharset(mimeType: string): string | null {
    if (this.isTextType(mimeType)) {
      return 'utf-8';
    }
    return null;
  }

  /**
   * Get complete content type with charset
   */
  getContentType(filePath: string): string {
    const mimeType = this.getMimeType(filePath);
    const charset = this.getCharset(mimeType);

    if (charset) {
      return `${mimeType}; charset=${charset}`;
    }

    return mimeType;
  }

  /**
   * Check if file should have security headers
   */
  needsSecurityHeaders(mimeType: string): boolean {
    // HTML and script files need additional security
    return (
      mimeType === 'text/html' ||
      mimeType === 'application/javascript' ||
      mimeType === 'text/javascript'
    );
  }

  /**
   * Get all registered MIME types
   */
  getAllTypes(): Map<string, string> {
    const allTypes = new Map(MIME_TYPES);

    // Add custom types
    for (const [ext, type] of this.customTypes) {
      allTypes.set(ext, type);
    }

    return allTypes;
  }

  /**
   * Initialize default MIME types
   */
  private initializeDefaults(): void {
    // Add some common aliases that might not be in the main list
    const aliases = [
      ['.htm', 'text/html'],
      ['.jpeg', 'image/jpeg'],
      ['.tif', 'image/tiff'],
      ['.txt', 'text/plain'],
      ['.log', 'text/plain'],
      ['.conf', 'text/plain'],
      ['.cfg', 'text/plain'],
    ];

    aliases.forEach(([ext, type]) => {
      if (!MIME_TYPES.has(ext)) {
        this.customTypes.set(ext, type);
      }
    });
  }

  /**
   * Detect MIME type from file content (basic detection)
   */
  detectFromContent(content: Buffer): string | null {
    // Check for common file signatures
    if (content.length < 8) return null;

    const header = content.slice(0, 8);

    // PNG signature
    if (
      header[0] === 0x89 &&
      header[1] === 0x50 &&
      header[2] === 0x4e &&
      header[3] === 0x47
    ) {
      return 'image/png';
    }

    // JPEG signature
    if (header[0] === 0xff && header[1] === 0xd8) {
      return 'image/jpeg';
    }

    // GIF signature
    if (header.slice(0, 3).toString() === 'GIF') {
      return 'image/gif';
    }

    // PDF signature
    if (header.slice(0, 4).toString() === '%PDF') {
      return 'application/pdf';
    }

    // ZIP signature (also used by many formats)
    if (header[0] === 0x50 && header[1] === 0x4b) {
      return 'application/zip';
    }

    return null;
  }
}
