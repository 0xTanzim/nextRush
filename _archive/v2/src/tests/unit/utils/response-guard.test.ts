/**
 * Tests for Response Guard Utility
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canSetHeaders,
  canWriteResponse,
  createGuardedMethod,
  getResponseState,
  guardedSetHeader,
  guardedWrite,
  ResponseGuard,
} from '../../../core/utils/response-guard';

describe('Response Guard', () => {
  let mockResponse: any;

  beforeEach(() => {
    mockResponse = {
      headersSent: false,
      writableEnded: false,
      destroyed: false,
      writable: true,
      statusCode: 200,
      setHeader: vi.fn(),
      end: vi.fn(),
      write: vi.fn(),
    };
  });

  describe('canWriteResponse', () => {
    it('should return true for fresh response', () => {
      expect(canWriteResponse(mockResponse)).toBe(true);
    });

    it('should return false when headers sent', () => {
      mockResponse.headersSent = true;
      expect(canWriteResponse(mockResponse)).toBe(false);
    });

    it('should return false when writable ended', () => {
      mockResponse.writableEnded = true;
      expect(canWriteResponse(mockResponse)).toBe(false);
    });

    it('should return false when destroyed', () => {
      mockResponse.destroyed = true;
      expect(canWriteResponse(mockResponse)).toBe(false);
    });
  });

  describe('canSetHeaders', () => {
    it('should return true when headers not sent', () => {
      expect(canSetHeaders(mockResponse)).toBe(true);
    });

    it('should return false when headers sent', () => {
      mockResponse.headersSent = true;
      expect(canSetHeaders(mockResponse)).toBe(false);
    });
  });

  describe('getResponseState', () => {
    it('should return correct state object', () => {
      const state = getResponseState(mockResponse);

      expect(state.headersSent).toBe(false);
      expect(state.finished).toBe(false);
      expect(state.destroyed).toBe(false);
      expect(state.writable).toBe(true);
    });

    it('should reflect changed state', () => {
      mockResponse.headersSent = true;
      mockResponse.destroyed = true;

      const state = getResponseState(mockResponse);

      expect(state.headersSent).toBe(true);
      expect(state.destroyed).toBe(true);
      expect(state.writable).toBe(false);
    });
  });

  describe('guardedWrite', () => {
    it('should execute callback when response is writable', () => {
      const callback = vi.fn();
      const result = guardedWrite(mockResponse, callback);

      expect(result).toBe(true);
      expect(callback).toHaveBeenCalled();
    });

    it('should not execute callback when response is not writable', () => {
      mockResponse.headersSent = true;
      const callback = vi.fn();
      const result = guardedWrite(mockResponse, callback);

      expect(result).toBe(false);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('guardedSetHeader', () => {
    it('should execute callback when headers can be set', () => {
      const callback = vi.fn();
      const result = guardedSetHeader(mockResponse, callback);

      expect(result).toBe(true);
      expect(callback).toHaveBeenCalled();
    });

    it('should not execute callback when headers already sent', () => {
      mockResponse.headersSent = true;
      const callback = vi.fn();
      const result = guardedSetHeader(mockResponse, callback);

      expect(result).toBe(false);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('createGuardedMethod', () => {
    it('should create a guarded method that executes when writable', () => {
      const fn = vi.fn((arg1: string, arg2: string) => 'result');
      const guarded = createGuardedMethod(mockResponse, fn);

      const result = guarded('arg1', 'arg2');

      expect(result).toBe('result');
      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should create a guarded method that skips when not writable', () => {
      mockResponse.headersSent = true;
      const fn = vi.fn((arg1: string) => 'result');
      const guarded = createGuardedMethod(mockResponse, fn);

      const result = guarded('arg1');

      expect(result).toBeUndefined();
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('ResponseGuard utilities', () => {
    describe('end', () => {
      it('should end response when writable', () => {
        ResponseGuard.end(mockResponse, 'data');
        expect(mockResponse.end).toHaveBeenCalledWith('data');
      });

      it('should not end response when not writable', () => {
        mockResponse.headersSent = true;
        ResponseGuard.end(mockResponse, 'data');
        expect(mockResponse.end).not.toHaveBeenCalled();
      });
    });

    describe('status', () => {
      it('should set status code when headers not sent', () => {
        ResponseGuard.status(mockResponse, 404);
        expect(mockResponse.statusCode).toBe(404);
      });

      it('should not set status code when headers sent', () => {
        mockResponse.headersSent = true;
        ResponseGuard.status(mockResponse, 404);
        expect(mockResponse.statusCode).toBe(200);
      });
    });

    describe('json', () => {
      it('should send JSON response when writable', () => {
        ResponseGuard.json(mockResponse, { message: 'test' }, 201);

        expect(mockResponse.statusCode).toBe(201);
        expect(mockResponse.setHeader).toHaveBeenCalledWith(
          'Content-Type',
          'application/json; charset=utf-8'
        );
        expect(mockResponse.end).toHaveBeenCalledWith('{"message":"test"}');
      });

      it('should use default status code', () => {
        ResponseGuard.json(mockResponse, { ok: true });
        expect(mockResponse.statusCode).toBe(200);
      });
    });

    describe('text', () => {
      it('should send text response', () => {
        ResponseGuard.text(mockResponse, 'Hello World');

        expect(mockResponse.setHeader).toHaveBeenCalledWith(
          'Content-Type',
          'text/plain; charset=utf-8'
        );
        expect(mockResponse.end).toHaveBeenCalledWith('Hello World');
      });
    });

    describe('html', () => {
      it('should send HTML response', () => {
        ResponseGuard.html(mockResponse, '<h1>Hello</h1>');

        expect(mockResponse.setHeader).toHaveBeenCalledWith(
          'Content-Type',
          'text/html; charset=utf-8'
        );
        expect(mockResponse.end).toHaveBeenCalledWith('<h1>Hello</h1>');
      });
    });

    describe('redirect', () => {
      it('should redirect with default status', () => {
        ResponseGuard.redirect(mockResponse, '/new-url');

        expect(mockResponse.statusCode).toBe(302);
        expect(mockResponse.setHeader).toHaveBeenCalledWith('Location', '/new-url');
        expect(mockResponse.end).toHaveBeenCalled();
      });

      it('should redirect with custom status', () => {
        ResponseGuard.redirect(mockResponse, '/permanent', 301);

        expect(mockResponse.statusCode).toBe(301);
        expect(mockResponse.setHeader).toHaveBeenCalledWith('Location', '/permanent');
      });
    });
  });
});
