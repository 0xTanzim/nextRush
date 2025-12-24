/**
 * Template Helpers Unit Tests
 */

import {
  conditional,
  escapeHtmlEntities,
  formatValue,
  getNestedValue,
  isTruthy,
  renderTemplate,
  unescapeHtmlEntities,
} from '@/core/enhancers/response/template-helpers';
import { describe, expect, it } from 'vitest';

describe('Template Helpers', () => {
  describe('renderTemplate', () => {
    it('should replace simple placeholders', () => {
      const result = renderTemplate('Hello {{name}}!', { name: 'World' });
      expect(result).toBe('Hello World!');
    });

    it('should replace multiple placeholders', () => {
      const result = renderTemplate(
        '{{greeting}}, {{name}}!',
        { greeting: 'Hello', name: 'World' }
      );
      expect(result).toBe('Hello, World!');
    });

    it('should handle nested properties', () => {
      const result = renderTemplate(
        '{{user.name}} is {{user.age}}',
        { user: { name: 'John', age: 30 } }
      );
      expect(result).toBe('John is 30');
    });

    it('should handle missing values silently', () => {
      const result = renderTemplate('Hello {{name}}!', {});
      expect(result).toBe('Hello !');
    });

    it('should throw in strict mode for missing values', () => {
      expect(() =>
        renderTemplate('Hello {{name}}!', {}, { strict: true })
      ).toThrow('Template variable not found: name');
    });

    it('should escape HTML by default', () => {
      const result = renderTemplate('{{text}}', { text: '<script>alert(1)</script>' });
      expect(result).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('should not escape HTML when disabled', () => {
      const result = renderTemplate(
        '{{text}}',
        { text: '<b>bold</b>' },
        { escapeHtml: false }
      );
      expect(result).toBe('<b>bold</b>');
    });

    it('should support custom delimiters', () => {
      const result = renderTemplate(
        'Hello <%= name %>!',
        { name: 'World' },
        { delimiters: ['<%=', '%>'] }
      );
      expect(result).toBe('Hello World!');
    });

    it('should handle spaces in placeholders', () => {
      const result = renderTemplate('Hello {{ name }}!', { name: 'World' });
      expect(result).toBe('Hello World!');
    });
  });

  describe('getNestedValue', () => {
    it('should get simple property', () => {
      expect(getNestedValue({ name: 'John' }, 'name')).toBe('John');
    });

    it('should get nested property', () => {
      const obj = { user: { profile: { name: 'John' } } };
      expect(getNestedValue(obj, 'user.profile.name')).toBe('John');
    });

    it('should return undefined for missing property', () => {
      expect(getNestedValue({ name: 'John' }, 'age')).toBeUndefined();
    });

    it('should return undefined for missing nested path', () => {
      expect(getNestedValue({ user: {} }, 'user.profile.name')).toBeUndefined();
    });

    it('should handle null input', () => {
      expect(getNestedValue(null, 'name')).toBeUndefined();
    });

    it('should handle undefined input', () => {
      expect(getNestedValue(undefined, 'name')).toBeUndefined();
    });

    it('should handle array access', () => {
      const obj = { items: [{ id: 1 }, { id: 2 }] };
      expect(getNestedValue(obj, 'items.0.id')).toBe(1);
    });
  });

  describe('isTruthy', () => {
    it('should return true for truthy values', () => {
      expect(isTruthy('hello')).toBe(true);
      expect(isTruthy(1)).toBe(true);
      expect(isTruthy(true)).toBe(true);
      expect(isTruthy([1])).toBe(true);
      expect(isTruthy({ a: 1 })).toBe(true);
    });

    it('should return false for falsy values', () => {
      expect(isTruthy(null)).toBe(false);
      expect(isTruthy(undefined)).toBe(false);
      expect(isTruthy(false)).toBe(false);
      expect(isTruthy(0)).toBe(false);
      expect(isTruthy('')).toBe(false);
    });

    it('should return false for empty arrays', () => {
      expect(isTruthy([])).toBe(false);
    });

    it('should return false for empty objects', () => {
      expect(isTruthy({})).toBe(false);
    });
  });

  describe('escapeHtmlEntities', () => {
    it('should escape HTML special characters', () => {
      expect(escapeHtmlEntities('<script>')).toBe('&lt;script&gt;');
      expect(escapeHtmlEntities('"test"')).toBe('&quot;test&quot;');
      expect(escapeHtmlEntities("it's")).toBe("it&#39;s");
      expect(escapeHtmlEntities('a & b')).toBe('a &amp; b');
    });

    it('should handle strings without special characters', () => {
      expect(escapeHtmlEntities('hello world')).toBe('hello world');
    });

    it('should escape all occurrences', () => {
      expect(escapeHtmlEntities('<a><b>')).toBe('&lt;a&gt;&lt;b&gt;');
    });
  });

  describe('unescapeHtmlEntities', () => {
    it('should unescape HTML entities', () => {
      expect(unescapeHtmlEntities('&lt;script&gt;')).toBe('<script>');
      expect(unescapeHtmlEntities('&quot;test&quot;')).toBe('"test"');
      expect(unescapeHtmlEntities("it&#39;s")).toBe("it's");
      expect(unescapeHtmlEntities('a &amp; b')).toBe('a & b');
    });

    it('should handle strings without entities', () => {
      expect(unescapeHtmlEntities('hello world')).toBe('hello world');
    });
  });

  describe('conditional', () => {
    it('should return ifTrue for truthy condition', () => {
      expect(conditional(true, 'yes', 'no')).toBe('yes');
      expect(conditional(1, 'yes', 'no')).toBe('yes');
      expect(conditional('hello', 'yes', 'no')).toBe('yes');
    });

    it('should return ifFalse for falsy condition', () => {
      expect(conditional(false, 'yes', 'no')).toBe('no');
      expect(conditional(0, 'yes', 'no')).toBe('no');
      expect(conditional(null, 'yes', 'no')).toBe('no');
    });
  });

  describe('formatValue', () => {
    it('should format numbers', () => {
      const result = formatValue(1000, 'number');
      expect(result).toContain('1');
    });

    it('should format currency', () => {
      const result = formatValue(99.99, 'currency');
      expect(result).toContain('99.99');
    });

    it('should format percentages', () => {
      const result = formatValue(0.5, 'percent');
      expect(result).toBe('50.00%');
    });

    it('should format dates', () => {
      const date = new Date('2024-01-15');
      const result = formatValue(date, 'date');
      expect(result).toBeTruthy();
    });

    it('should handle null values', () => {
      expect(formatValue(null, 'number')).toBe('');
      expect(formatValue(undefined, 'number')).toBe('');
    });
  });
});
