/**
 * Validation Engine Unit Tests
 */

import {
    isValidEmail,
    isValidUrl,
    sanitize,
    sanitizeObject,
    validate,
    validateField,
} from '@/core/enhancers/request/validation-engine';
import { describe, expect, it } from 'vitest';

describe('Validation Engine', () => {
  describe('isValidEmail', () => {
    it('should validate correct email formats', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.org')).toBe(true);
      expect(isValidEmail('test+tag@example.co.uk')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test @example.com')).toBe(false);
    });
  });

  describe('isValidUrl', () => {
    it('should validate correct URLs', () => {
      expect(isValidUrl('http://example.com')).toBe(true);
      expect(isValidUrl('https://example.com/path')).toBe(true);
      expect(isValidUrl('https://sub.domain.org:8080/path?query=1')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidUrl('')).toBe(false);
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('example.com')).toBe(false);
    });
  });

  describe('sanitize', () => {
    it('should trim strings', () => {
      expect(sanitize('  hello  ', { trim: true })).toBe('hello');
    });

    it('should convert to lowercase', () => {
      expect(sanitize('HELLO', { lowercase: true })).toBe('hello');
    });

    it('should convert to uppercase', () => {
      expect(sanitize('hello', { uppercase: true })).toBe('HELLO');
    });

    it('should remove HTML tags', () => {
      expect(sanitize('<script>alert(1)</script>hello', { removeHtml: true })).toBe(
        'alert(1)hello'
      );
      expect(sanitize('<p>text</p>', { removeHtml: true })).toBe('text');
    });

    it('should escape special characters', () => {
      const result = sanitize('<script>"test"</script>', { escape: true });
      expect(result).toBe(
        '&lt;script&gt;&quot;test&quot;&lt;/script&gt;'
      );
    });

    it('should remove special characters', () => {
      expect(sanitize('hello!@#$%world', { removeSpecialChars: true })).toBe(
        'helloworld'
      );
    });

    it('should apply multiple options', () => {
      expect(
        sanitize('  <p>HELLO</p>  ', { trim: true, removeHtml: true, lowercase: true })
      ).toBe('hello');
    });

    it('should return non-strings unchanged', () => {
      expect(sanitize(123, { trim: true })).toBe(123);
      expect(sanitize(null, { trim: true })).toBe(null);
      expect(sanitize({ key: 'value' }, { trim: true })).toEqual({ key: 'value' });
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize nested objects', () => {
      const obj = {
        name: '  John  ',
        nested: {
          value: '  nested  ',
        },
      };

      const result = sanitizeObject(obj, { trim: true });
      expect(result).toEqual({
        name: 'John',
        nested: {
          value: 'nested',
        },
      });
    });

    it('should preserve non-string values', () => {
      const obj = {
        name: '  John  ',
        age: 30,
        active: true,
      };

      const result = sanitizeObject(obj, { trim: true });
      expect(result).toEqual({
        name: 'John',
        age: 30,
        active: true,
      });
    });
  });

  describe('validateField', () => {
    it('should validate required fields', () => {
      expect(validateField(undefined, { required: true }, 'field')).toContain(
        'field is required'
      );
      expect(validateField(null, { required: true }, 'field')).toContain(
        'field is required'
      );
      expect(validateField('', { required: true }, 'field')).toContain(
        'field is required'
      );
    });

    it('should pass required validation when value exists', () => {
      expect(validateField('value', { required: true }, 'field')).toEqual([]);
    });

    it('should validate email type', () => {
      expect(validateField('invalid', { type: 'email' }, 'email')).toContain(
        'email must be a valid email'
      );
      expect(validateField('test@example.com', { type: 'email' }, 'email')).toEqual(
        []
      );
    });

    it('should validate URL type', () => {
      expect(validateField('invalid', { type: 'url' }, 'url')).toContain(
        'url must be a valid URL'
      );
      expect(validateField('http://example.com', { type: 'url' }, 'url')).toEqual(
        []
      );
    });

    it('should validate number type', () => {
      expect(validateField('not-a-number', { type: 'number' }, 'num')).toContain(
        'num must be a number'
      );
      expect(validateField('123', { type: 'number' }, 'num')).toEqual([]);
      expect(validateField(123, { type: 'number' }, 'num')).toEqual([]);
    });

    it('should validate minLength', () => {
      expect(validateField('ab', { minLength: 3 }, 'field')).toContain(
        'field must be at least 3 characters'
      );
      expect(validateField('abc', { minLength: 3 }, 'field')).toEqual([]);
    });

    it('should validate maxLength', () => {
      expect(validateField('abcdef', { maxLength: 3 }, 'field')).toContain(
        'field must be no more than 3 characters'
      );
      expect(validateField('abc', { maxLength: 3 }, 'field')).toEqual([]);
    });

    it('should validate min number', () => {
      expect(validateField(5, { min: 10 }, 'field')).toContain(
        'field must be at least 10'
      );
      expect(validateField(15, { min: 10 }, 'field')).toEqual([]);
    });

    it('should validate max number', () => {
      expect(validateField(15, { max: 10 }, 'field')).toContain(
        'field must be no more than 10'
      );
      expect(validateField(5, { max: 10 }, 'field')).toEqual([]);
    });

    it('should validate custom rules', () => {
      const isEven = (v: unknown) => typeof v === 'number' && v % 2 === 0;
      expect(validateField(3, { custom: isEven }, 'field')).toContain(
        'field failed custom validation'
      );
      expect(validateField(4, { custom: isEven }, 'field')).toEqual([]);
    });

    it('should use custom error messages', () => {
      expect(
        validateField('', { required: true, message: 'Custom error' }, 'field')
      ).toContain('Custom error');
    });
  });

  describe('validate', () => {
    it('should validate multiple fields', () => {
      const result = validate(
        { name: 'John', email: 'invalid' },
        {
          name: { required: true },
          email: { type: 'email' },
        }
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.email).toBeDefined();
      expect(result.sanitized.name).toBe('John');
    });

    it('should return isValid true when all valid', () => {
      const result = validate(
        { name: 'John', email: 'john@example.com' },
        {
          name: { required: true },
          email: { type: 'email' },
        }
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('should apply sanitization', () => {
      const result = validate(
        { name: '  John  ' },
        {
          name: { sanitize: { trim: true } },
        }
      );

      expect(result.sanitized.name).toBe('John');
    });

    it('should handle missing optional fields', () => {
      const result = validate(
        { name: 'John' },
        {
          name: { required: true },
          email: { type: 'email' }, // optional
        }
      );

      expect(result.isValid).toBe(true);
    });
  });
});
