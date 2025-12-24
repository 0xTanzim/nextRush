/**
 * @nextrush/errors - Factory Function Tests
 */

import { describe, expect, it } from 'vitest';
import { HttpError } from '../base';
import {
    badGateway,
    badRequest,
    conflict,
    createError,
    forbidden,
    gatewayTimeout,
    getErrorStatus,
    getSafeErrorMessage,
    internalError,
    isHttpError,
    methodNotAllowed,
    notFound,
    serviceUnavailable,
    tooManyRequests,
    unauthorized,
    unprocessableEntity,
} from '../factory';
import {
    BadGatewayError,
    BadRequestError,
    ConflictError,
    ForbiddenError,
    GatewayTimeoutError,
    InternalServerError,
    MethodNotAllowedError,
    NotFoundError,
    ServiceUnavailableError,
    TooManyRequestsError,
    UnauthorizedError,
    UnprocessableEntityError,
} from '../http-errors';

describe('createError', () => {
  it('should create BadRequestError for 400', () => {
    const error = createError(400);
    expect(error).toBeInstanceOf(BadRequestError);
    expect(error.status).toBe(400);
  });

  it('should create UnauthorizedError for 401', () => {
    const error = createError(401);
    expect(error).toBeInstanceOf(UnauthorizedError);
  });

  it('should create ForbiddenError for 403', () => {
    const error = createError(403);
    expect(error).toBeInstanceOf(ForbiddenError);
  });

  it('should create NotFoundError for 404', () => {
    const error = createError(404, 'Resource not found');
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.message).toBe('Resource not found');
  });

  it('should create ConflictError for 409', () => {
    const error = createError(409);
    expect(error).toBeInstanceOf(ConflictError);
  });

  it('should create UnprocessableEntityError for 422', () => {
    const error = createError(422);
    expect(error).toBeInstanceOf(UnprocessableEntityError);
  });

  it('should create InternalServerError for 500', () => {
    const error = createError(500);
    expect(error).toBeInstanceOf(InternalServerError);
  });

  it('should create BadGatewayError for 502', () => {
    const error = createError(502);
    expect(error).toBeInstanceOf(BadGatewayError);
  });

  it('should create GatewayTimeoutError for 504', () => {
    const error = createError(504);
    expect(error).toBeInstanceOf(GatewayTimeoutError);
  });

  it('should create generic HttpError for unmapped status', () => {
    const error = createError(418);
    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(418);
    expect(error.message).toBe('HTTP Error 418');
  });

  it('should pass options to error', () => {
    const error = createError(400, 'Custom message', { details: { field: 'name' } });
    expect(error.message).toBe('Custom message');
    expect(error.details).toEqual({ field: 'name' });
  });
});

