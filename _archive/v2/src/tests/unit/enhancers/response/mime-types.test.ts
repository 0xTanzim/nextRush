/**
 * MIME Types Unit Tests
 */

import {
  getContentTypeFromExtension,
  getSmartContentType,
  getSupportedMimeTypes,
  isBinaryMimeType,
  isTextMimeType,
} from '@/core/enhancers/response/mime-types';
import { describe, expect, it } from 'vitest';

describe('MIME Types', () => {
  describe('getContentTypeFromExtension', () => {
    it('should return correct MIME type for common extensions', () => {
      expect(getContentTypeFromExtension('.html')).toContain('text/html');
      expect(getContentTypeFromExtension('.css')).toContain('text/css');
      expect(getContentTypeFromExtension('.js')).toContain('application/javascript');
      expect(getContentTypeFromExtension('.json')).toContain('application/json');
    });

    it('should handle extensions without leading dot', () => {
      expect(getContentTypeFromExtension('html')).toContain('text/html');
      expect(getContentTypeFromExtension('json')).toContain('application/json');
    });

    it('should be case-insensitive', () => {
      expect(getContentTypeFromExtension('.HTML')).toContain('text/html');
      expect(getContentTypeFromExtension('.JSON')).toContain('application/json');
    });

    it('should return default for unknown extensions', () => {
      expect(getContentTypeFromExtension('.xyz')).toBe('application/octet-stream');
      expect(getContentTypeFromExtension('.unknown')).toBe('application/octet-stream');
    });

    it('should return correct MIME types for images', () => {
      expect(getContentTypeFromExtension('.png')).toBe('image/png');
      expect(getContentTypeFromExtension('.jpg')).toBe('image/jpeg');
      expect(getContentTypeFromExtension('.gif')).toBe('image/gif');
      expect(getContentTypeFromExtension('.svg')).toBe('image/svg+xml');
    });

    it('should return correct MIME types for fonts', () => {
      expect(getContentTypeFromExtension('.woff')).toBe('font/woff');
      expect(getContentTypeFromExtension('.woff2')).toBe('font/woff2');
      expect(getContentTypeFromExtension('.ttf')).toBe('font/ttf');
    });

    it('should return correct MIME types for documents', () => {
      expect(getContentTypeFromExtension('.pdf')).toBe('application/pdf');
      expect(getContentTypeFromExtension('.zip')).toBe('application/zip');
    });
  });

  describe('getSmartContentType', () => {
    it('should detect MIME type from file path', () => {
      expect(getSmartContentType('/path/to/file.html')).toContain('text/html');
      expect(getSmartContentType('/path/to/style.css')).toContain('text/css');
      expect(getSmartContentType('/images/logo.png')).toBe('image/png');
    });

    it('should handle files without extension', () => {
      expect(getSmartContentType('/path/to/file')).toBe('application/octet-stream');
      expect(getSmartContentType('README')).toBe('application/octet-stream');
    });

    it('should handle dotfiles correctly', () => {
      expect(getSmartContentType('.gitignore')).toBe('application/octet-stream');
      expect(getSmartContentType('/path/.env')).toBe('application/octet-stream');
    });
  });

  describe('isTextMimeType', () => {
    it('should identify text MIME types', () => {
      expect(isTextMimeType('text/html')).toBe(true);
      expect(isTextMimeType('text/plain')).toBe(true);
      expect(isTextMimeType('text/css')).toBe(true);
    });

    it('should identify JSON as text', () => {
      expect(isTextMimeType('application/json')).toBe(true);
    });

    it('should identify XML as text', () => {
      expect(isTextMimeType('application/xml')).toBe(true);
    });

    it('should identify JavaScript as text', () => {
      expect(isTextMimeType('application/javascript')).toBe(true);
    });

    it('should not identify binary types as text', () => {
      expect(isTextMimeType('image/png')).toBe(false);
      expect(isTextMimeType('application/pdf')).toBe(false);
      expect(isTextMimeType('application/zip')).toBe(false);
    });
  });

  describe('isBinaryMimeType', () => {
    it('should identify binary MIME types', () => {
      expect(isBinaryMimeType('image/png')).toBe(true);
      expect(isBinaryMimeType('application/pdf')).toBe(true);
      expect(isBinaryMimeType('application/zip')).toBe(true);
    });

    it('should not identify text types as binary', () => {
      expect(isBinaryMimeType('text/html')).toBe(false);
      expect(isBinaryMimeType('application/json')).toBe(false);
    });
  });

  describe('getSupportedMimeTypes', () => {
    it('should return a record of supported types', () => {
      const types = getSupportedMimeTypes();
      expect(typeof types).toBe('object');
      expect(types['.html']).toBeDefined();
      expect(types['.json']).toBeDefined();
    });

    it('should not mutate the internal map', () => {
      const types1 = getSupportedMimeTypes();
      types1['.custom'] = 'test/custom';
      const types2 = getSupportedMimeTypes();
      expect(types2['.custom']).toBeUndefined();
    });
  });
});
