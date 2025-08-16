/**
 * @file Tests for validation utilities
 * @description Comprehensive tests for NextRush v2 validation utilities
 * 
 * This test file covers:
 * - ValidationError class functionality
 * - Input validation functions
 * - Schema validation
 * - Sanitization utilities
 * - Edge cases and error handling
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  ValidationError,
  validateRequest,
  sanitizeInput,
  validateAndSanitize
} from '../../../utils/validation';

// Mock context type for testing
interface MockContext {
  body?: Record<string, unknown>;
  method: string;
  path: string;
  query: Record<string, unknown>;
  params: Record<string, unknown>;
  headers: Record<string, unknown>;
  cookies: Record<string, unknown>;
}

describe('Validation Utils', () => {
  describe('ValidationError', () => {
    it('should create a basic validation error', () => {
      const error = new ValidationError('Test error');
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Test error');
      expect(error.field).toBeUndefined();
      expect(error.value).toBeUndefined();
    });

    it('should create a validation error with field and value', () => {
      const error = new ValidationError('Test error', 'email', 'invalid-email');
      expect(error.field).toBe('email');
      expect(error.value).toBe('invalid-email');
    });

    it('should create validation error for specific field', () => {
      const error = ValidationError.forField('name', 'is required', '');
      expect(error.message).toBe('name: is required');
      expect(error.field).toBe('name');
      expect(error.value).toBe('');
    });

    it('should create validation error for multiple fields', () => {
      const errors = [
        { field: 'name', message: 'is required' },
        { field: 'email', message: 'must be valid' }
      ];
      const error = ValidationError.forFields(errors);
      expect(error.message).toBe('Validation failed');
      expect(error.errors).toEqual(errors);
    });
  });

  describe('validateRequest', () => {
    let mockContext: MockContext;

    beforeEach(() => {
      mockContext = {
        body: {},
        method: 'POST',
        path: '/test',
        query: {},
        params: {},
        headers: {},
        cookies: {}
      };
    });

    it('should validate required fields', () => {
      const schema = {
        name: { required: true }
      };

      expect(() => validateRequest(mockContext as any, schema)).toThrow(ValidationError);
    });

    it('should pass validation with valid required field', () => {
      mockContext.body = { name: 'John Doe' };
      const schema = {
        name: { required: true }
      };

      const result = validateRequest(mockContext as any, schema);
      expect(result).toEqual({ name: 'John Doe' });
    });

    it('should validate string type', () => {
      mockContext.body = { name: 123 };
      const schema = {
        name: { type: 'string' }
      };

      expect(() => validateRequest(mockContext as any, schema)).toThrow(ValidationError);
    });

    it('should validate number type', () => {
      mockContext.body = { age: '25' };
      const schema = {
        age: { type: 'number' }
      };

      expect(() => validateRequest(mockContext as any, schema)).toThrow(ValidationError);
    });

    it('should validate boolean type', () => {
      mockContext.body = { active: 'true' };
      const schema = {
        active: { type: 'boolean' }
      };

      expect(() => validateRequest(mockContext as any, schema)).toThrow(ValidationError);
    });

    it('should validate array type', () => {
      mockContext.body = { tags: 'tag1,tag2' };
      const schema = {
        tags: { type: 'array' }
      };

      expect(() => validateRequest(mockContext as any, schema)).toThrow(ValidationError);
    });

    it('should validate object type', () => {
      mockContext.body = { metadata: 'not an object' };
      const schema = {
        metadata: { type: 'object' }
      };

      expect(() => validateRequest(mockContext as any, schema)).toThrow(ValidationError);
    });

    it('should validate minimum length', () => {
      mockContext.body = { name: 'Jo' };
      const schema = {
        name: { type: 'string', minLength: 3 }
      };

      expect(() => validateRequest(mockContext as any, schema)).toThrow(ValidationError);
    });

    it('should validate maximum length', () => {
      mockContext.body = { name: 'John Doe Smith Johnson' };
      const schema = {
        name: { type: 'string', maxLength: 10 }
      };

      expect(() => validateRequest(mockContext as any, schema)).toThrow(ValidationError);
    });

    it('should validate minimum value', () => {
      mockContext.body = { age: 15 };
      const schema = {
        age: { type: 'number', min: 18 }
      };

      expect(() => validateRequest(mockContext as any, schema)).toThrow(ValidationError);
    });

    it('should validate maximum value', () => {
      mockContext.body = { age: 150 };
      const schema = {
        age: { type: 'number', max: 120 }
      };

      expect(() => validateRequest(mockContext as any, schema)).toThrow(ValidationError);
    });

    it('should validate pattern', () => {
      mockContext.body = { code: 'invalid' };
      const schema = {
        code: { type: 'string', pattern: '^[A-Z]{3}[0-9]{3}$' }
      };

      expect(() => validateRequest(mockContext as any, schema)).toThrow(ValidationError);
    });

    it('should validate enum values', () => {
      mockContext.body = { status: 'invalid' };
      const schema = {
        status: { enum: ['active', 'inactive', 'pending'] }
      };

      expect(() => validateRequest(mockContext as any, schema)).toThrow(ValidationError);
    });

    it('should validate email format', () => {
      mockContext.body = { email: 'invalid-email' };
      const schema = {
        email: { type: 'email' }
      };

      expect(() => validateRequest(mockContext as any, schema)).toThrow(ValidationError);
    });

    it('should validate URL format', () => {
      mockContext.body = { website: 'not-a-url' };
      const schema = {
        website: { type: 'url' }
      };

      expect(() => validateRequest(mockContext as any, schema)).toThrow(ValidationError);
    });

    it('should use custom validation function', () => {
      mockContext.body = { password: 'weak' };
      const schema = {
        password: {
          validate: (value: unknown) => {
            return typeof value === 'string' && value.length >= 8;
          }
        }
      };

      expect(() => validateRequest(mockContext as any, schema)).toThrow(ValidationError);
    });

    it('should handle custom validation function errors', () => {
      mockContext.body = { data: 'test' };
      const schema = {
        data: {
          validate: () => {
            throw new Error('Custom validation error');
          }
        }
      };

      expect(() => validateRequest(mockContext as any, schema)).toThrow(ValidationError);
    });

    it('should pass valid validation', () => {
      mockContext.body = { 
        name: 'John Doe',
        age: 25,
        email: 'john@example.com',
        active: true,
        tags: ['user', 'admin'],
        metadata: { role: 'admin' }
      };
      
      const schema = {
        name: { required: true, type: 'string', minLength: 2, maxLength: 50 },
        age: { type: 'number', min: 18, max: 100 },
        email: { type: 'email' },
        active: { type: 'boolean' },
        tags: { type: 'array' },
        metadata: { type: 'object' }
      };

      const result = validateRequest(mockContext as any, schema);
      expect(result).toEqual(mockContext.body);
    });
  });

  describe('sanitizeInput', () => {
    it('should sanitize string input', () => {
      const input = '  <script>alert("xss")</script>  ';
      const result = sanitizeInput(input);
      expect(result).toBe('scriptalert("xss")/script');
    });

    it('should remove javascript protocol', () => {
      const input = 'javascript:alert("xss")';
      const result = sanitizeInput(input);
      expect(result).toBe('alert("xss")');
    });

    it('should remove event handlers', () => {
      const input = 'onclick=alert("xss")';
      const result = sanitizeInput(input);
      expect(result).toBe('alert("xss")');
    });

    it('should sanitize array input', () => {
      const input = ['<script>', 'normal text', 'javascript:alert()'];
      const result = sanitizeInput(input);
      expect(result).toEqual(['script', 'normal text', 'alert()']);
    });

    it('should sanitize object input', () => {
      const input = {
        name: '  John  ',
        script: '<script>alert()</script>',
        nested: {
          value: 'javascript:void(0)'
        }
      };
      const result = sanitizeInput(input);
      expect(result).toEqual({
        name: 'John',
        script: 'scriptalert()/script',
        nested: {
          value: 'void(0)'
        }
      });
    });

    it('should handle null and undefined values', () => {
      expect(sanitizeInput(null)).toBeNull();
      expect(sanitizeInput(undefined)).toBeUndefined();
    });

    it('should handle primitive values', () => {
      expect(sanitizeInput(123)).toBe(123);
      expect(sanitizeInput(true)).toBe(true);
      expect(sanitizeInput(false)).toBe(false);
    });
  });

  describe('validateAndSanitize', () => {
    let mockContext: MockContext;

    beforeEach(() => {
      mockContext = {
        body: {
          name: '  <script>John</script>  ',
          email: 'john@example.com'
        },
        method: 'POST',
        path: '/test',
        query: {},
        params: {},
        headers: {},
        cookies: {}
      };
    });

    it('should validate and sanitize input', () => {
      const schema = {
        name: { required: true, type: 'string' },
        email: { required: true, type: 'email' }
      };

      const result = validateAndSanitize(mockContext as any, schema);
      expect(result).toEqual({
        name: 'scriptJohn/script',
        email: 'john@example.com'
      });
    });

    it('should throw validation error before sanitization', () => {
      mockContext.body = { name: 123 };
      const schema = {
        name: { required: true, type: 'string' }
      };

      expect(() => validateAndSanitize(mockContext as any, schema)).toThrow(ValidationError);
    });
  });

  describe('Module Exports', () => {
    it('should export all required functions and classes', async () => {
      const validation = await import('../../../utils/validation');
      
      expect(validation.ValidationError).toBeDefined();
      expect(validation.validateRequest).toBeDefined();
      expect(validation.sanitizeInput).toBeDefined();
      expect(validation.validateAndSanitize).toBeDefined();
    });

    it('should have correct function types', async () => {
      const validation = await import('../../../utils/validation');
      
      expect(typeof validation.ValidationError).toBe('function');
      expect(typeof validation.validateRequest).toBe('function');
      expect(typeof validation.sanitizeInput).toBe('function');
      expect(typeof validation.validateAndSanitize).toBe('function');
    });
  });
});