describe('Factory functions', () => {
  describe('badRequest', () => {
    it('should create BadRequestError', () => {
      const error = badRequest();
      expect(error).toBeInstanceOf(BadRequestError);
      expect(error.status).toBe(400);
    });

    it('should accept message', () => {
      const error = badRequest('Invalid input');
      expect(error.message).toBe('Invalid input');
    });

    it('should accept options', () => {
      const error = badRequest('Error', { details: { field: 'email' } });
      expect(error.details).toEqual({ field: 'email' });
    });
  });

  describe('unauthorized', () => {
    it('should create UnauthorizedError', () => {
      const error = unauthorized();
      expect(error).toBeInstanceOf(UnauthorizedError);
      expect(error.status).toBe(401);
    });

    it('should accept message', () => {
      const error = unauthorized('Token expired');
      expect(error.message).toBe('Token expired');
    });
  });

  describe('forbidden', () => {
    it('should create ForbiddenError', () => {
      const error = forbidden();
      expect(error).toBeInstanceOf(ForbiddenError);
      expect(error.status).toBe(403);
    });

    it('should accept message', () => {
      const error = forbidden('Access denied');
      expect(error.message).toBe('Access denied');
    });
  });

  describe('notFound', () => {
    it('should create NotFoundError', () => {
      const error = notFound();
      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.status).toBe(404);
    });

    it('should accept message', () => {
      const error = notFound('User not found');
      expect(error.message).toBe('User not found');
    });
  });

  describe('methodNotAllowed', () => {
    it('should create MethodNotAllowedError', () => {
      const error = methodNotAllowed(['GET', 'POST']);
      expect(error).toBeInstanceOf(MethodNotAllowedError);
      expect(error.status).toBe(405);
      expect(error.allowedMethods).toEqual(['GET', 'POST']);
    });

    it('should accept message', () => {
      const error = methodNotAllowed(['GET'], 'Only GET allowed');
      expect(error.message).toBe('Only GET allowed');
    });
  });

  describe('conflict', () => {
    it('should create ConflictError', () => {
      const error = conflict();
      expect(error).toBeInstanceOf(ConflictError);
      expect(error.status).toBe(409);
    });

    it('should accept message', () => {
      const error = conflict('Resource already exists');
      expect(error.message).toBe('Resource already exists');
    });
  });

  describe('unprocessableEntity', () => {
    it('should create UnprocessableEntityError', () => {
      const error = unprocessableEntity();
      expect(error).toBeInstanceOf(UnprocessableEntityError);
      expect(error.status).toBe(422);
    });
  });

  describe('tooManyRequests', () => {
    it('should create TooManyRequestsError', () => {
      const error = tooManyRequests();
      expect(error).toBeInstanceOf(TooManyRequestsError);
      expect(error.status).toBe(429);
    });

    it('should accept retryAfter', () => {
      const error = tooManyRequests('Rate limited', { retryAfter: 60 });
      expect(error.retryAfter).toBe(60);
    });
  });

  describe('internalError', () => {
    it('should create InternalServerError', () => {
      const error = internalError();
      expect(error).toBeInstanceOf(InternalServerError);
      expect(error.status).toBe(500);
    });

    it('should accept message', () => {
      const error = internalError('Database error');
      expect(error.message).toBe('Database error');
    });
  });

  describe('badGateway', () => {
    it('should create BadGatewayError', () => {
      const error = badGateway();
      expect(error).toBeInstanceOf(BadGatewayError);
      expect(error.status).toBe(502);
    });
  });

  describe('serviceUnavailable', () => {
    it('should create ServiceUnavailableError', () => {
      const error = serviceUnavailable();
      expect(error).toBeInstanceOf(ServiceUnavailableError);
      expect(error.status).toBe(503);
    });

    it('should accept retryAfter', () => {
      const error = serviceUnavailable('Maintenance', { retryAfter: 3600 });
      expect(error.retryAfter).toBe(3600);
    });
  });

  describe('gatewayTimeout', () => {
    it('should create GatewayTimeoutError', () => {
      const error = gatewayTimeout();
      expect(error).toBeInstanceOf(GatewayTimeoutError);
      expect(error.status).toBe(504);
    });
  });
});

describe('isHttpError', () => {
  it('should return true for HttpError', () => {
    expect(isHttpError(new HttpError(500, 'Error'))).toBe(true);
  });

  it('should return true for subclasses', () => {
    expect(isHttpError(new BadRequestError())).toBe(true);
    expect(isHttpError(new NotFoundError())).toBe(true);
    expect(isHttpError(new InternalServerError())).toBe(true);
  });

  it('should return false for regular Error', () => {
    expect(isHttpError(new Error('Regular error'))).toBe(false);
  });

  it('should return false for non-errors', () => {
    expect(isHttpError('string')).toBe(false);
    expect(isHttpError(123)).toBe(false);
    expect(isHttpError(null)).toBe(false);
    expect(isHttpError(undefined)).toBe(false);
    expect(isHttpError({})).toBe(false);
  });
});

describe('getErrorStatus', () => {
  it('should return status from HttpError', () => {
    expect(getErrorStatus(new BadRequestError())).toBe(400);
    expect(getErrorStatus(new NotFoundError())).toBe(404);
    expect(getErrorStatus(new InternalServerError())).toBe(500);
  });

  it('should return 500 for regular Error', () => {
    expect(getErrorStatus(new Error('Test'))).toBe(500);
  });

  it('should return 500 for non-errors', () => {
    expect(getErrorStatus('string')).toBe(500);
    expect(getErrorStatus(null)).toBe(500);
    expect(getErrorStatus(undefined)).toBe(500);
  });
});

describe('getSafeErrorMessage', () => {
  it('should return message for exposed errors', () => {
    expect(getSafeErrorMessage(new BadRequestError('Invalid input'))).toBe('Invalid input');
    expect(getSafeErrorMessage(new NotFoundError('User not found'))).toBe('User not found');
  });

  it('should return generic message for non-exposed errors', () => {
    expect(getSafeErrorMessage(new InternalServerError('Database crashed'))).toBe('Internal Server Error');
  });

  it('should return generic message for regular Error', () => {
    expect(getSafeErrorMessage(new Error('Sensitive info'))).toBe('Internal Server Error');
  });

  it('should return generic message for non-errors', () => {
    expect(getSafeErrorMessage('string error')).toBe('Internal Server Error');
  });
});
