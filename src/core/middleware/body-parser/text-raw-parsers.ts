/**
 * 🚀 Text Body Parser - NextRush v2
 *
 * Ultra-fast text content parsing
 * Only loads when Content-Type: text/* is detected
 *
 * Performance Features:
 * - 🔥 Fast text conversion with encoding detection
 * - ⚡ Optimized buffer handling for text content
 * - 🎯 Early validation for text formats
 * - 💾 Memory-efficient string processing
 *
 * @author NextRush Framework Team
 * @version 2.0.0
 */

import type { BodyParseResult } from './types';
import { isEmpty, optimizedBufferToString } from './utils';

/**
 * Text Parser configuration
 */
export interface TextParserOptions {
  /** Default encoding for text content (default: 'utf8') */
  encoding?: BufferEncoding;

  /** Maximum text length (default: 1MB) */
  maxLength?: number;

  /** Enable line ending normalization (default: false) */
  normalizeLineEndings?: boolean;

  /** Trim whitespace from text (default: false) */
  trimWhitespace?: boolean;
}

/**
 * ⚡ Ultra-fast text parser class
 */
export class TextParser {
  private options: Required<TextParserOptions>;

  constructor(options: TextParserOptions = {}) {
    this.options = {
      encoding: 'utf8',
      maxLength: 1024 * 1024, // 1MB
      normalizeLineEndings: false,
      trimWhitespace: false,
      ...options,
    };
  }

  /**
   * 🚀 Parse text with optimal performance
   */
  async parse(
    rawData: Buffer,
    contentType: string
  ): Promise<Partial<BodyParseResult>> {
    const parseStart = performance.now();

    // Validate size
    if (rawData.length > this.options.maxLength) {
      throw new Error(
        `Text too large: ${rawData.length} bytes (max: ${this.options.maxLength})`
      );
    }

    try {
      // Convert buffer to string with optimized encoding
      let text = optimizedBufferToString(rawData, this.options.encoding);

      // Apply text transformations
      if (this.options.normalizeLineEndings) {
        text = this.normalizeLineEndings(text);
      }

      if (this.options.trimWhitespace) {
        text = text.trim();
      }

      const parseTime = performance.now() - parseStart;

      return {
        data: text,
        contentType,
        parser: 'text',
        hasFiles: false,
        isEmpty: isEmpty(text),
        parseTime,
      };
    } catch (err) {
      throw new Error(
        `Text parse error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * 🔄 Normalize line endings to LF
   */
  private normalizeLineEndings(text: string): string {
    return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }

  /**
   * 📊 Get parser performance metrics
   */
  getMetrics(): Record<string, number> {
    return {
      maxLength: this.options.maxLength,
      normalizeLineEndings: this.options.normalizeLineEndings ? 1 : 0,
      trimWhitespace: this.options.trimWhitespace ? 1 : 0,
    };
  }
}

/**
 * 🚀 Raw Body Parser - NextRush v2
 *
 * Ultra-fast raw binary data handling
 * Only loads when binary content types are detected
 */
export interface RawParserOptions {
  /** Maximum raw data size (default: 10MB) */
  maxSize?: number;

  /** Enable buffer copying for safety (default: false) */
  copyBuffer?: boolean;
}

/**
 * ⚡ Ultra-fast raw parser class
 */
export class RawParser {
  private options: Required<RawParserOptions>;

  constructor(options: RawParserOptions = {}) {
    this.options = {
      maxSize: 10 * 1024 * 1024, // 10MB
      copyBuffer: false,
      ...options,
    };
  }

  /**
   * 🚀 Parse raw data with optimal performance
   */
  async parse(
    rawData: Buffer,
    contentType: string
  ): Promise<Partial<BodyParseResult>> {
    const parseStart = performance.now();

    // Validate size
    if (rawData.length > this.options.maxSize) {
      throw new Error(
        `Raw data too large: ${rawData.length} bytes (max: ${this.options.maxSize})`
      );
    }

    try {
      // Use original buffer or create copy based on options
      const data = this.options.copyBuffer ? Buffer.from(rawData) : rawData;
      const parseTime = performance.now() - parseStart;

      return {
        data,
        contentType,
        parser: 'raw',
        hasFiles: false,
        isEmpty: data.length === 0,
        parseTime,
      };
    } catch (err) {
      throw new Error(
        `Raw parse error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * 📊 Get parser performance metrics
   */
  getMetrics(): Record<string, number> {
    return {
      maxSize: this.options.maxSize,
      copyBuffer: this.options.copyBuffer ? 1 : 0,
    };
  }
}

/**
 * 🚀 Default parser instances (lazy-loaded)
 */
let defaultTextParser: TextParser | null = null;
let defaultRawParser: RawParser | null = null;

/**
 * 📦 Factory functions
 */
export function createTextParser(options?: TextParserOptions): TextParser {
  return new TextParser(options);
}

export function createRawParser(options?: RawParserOptions): RawParser {
  return new RawParser(options);
}

/**
 * ⚡ Get or create default parser instances
 */
export function getTextParser(): TextParser {
  if (!defaultTextParser) {
    defaultTextParser = new TextParser();
  }
  return defaultTextParser;
}

export function getRawParser(): RawParser {
  if (!defaultRawParser) {
    defaultRawParser = new RawParser();
  }
  return defaultRawParser;
}

/**
 * 🎯 Quick parse functions for simple usage
 */
export async function parseText(
  rawData: Buffer,
  contentType: string = 'text/plain',
  options?: TextParserOptions
): Promise<Partial<BodyParseResult>> {
  const parser = options ? createTextParser(options) : getTextParser();
  return parser.parse(rawData, contentType);
}

export async function parseRaw(
  rawData: Buffer,
  contentType: string = 'application/octet-stream',
  options?: RawParserOptions
): Promise<Partial<BodyParseResult>> {
  const parser = options ? createRawParser(options) : getRawParser();
  return parser.parse(rawData, contentType);
}
