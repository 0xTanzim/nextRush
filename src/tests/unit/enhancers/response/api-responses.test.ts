/**
 * API Responses Unit Tests
 */

import {
  sendBadRequest,
  sendCreated,
  sendError,
  sendForbidden,
  sendNoContent,
  sendNotFound,
  sendPaginated,
  sendSuccess,
  sendUnauthorized,
} from '@/core/enhancers/response/api-responses';
import type { ServerResponse } from 'node:http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('API Responses', () => {
  let mockRes: ServerResponse;
  let endData: string;

  beforeEach(() => {
    endData = '';
    mockRes = {
      statusCode: 200,
      headersSent: false,
      setHeader: vi.fn(),
      end: vi.fn((data: string) => {
        endData = data;
      }),
    } as unknown as ServerResponse;
  });

  describe('sendSuccess', () => {
    it('should send success response with data', () => {
      const data = { user: { id: 1, name: 'John' } };
      sendSuccess(mockRes, data, 'User retrieved');

      const response = JSON.parse(endData);
      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.message).toBe('User retrieved');
      expect(response.timestamp).toBeDefined();
    });

    it('should use default message when not provided', () => {
      sendSuccess(mockRes, { test: true });

      const response = JSON.parse(endData);
      expect(response.message).toBe('Success');
    });

    it('should set correct headers', () => {
      sendSuccess(mockRes, {});

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/json; charset=utf-8'
      );
    });
  });

  describe('sendError', () => {
    it('should send error response', () => {
      sendError(mockRes, 'Something went wrong', 500);

      expect(mockRes.statusCode).toBe(500);
      const response = JSON.parse(endData);
      expect(response.success).toBe(false);
      expect(response.error).toBe('Something went wrong');
    });

    it('should include error details when provided', () => {
      sendError(mockRes, 'Validation failed', 400, { field: 'email' });

      const response = JSON.parse(endData);
      expect(response.details).toEqual({ field: 'email' });
    });

    it('should default to 500 status', () => {
      sendError(mockRes, 'Error');

      expect(mockRes.statusCode).toBe(500);
    });
  });

  describe('sendPaginated', () => {
    it('should send paginated response', () => {
      const data = [{ id: 1 }, { id: 2 }];
      sendPaginated(mockRes, data, 1, 10, 100);

      const response = JSON.parse(endData);
      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 100,
        totalPages: 10,
        hasNext: true,
        hasPrev: false,
      });
    });

    it('should calculate hasNext correctly', () => {
      sendPaginated(mockRes, [], 10, 10, 100);

      const response = JSON.parse(endData);
      expect(response.pagination.hasNext).toBe(false);
      expect(response.pagination.hasPrev).toBe(true);
    });

    it('should handle single page', () => {
      sendPaginated(mockRes, [], 1, 10, 5);

      const response = JSON.parse(endData);
      expect(response.pagination.totalPages).toBe(1);
      expect(response.pagination.hasNext).toBe(false);
      expect(response.pagination.hasPrev).toBe(false);
    });
  });

  describe('sendNotFound', () => {
    it('should send 404 response', () => {
      sendNotFound(mockRes, 'User');

      expect(mockRes.statusCode).toBe(404);
      const response = JSON.parse(endData);
      expect(response.error).toBe('User not found');
    });

    it('should use default resource name', () => {
      sendNotFound(mockRes);

      const response = JSON.parse(endData);
      expect(response.error).toBe('Resource not found');
    });
  });

  describe('sendUnauthorized', () => {
    it('should send 401 response', () => {
      sendUnauthorized(mockRes);

      expect(mockRes.statusCode).toBe(401);
      const response = JSON.parse(endData);
      expect(response.error).toBe('Unauthorized');
    });

    it('should use custom message', () => {
      sendUnauthorized(mockRes, 'Invalid token');

      const response = JSON.parse(endData);
      expect(response.error).toBe('Invalid token');
    });
  });

  describe('sendForbidden', () => {
    it('should send 403 response', () => {
      sendForbidden(mockRes);

      expect(mockRes.statusCode).toBe(403);
      const response = JSON.parse(endData);
      expect(response.error).toBe('Forbidden');
    });
  });

  describe('sendBadRequest', () => {
    it('should send 400 response', () => {
      sendBadRequest(mockRes, 'Invalid input', { field: 'email' });

      expect(mockRes.statusCode).toBe(400);
      const response = JSON.parse(endData);
      expect(response.error).toBe('Invalid input');
      expect(response.details).toEqual({ field: 'email' });
    });
  });

  describe('sendCreated', () => {
    it('should send 201 response', () => {
      const data = { id: 1, name: 'New User' };
      sendCreated(mockRes, data);

      expect(mockRes.statusCode).toBe(201);
      const response = JSON.parse(endData);
      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
    });
  });

  describe('sendNoContent', () => {
    it('should send 204 response', () => {
      sendNoContent(mockRes);

      expect(mockRes.statusCode).toBe(204);
      expect(mockRes.end).toHaveBeenCalled();
    });
  });
});
