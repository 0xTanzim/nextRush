/**
 * Text and Raw Parsers Tests
 */

import {
  RawParser,
  TextParser,
  createRawParser,
  createTextParser,
  getRawParser,
  getTextParser,
  parseRaw,
  parseText,
  type RawParserOptions,
  type TextParserOptions,
} from '@/core/middleware/body-parser/text-raw-parsers';
import { beforeEach, describe, expect, it } from 'vitest';

describe('Text and Raw Parsers', () => {
  describe('TextParser', () => {
    let parser: TextParser;

    beforeEach(() => {
      parser = new TextParser();
    });

    describe('Constructor and Options', () => {
      it('should create parser with default options', () => {
        const parser = new TextParser();
        const metrics = parser.getMetrics();

        expect(metrics['maxLength']).toBe(1024 * 1024); // 1MB
        expect(metrics['normalizeLineEndings']).toBe(0);
        expect(metrics['trimWhitespace']).toBe(0);
      });

      it('should create parser with custom options', () => {
        const options: TextParserOptions = {
          encoding: 'ascii',
          maxLength: 2048,
          normalizeLineEndings: true,
          trimWhitespace: true,
        };

        const parser = new TextParser(options);
        const metrics = parser.getMetrics();

        expect(metrics['maxLength']).toBe(2048);
        expect(metrics['normalizeLineEndings']).toBe(1);
        expect(metrics['trimWhitespace']).toBe(1);
      });
    });

    describe('Text Parsing', () => {
      it('should parse simple text', async () => {
        const textData = 'Hello World';
        const buffer = Buffer.from(textData, 'utf8');

        const result = await parser.parse(buffer, 'text/plain');

        expect(result.data).toBe(textData);
        expect(result.contentType).toBe('text/plain');
        expect(result.parser).toBe('text');
        expect(result.hasFiles).toBe(false);
        expect(result.isEmpty).toBe(false);
        expect(typeof result.parseTime).toBe('number');
      });

      it('should parse empty text', async () => {
        const buffer = Buffer.from('', 'utf8');

        const result = await parser.parse(buffer, 'text/plain');

        expect(result.data).toBe('');
        expect(result.isEmpty).toBe(true);
      });

      it('should handle different encodings', async () => {
        const parser = new TextParser({ encoding: 'ascii' });
        const textData = 'ASCII text';
        const buffer = Buffer.from(textData, 'ascii');

        const result = await parser.parse(buffer, 'text/plain');

        expect(result.data).toBe(textData);
      });

      it('should normalize line endings', async () => {
        const parser = new TextParser({ normalizeLineEndings: true });
        const textData = 'Line 1\r\nLine 2\rLine 3\n';
        const buffer = Buffer.from(textData, 'utf8');

        const result = await parser.parse(buffer, 'text/plain');

        expect(result.data).toBe('Line 1\nLine 2\nLine 3\n');
      });

      it('should trim whitespace', async () => {
        const parser = new TextParser({ trimWhitespace: true });
        const textData = '  Hello World  ';
        const buffer = Buffer.from(textData, 'utf8');

        const result = await parser.parse(buffer, 'text/plain');

        expect(result.data).toBe('Hello World');
      });

      it('should apply both normalization and trimming', async () => {
        const parser = new TextParser({
          normalizeLineEndings: true,
          trimWhitespace: true,
        });
        const textData = '  Line 1\r\nLine 2\r  ';
        const buffer = Buffer.from(textData, 'utf8');

        const result = await parser.parse(buffer, 'text/plain');

        expect(result.data).toBe('Line 1\nLine 2');
      });

      it('should throw error for text too large', async () => {
        const parser = new TextParser({ maxLength: 10 });
        const largeText = 'This text is too long';
        const buffer = Buffer.from(largeText, 'utf8');

        await expect(parser.parse(buffer, 'text/plain')).rejects.toThrow(
          'Text too large: 21 bytes (max: 10)'
        );
      });

      it('should handle parse errors gracefully', async () => {
        // Create a scenario that might cause parsing issues
        const invalidBuffer = Buffer.alloc(10);
        invalidBuffer.fill(0xff); // Fill with invalid UTF-8 bytes

        // This should still work with optimizedBufferToString handling
        const result = await parser.parse(invalidBuffer, 'text/plain');
        expect(typeof result.data).toBe('string');
      });
    });

    describe('Metrics', () => {
      it('should return correct metrics', () => {
        const metrics = parser.getMetrics();

        expect(typeof metrics['maxLength']).toBe('number');
        expect(typeof metrics['normalizeLineEndings']).toBe('number');
        expect(typeof metrics['trimWhitespace']).toBe('number');
      });
    });
  });

  describe('RawParser', () => {
    let parser: RawParser;

    beforeEach(() => {
      parser = new RawParser();
    });

    describe('Constructor and Options', () => {
      it('should create parser with default options', () => {
        const parser = new RawParser();
        const metrics = parser.getMetrics();

        expect(metrics['maxSize']).toBe(10 * 1024 * 1024); // 10MB
        expect(metrics['copyBuffer']).toBe(0);
      });

      it('should create parser with custom options', () => {
        const options: RawParserOptions = {
          maxSize: 1024,
          copyBuffer: true,
        };

        const parser = new RawParser(options);
        const metrics = parser.getMetrics();

        expect(metrics['maxSize']).toBe(1024);
        expect(metrics['copyBuffer']).toBe(1);
      });
    });

    describe('Raw Data Parsing', () => {
      it('should parse raw data without copying', async () => {
        const rawData = Buffer.from([1, 2, 3, 4, 5]);

        const result = await parser.parse(rawData, 'application/octet-stream');

        expect(result.data).toBe(rawData); // Same reference
        expect(result.contentType).toBe('application/octet-stream');
        expect(result.parser).toBe('raw');
        expect(result.hasFiles).toBe(false);
        expect(result.isEmpty).toBe(false);
        expect(typeof result.parseTime).toBe('number');
      });

      it('should parse raw data with copying', async () => {
        const parser = new RawParser({ copyBuffer: true });
        const rawData = Buffer.from([1, 2, 3, 4, 5]);

        const result = await parser.parse(rawData, 'application/octet-stream');

        expect(result.data).not.toBe(rawData); // Different reference
        expect(Buffer.isBuffer(result.data)).toBe(true);
        expect((result.data as Buffer).equals(rawData)).toBe(true);
      });

      it('should parse empty raw data', async () => {
        const rawData = Buffer.alloc(0);

        const result = await parser.parse(rawData, 'application/octet-stream');

        expect(result.data).toBe(rawData);
        expect(result.isEmpty).toBe(true);
      });

      it('should throw error for data too large', async () => {
        const parser = new RawParser({ maxSize: 10 });
        const largeData = Buffer.alloc(20);

        await expect(
          parser.parse(largeData, 'application/octet-stream')
        ).rejects.toThrow('Raw data too large: 20 bytes (max: 10)');
      });

      it('should handle different content types', async () => {
        const rawData = Buffer.from('binary data');

        const result = await parser.parse(rawData, 'application/pdf');

        expect(result.contentType).toBe('application/pdf');
        expect(result.data).toBe(rawData);
      });
    });

    describe('Metrics', () => {
      it('should return correct metrics', () => {
        const metrics = parser.getMetrics();

        expect(typeof metrics['maxSize']).toBe('number');
        expect(typeof metrics['copyBuffer']).toBe('number');
      });
    });
  });

  describe('Factory Functions', () => {
    describe('createTextParser', () => {
      it('should create new TextParser instance', () => {
        const parser = createTextParser();
        expect(parser).toBeInstanceOf(TextParser);
      });

      it('should create TextParser with options', () => {
        const options: TextParserOptions = { maxLength: 2048 };
        const parser = createTextParser(options);

        expect(parser.getMetrics()['maxLength']).toBe(2048);
      });
    });

    describe('createRawParser', () => {
      it('should create new RawParser instance', () => {
        const parser = createRawParser();
        expect(parser).toBeInstanceOf(RawParser);
      });

      it('should create RawParser with options', () => {
        const options: RawParserOptions = { maxSize: 2048 };
        const parser = createRawParser(options);

        expect(parser.getMetrics()['maxSize']).toBe(2048);
      });
    });

    describe('getTextParser', () => {
      it('should return singleton TextParser instance', () => {
        const parser1 = getTextParser();
        const parser2 = getTextParser();

        expect(parser1).toBe(parser2); // Same instance
        expect(parser1).toBeInstanceOf(TextParser);
      });
    });

    describe('getRawParser', () => {
      it('should return singleton RawParser instance', () => {
        const parser1 = getRawParser();
        const parser2 = getRawParser();

        expect(parser1).toBe(parser2); // Same instance
        expect(parser1).toBeInstanceOf(RawParser);
      });
    });
  });

  describe('Quick Parse Functions', () => {
    describe('parseText', () => {
      it('should parse text with default parser', async () => {
        const textData = 'Hello World';
        const buffer = Buffer.from(textData, 'utf8');

        const result = await parseText(buffer);

        expect(result.data).toBe(textData);
        expect(result.contentType).toBe('text/plain');
        expect(result.parser).toBe('text');
      });

      it('should parse text with custom content type', async () => {
        const textData = 'HTML content';
        const buffer = Buffer.from(textData, 'utf8');

        const result = await parseText(buffer, 'text/html');

        expect(result.data).toBe(textData);
        expect(result.contentType).toBe('text/html');
      });

      it('should parse text with custom options', async () => {
        const textData = '  Hello World  ';
        const buffer = Buffer.from(textData, 'utf8');
        const options: TextParserOptions = { trimWhitespace: true };

        const result = await parseText(buffer, 'text/plain', options);

        expect(result.data).toBe('Hello World');
      });
    });

    describe('parseRaw', () => {
      it('should parse raw data with default parser', async () => {
        const rawData = Buffer.from([1, 2, 3, 4, 5]);

        const result = await parseRaw(rawData);

        expect(result.data).toBe(rawData);
        expect(result.contentType).toBe('application/octet-stream');
        expect(result.parser).toBe('raw');
      });

      it('should parse raw data with custom content type', async () => {
        const rawData = Buffer.from('binary data');

        const result = await parseRaw(rawData, 'application/pdf');

        expect(result.data).toBe(rawData);
        expect(result.contentType).toBe('application/pdf');
      });

      it('should parse raw data with custom options', async () => {
        const rawData = Buffer.from([1, 2, 3, 4, 5]);
        const options: RawParserOptions = { copyBuffer: true };

        const result = await parseRaw(
          rawData,
          'application/octet-stream',
          options
        );

        expect(result.data).not.toBe(rawData); // Should be copied
        expect(Buffer.isBuffer(result.data)).toBe(true);
        expect((result.data as Buffer).equals(rawData)).toBe(true);
      });
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large text files efficiently', async () => {
      const largeText = 'A'.repeat(100000); // 100KB
      const buffer = Buffer.from(largeText, 'utf8');

      const start = performance.now();
      const result = await parseText(buffer);
      const duration = performance.now() - start;

      expect(result.data).toBe(largeText);
      expect(duration).toBeLessThan(100); // Should be fast
    });

    it('should handle large raw data efficiently', async () => {
      const largeData = Buffer.alloc(100000); // 100KB
      largeData.fill(42);

      const start = performance.now();
      const result = await parseRaw(largeData);
      const duration = performance.now() - start;

      expect(result.data).toBe(largeData);
      expect(duration).toBeLessThan(50); // Should be very fast
    });

    it('should handle Unicode text correctly', async () => {
      const unicodeText = '你好世界 🌍 Hello! ñáéíóú';
      const buffer = Buffer.from(unicodeText, 'utf8');

      const result = await parseText(buffer);

      expect(result.data).toBe(unicodeText);
    });

    it('should handle binary data with null bytes', async () => {
      const binaryData = Buffer.from([0, 1, 2, 0, 4, 5]);

      const result = await parseRaw(binaryData);

      expect(result.data).toBe(binaryData);
      expect((result.data as Buffer)[0]).toBe(0);
      expect((result.data as Buffer)[3]).toBe(0);
    });
  });
});
