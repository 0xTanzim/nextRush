/**
 * Error Factory Test Suite
 * Tests for creating common HTTP errors
 */

import { describe, expect, it } from 'vitest';

import {
  AuthenticationError,
  AuthorizationError,
  BadRequestError,
  ConflictError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from '@/errors/custom-errors';
import { ErrorFactory } from '@/errors/error-factory';

describe('ErrorFactory', () => {
  describe('validation', () => {
    it('should create a ValidationError with field and message', () => {
      const error = ErrorFactory.validation('email', 'Invalid email format');

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Invalid email format');
      expect(error.field).toBe('email');
      expect(error.name).toBe('NextRushError');
    });

    it('should create a ValidationError with value', () => {
      const invalidValue = 'not-an-email';
      const error = ErrorFactory.validation(
        'email',
        'Invalid email format',
        invalidValue
      );

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Invalid email format');
      expect(error.field).toBe('email');
      expect(error.value).toBe(invalidValue);
    });

    it('should handle undefined value', () => {
      const error = ErrorFactory.validation('name', 'Name is required');

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Name is required');
      expect(error.field).toBe('name');
      expect(error.value).toBeUndefined();
    });
  });

  describe('notFound', () => {
    it('should create a NotFoundError for a resource', () => {
      const error = ErrorFactory.notFound('User');

      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.message).toBe('User not found');
      expect(error.name).toBe('NextRushError');
    });

    it('should create a NotFoundError with resource name', () => {
      const error = ErrorFactory.notFound('User with ID 123');

      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.message).toBe('User with ID 123 not found');
    });

    it('should handle empty resource name', () => {
      const error = ErrorFactory.notFound('');

      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.message).toBe(' not found');
    });
  });

  describe('unauthorized', () => {
    it('should create an AuthenticationError with message', () => {
      const error = ErrorFactory.unauthorized('Authentication required');

      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.message).toBe('Authentication required');
      expect(error.name).toBe('NextRushError');
    });

    it('should create an AuthenticationError with custom message', () => {
      const error = ErrorFactory.unauthorized('Invalid token');

      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.message).toBe('Invalid token');
    });
  });

  describe('forbidden', () => {
    it('should create an AuthorizationError with message', () => {
      const error = ErrorFactory.forbidden('Insufficient permissions');

      expect(error).toBeInstanceOf(AuthorizationError);
      expect(error.message).toBe('Insufficient permissions');
      expect(error.name).toBe('NextRushError');
    });

    it('should create an AuthorizationError with custom message', () => {
      const error = ErrorFactory.forbidden('Cannot access admin panel');

      expect(error).toBeInstanceOf(AuthorizationError);
      expect(error.message).toBe('Cannot access admin panel');
    });
  });

  describe('badRequest', () => {
    it('should create a BadRequestError with message', () => {
      const error = ErrorFactory.badRequest('Bad Request');

      expect(error).toBeInstanceOf(BadRequestError);
      expect(error.message).toBe('Bad Request');
      expect(error.name).toBe('NextRushError');
    });

    it('should create a BadRequestError with custom message', () => {
      const error = ErrorFactory.badRequest('Invalid parameter type');

      expect(error).toBeInstanceOf(BadRequestError);
      expect(error.message).toBe('Invalid parameter type');
    });
  });

  describe('conflict', () => {
    it('should create a ConflictError with message', () => {
      const error = ErrorFactory.conflict('User email already exists');

      expect(error).toBeInstanceOf(ConflictError);
      expect(error.message).toBe('User email already exists');
      expect(error.name).toBe('NextRushError');
    });

    it('should create a ConflictError with custom message', () => {
      const error = ErrorFactory.conflict('Email already registered');

      expect(error).toBeInstanceOf(ConflictError);
      expect(error.message).toBe('Email already registered');
    });
  });

  describe('rateLimit', () => {
    it('should create a RateLimitError with message', () => {
      const error = ErrorFactory.rateLimit('Too many requests');

      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.message).toBe('Too many requests');
      expect(error.name).toBe('NextRushError');
    });

    it('should create a RateLimitError with retry info', () => {
      const retryAfter = 60;
      const error = ErrorFactory.rateLimit('Too many requests', retryAfter);

      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.message).toBe('Too many requests');
      expect(error.retryAfter).toBe(retryAfter);
    });

    it('should create a RateLimitError with custom message and retry info', () => {
      const error = ErrorFactory.rateLimit('API quota exceeded', 30);

      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.message).toBe('API quota exceeded');
      expect(error.retryAfter).toBe(30);
    });
  });

  describe('error consistency', () => {
    it('should create errors with consistent naming', () => {
      const errors = [
        ErrorFactory.validation('field', 'message'),
        ErrorFactory.notFound('Resource'),
        ErrorFactory.unauthorized('message'),
        ErrorFactory.forbidden('message'),
        ErrorFactory.badRequest('message'),
        ErrorFactory.conflict('message'),
        ErrorFactory.rateLimit('message'),
      ];

      // All errors should have NextRushError as the base name
      errors.forEach(error => {
        expect(error.name).toBe('NextRushError');
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBeTruthy();
      });
    });

    it('should create errors that can be serialized', () => {
      const error = ErrorFactory.validation('email', 'Invalid email');

      const serialized = JSON.stringify(error);
      const parsed = JSON.parse(serialized);

      expect(parsed.message).toBe('Invalid email');
      expect(parsed.name).toBe('NextRushError');
    });

    it('should create errors with proper inheritance', () => {
      const validationError = ErrorFactory.validation('field', 'message');
      const notFoundError = ErrorFactory.notFound('Resource');
      const authError = ErrorFactory.unauthorized('message');

      expect(validationError instanceof Error).toBe(true);
      expect(notFoundError instanceof Error).toBe(true);
      expect(authError instanceof Error).toBe(true);
    });
  });

  describe('factory pattern', () => {
    it('should provide static factory methods', () => {
      expect(typeof ErrorFactory.validation).toBe('function');
      expect(typeof ErrorFactory.notFound).toBe('function');
      expect(typeof ErrorFactory.unauthorized).toBe('function');
      expect(typeof ErrorFactory.forbidden).toBe('function');
      expect(typeof ErrorFactory.badRequest).toBe('function');
      expect(typeof ErrorFactory.conflict).toBe('function');
      expect(typeof ErrorFactory.rateLimit).toBe('function');
    });

    it('should not require instantiation', () => {
      // Should be able to use static methods without new
      const error = ErrorFactory.validation('field', 'message');
      expect(error).toBeInstanceOf(ValidationError);
    });
  });
});
