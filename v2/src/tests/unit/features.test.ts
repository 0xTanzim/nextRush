/**
 * Unit tests for NextRush v2 features
 *
 * @packageDocumentation
 */

import {
  AuthenticationError,
  AuthenticationExceptionFilter,
  AuthorizationError,
  BadRequestError,
  ConflictError,
  ErrorFactory,
  GlobalExceptionFilter,
  NextRushError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  ValidationExceptionFilter,
} from '@/errors/custom-errors';
import { createApp } from '@/index';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('NextRush v2 Features Unit Tests', () => {
  let app: any;

  beforeEach(() => {
    app = createApp();
  });

  describe('Smart Body Parser', () => {
    it('should create smart body parser middleware', () => {
      const middleware = app.smartBodyParser();
      expect(typeof middleware).toBe('function');
    });

    it('should create smart body parser with options', () => {
      const middleware = app.smartBodyParser({
        json: { limit: '10mb' },
        urlencoded: { extended: true },
        text: { limit: '1mb' },
      });
      expect(typeof middleware).toBe('function');
    });
  });

  describe('Exception Filter', () => {
    it('should create exception filter middleware', () => {
      const middleware = app.exceptionFilter();
      expect(typeof middleware).toBe('function');
    });

    it('should create exception filter with custom filters', () => {
      const middleware = app.exceptionFilter([
        new ValidationExceptionFilter(),
        new AuthenticationExceptionFilter(),
        new GlobalExceptionFilter(),
      ]);
      expect(typeof middleware).toBe('function');
    });
  });

  describe('Custom Error Classes', () => {
    it('should create BadRequestError', () => {
      const error = new BadRequestError('Invalid request');
      expect(error).toBeInstanceOf(BadRequestError);
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.message).toBe('Invalid request');
    });

    it('should create NotFoundError', () => {
      const error = new NotFoundError('Resource not found');
      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe('Resource not found');
    });

    it('should create ValidationError', () => {
      const error = new ValidationError(
        'Invalid field',
        'email',
        'invalid-email'
      );
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.field).toBe('email');
      expect(error.value).toBe('invalid-email');
    });

    it('should create AuthenticationError', () => {
      const error = new AuthenticationError('Token expired');
      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('AUTHENTICATION_ERROR');
      expect(error.message).toBe('Token expired');
    });

    it('should create AuthorizationError', () => {
      const error = new AuthorizationError('Insufficient permissions');
      expect(error).toBeInstanceOf(AuthorizationError);
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('AUTHORIZATION_ERROR');
      expect(error.message).toBe('Insufficient permissions');
    });

    it('should create ConflictError', () => {
      const error = new ConflictError('Resource conflict');
      expect(error).toBeInstanceOf(ConflictError);
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
      expect(error.message).toBe('Resource conflict');
    });

    it('should create RateLimitError', () => {
      const error = new RateLimitError('Too many requests', 60);
      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMIT_ERROR');
      expect(error.message).toBe('Too many requests');
      expect(error.retryAfter).toBe(60);
    });
  });

  describe('Error Factory', () => {
    it('should create validation errors', () => {
      const error = ErrorFactory.validation(
        'email',
        'Invalid email format',
        'invalid-email'
      );
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.field).toBe('email');
      expect(error.value).toBe('invalid-email');
      expect(error.statusCode).toBe(400);
    });

    it('should create not found errors', () => {
      const error = ErrorFactory.notFound('User');
      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.message).toBe('User not found');
      expect(error.statusCode).toBe(404);
    });

    it('should create authentication errors', () => {
      const error = ErrorFactory.unauthorized('Token expired');
      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.message).toBe('Token expired');
      expect(error.statusCode).toBe(401);
    });

    it('should create authorization errors', () => {
      const error = ErrorFactory.forbidden('Admin access required');
      expect(error).toBeInstanceOf(AuthorizationError);
      expect(error.message).toBe('Admin access required');
      expect(error.statusCode).toBe(403);
    });

    it('should create bad request errors', () => {
      const error = ErrorFactory.badRequest('Invalid parameters');
      expect(error).toBeInstanceOf(BadRequestError);
      expect(error.message).toBe('Invalid parameters');
      expect(error.statusCode).toBe(400);
    });

    it('should create conflict errors', () => {
      const error = ErrorFactory.conflict('Email already exists');
      expect(error).toBeInstanceOf(ConflictError);
      expect(error.message).toBe('Email already exists');
      expect(error.statusCode).toBe(409);
    });

    it('should create rate limit errors', () => {
      const error = ErrorFactory.rateLimit('Too many requests', 60);
      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.message).toBe('Too many requests');
      expect(error.statusCode).toBe(429);
      expect(error.retryAfter).toBe(60);
    });
  });

  describe('Exception Filters', () => {
    it('should create GlobalExceptionFilter', () => {
      const filter = new GlobalExceptionFilter();
      expect(filter).toBeInstanceOf(GlobalExceptionFilter);
    });

    it('should create ValidationExceptionFilter', () => {
      const filter = new ValidationExceptionFilter();
      expect(filter).toBeInstanceOf(ValidationExceptionFilter);
    });

    it('should create AuthenticationExceptionFilter', () => {
      const filter = new AuthenticationExceptionFilter();
      expect(filter).toBeInstanceOf(AuthenticationExceptionFilter);
    });

    it('should handle errors in GlobalExceptionFilter', async () => {
      const filter = new GlobalExceptionFilter();
      const mockCtx = {
        status: 200,
        res: {
          json: vi.fn(),
        },
        path: '/test',
        method: 'GET',
        id: 'test-id',
      } as any;

      const error = new BadRequestError('Test error');
      await filter.catch(error, mockCtx);

      expect(mockCtx.status).toBe(400);
      expect(mockCtx.res.json).toHaveBeenCalledWith({
        error: {
          name: 'BadRequestError',
          message: 'Test error',
          code: 'BAD_REQUEST',
          statusCode: 400,
          timestamp: expect.any(String),
          path: '/test',
          method: 'GET',
          requestId: 'test-id',
        },
      });
    });

    it('should handle ValidationError in ValidationExceptionFilter', async () => {
      const filter = new ValidationExceptionFilter();
      const mockCtx = {
        status: 200,
        res: {
          json: vi.fn(),
        },
      } as any;

      const error = new ValidationError(
        'Invalid field',
        'email',
        'invalid-email'
      );
      await filter.catch(error, mockCtx);

      expect(mockCtx.status).toBe(400);
      expect(mockCtx.res.json).toHaveBeenCalledWith({
        error: {
          name: 'ValidationError',
          message: 'Invalid field',
          code: 'VALIDATION_ERROR',
          statusCode: 400,
          timestamp: expect.any(String),
          field: 'email',
          value: 'invalid-email',
        },
      });
    });

    it('should handle AuthenticationError in AuthenticationExceptionFilter', async () => {
      const filter = new AuthenticationExceptionFilter();
      const mockCtx = {
        status: 200,
        res: {
          json: vi.fn(),
        },
      } as any;

      const error = new AuthenticationError('Token expired');
      await filter.catch(error, mockCtx);

      expect(mockCtx.status).toBe(401);
      expect(mockCtx.res.json).toHaveBeenCalledWith({
        error: {
          name: 'AuthenticationError',
          message: 'Token expired',
          code: 'AUTHENTICATION_ERROR',
          statusCode: 401,
          timestamp: expect.any(String),
        },
      });
    });
  });

  describe('Error toJSON', () => {
    it('should convert error to JSON', () => {
      const error = new BadRequestError('Test error');
      const json = error.toJSON();

      expect(json).toEqual({
        name: 'NextRushError',
        message: 'Test error',
        statusCode: 400,
        code: 'BAD_REQUEST',
        timestamp: expect.any(String),
        stack: expect.any(String),
      });
    });
  });

  describe('Error fromStatusCode', () => {
    it('should create error from status code', () => {
      const error = NextRushError.fromStatusCode(404, 'Custom message');
      expect(error).toBeInstanceOf(NextRushError);
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Custom message');
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should use default message when not provided', () => {
      const error = NextRushError.fromStatusCode(500);
      expect(error).toBeInstanceOf(NextRushError);
      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('Internal Server Error');
      expect(error.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });
});
