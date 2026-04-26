/**
 * @nextrush/errors - Base Error Tests
 */

import { describe, expect, it } from 'vitest';
import { HttpError, NextRushError } from '../base';

describe('NextRushError', () => {
  describe('constructor', () => {
    it('should create error with message', () => {
      const error = new NextRushError('Something went wrong');
      expect(error.message).toBe('Something went wrong');
      expect(error.name).toBe('NextRushError');
    });

    it('should set default values', () => {
      const error = new NextRushError('Test');
      expect(error.status).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.expose).toBe(false);
      expect(error.details).toBeUndefined();
      expect(error.cause).toBeUndefined();
    });

    it('should accept custom status', () => {
      const error = new NextRushError('Bad request', { status: 400 });
      expect(error.status).toBe(400);
      expect(error.expose).toBe(true); // 4xx errors are exposed by default
    });

    it('should accept custom code', () => {
      const error = new NextRushError('Custom error', { code: 'CUSTOM_CODE' });
      expect(error.code).toBe('CUSTOM_CODE');
    });

    it('should accept custom expose flag', () => {
      const error = new NextRushError('Server error', { status: 500, expose: true });
      expect(error.expose).toBe(true);
    });

    it('should accept details', () => {
      const details = { field: 'email', constraint: 'unique' };
      const error = new NextRushError('Validation failed', { details });
      expect(error.details).toEqual(details);
    });

    it('should accept cause', () => {
      const cause = new Error('Original error');
      const error = new NextRushError('Wrapped error', { cause });
      expect(error.cause).toBe(cause);
    });

    it('should set expose true for 4xx errors by default', () => {
      const error400 = new NextRushError('Bad request', { status: 400 });
      const error404 = new NextRushError('Not found', { status: 404 });
      const error499 = new NextRushError('Client error', { status: 499 });

      expect(error400.expose).toBe(true);
      expect(error404.expose).toBe(true);
      expect(error499.expose).toBe(true);
    });

    it('should set expose false for 5xx errors by default', () => {
      const error500 = new NextRushError('Server error', { status: 500 });
      const error503 = new NextRushError('Unavailable', { status: 503 });

      expect(error500.expose).toBe(false);
      expect(error503.expose).toBe(false);
    });

    it('should be instanceof Error', () => {
      const error = new NextRushError('Test');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(NextRushError);
    });

    it('should have proper stack trace', () => {
      const error = new NextRushError('Test');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('NextRushError');
    });
  });

  describe('toJSON', () => {
    it('should return JSON representation', () => {
      const error = new NextRushError('Bad request', { status: 400, code: 'BAD_REQUEST' });
      const json = error.toJSON();

      expect(json).toEqual({
        error: 'NextRushError',
        message: 'Bad request',
        code: 'BAD_REQUEST',
        status: 400,
      });
    });

    it('should hide message for non-exposed errors', () => {
      const error = new NextRushError('Secret error', { status: 500, expose: false });
      const json = error.toJSON();

      expect(json.message).toBe('Internal Server Error');
    });

    it('should include details when exposed', () => {
      const error = new NextRushError('Error', {
        status: 400,
        expose: true,
        details: { field: 'email' },
      });
      const json = error.toJSON();

      expect(json.details).toEqual({ field: 'email' });
    });

    it('should not include details when not exposed', () => {
      const error = new NextRushError('Error', {
        status: 500,
        expose: false,
        details: { sensitive: 'data' },
      });
      const json = error.toJSON();

      expect(json.details).toBeUndefined();
    });
  });

  describe('toResponse', () => {
    it('should return response object', () => {
      const error = new NextRushError('Not found', { status: 404, code: 'NOT_FOUND' });
      const response = error.toResponse();

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Not found');
      expect(response.body.code).toBe('NOT_FOUND');
    });
  });
});

describe('HttpError', () => {
  describe('constructor', () => {
    it('should create error with status and message', () => {
      const error = new HttpError(404, 'Resource not found');
      expect(error.status).toBe(404);
      expect(error.message).toBe('Resource not found');
      expect(error.name).toBe('HttpError');
    });

    it('should set default code based on status', () => {
      const error = new HttpError(404, 'Not found');
      expect(error.code).toBe('HTTP_404');
    });

    it('should accept custom code', () => {
      const error = new HttpError(404, 'Not found', { code: 'RESOURCE_NOT_FOUND' });
      expect(error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('should accept options', () => {
      const cause = new Error('Original');
      const error = new HttpError(400, 'Bad request', {
        code: 'VALIDATION_FAILED',
        expose: true,
        details: { field: 'name' },
        cause,
      });

      expect(error.code).toBe('VALIDATION_FAILED');
      expect(error.expose).toBe(true);
      expect(error.details).toEqual({ field: 'name' });
      expect(error.cause).toBe(cause);
    });

    it('should be instanceof NextRushError', () => {
      const error = new HttpError(500, 'Error');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(NextRushError);
      expect(error).toBeInstanceOf(HttpError);
    });
  });
});
