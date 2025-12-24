/**
 * @nextrush/errors - HTTP Error Tests
 */

import { describe, expect, it } from 'vitest';
import { HttpError } from '../base';
import {
    BadGatewayError,
    BadRequestError,
    ConflictError,
    ExpectationFailedError,
    FailedDependencyError,
    ForbiddenError,
    GatewayTimeoutError,
    GoneError,
    HttpVersionNotSupportedError,
    ImATeapotError,
    InsufficientStorageError,
    InternalServerError,
    LengthRequiredError,
    LockedError,
    LoopDetectedError,
    MethodNotAllowedError,
    NetworkAuthRequiredError,
    NotAcceptableError,
    NotExtendedError,
    NotFoundError,
    NotImplementedError,
    PayloadTooLargeError,
    PaymentRequiredError,
    PreconditionFailedError,
    PreconditionRequiredError,
    ProxyAuthRequiredError,
    RangeNotSatisfiableError,
    RequestHeaderFieldsTooLargeError,
    RequestTimeoutError,
    ServiceUnavailableError,
    TooEarlyError,
    TooManyRequestsError,
    UnauthorizedError,
    UnavailableForLegalReasonsError,
    UnprocessableEntityError,
    UnsupportedMediaTypeError,
    UpgradeRequiredError,
    UriTooLongError,
    VariantAlsoNegotiatesError,
} from '../http-errors';

describe('4xx Client Errors', () => {
  describe('BadRequestError', () => {
    it('should have status 400', () => {
      const error = new BadRequestError();
      expect(error.status).toBe(400);
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.message).toBe('Bad Request');
      expect(error.expose).toBe(true);
    });

    it('should accept custom message', () => {
      const error = new BadRequestError('Invalid JSON');
      expect(error.message).toBe('Invalid JSON');
    });

    it('should accept options', () => {
      const error = new BadRequestError('Invalid', { details: { field: 'name' } });
      expect(error.details).toEqual({ field: 'name' });
    });
  });

  describe('UnauthorizedError', () => {
    it('should have status 401', () => {
      const error = new UnauthorizedError();
      expect(error.status).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.message).toBe('Unauthorized');
    });
  });

  describe('PaymentRequiredError', () => {
    it('should have status 402', () => {
      const error = new PaymentRequiredError();
      expect(error.status).toBe(402);
      expect(error.code).toBe('PAYMENT_REQUIRED');
    });
  });

  describe('ForbiddenError', () => {
    it('should have status 403', () => {
      const error = new ForbiddenError();
      expect(error.status).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
    });

    it('should accept custom message', () => {
      const error = new ForbiddenError('Access denied to this resource');
      expect(error.message).toBe('Access denied to this resource');
    });
  });

  describe('NotFoundError', () => {
    it('should have status 404', () => {
      const error = new NotFoundError();
      expect(error.status).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should accept custom message', () => {
      const error = new NotFoundError('User not found');
      expect(error.message).toBe('User not found');
    });
  });

  describe('MethodNotAllowedError', () => {
    it('should have status 405', () => {
      const error = new MethodNotAllowedError();
      expect(error.status).toBe(405);
      expect(error.code).toBe('METHOD_NOT_ALLOWED');
    });

    it('should store allowed methods', () => {
      const error = new MethodNotAllowedError(['GET', 'POST']);
      expect(error.allowedMethods).toEqual(['GET', 'POST']);
      expect(error.details).toEqual({ allowedMethods: ['GET', 'POST'] });
    });

    it('should accept custom message', () => {
      const error = new MethodNotAllowedError(['GET'], 'Only GET is allowed');
      expect(error.message).toBe('Only GET is allowed');
    });
  });

  describe('NotAcceptableError', () => {
    it('should have status 406', () => {
      const error = new NotAcceptableError();
      expect(error.status).toBe(406);
      expect(error.code).toBe('NOT_ACCEPTABLE');
    });
  });

  describe('ProxyAuthRequiredError', () => {
    it('should have status 407', () => {
      const error = new ProxyAuthRequiredError();
      expect(error.status).toBe(407);
      expect(error.code).toBe('PROXY_AUTH_REQUIRED');
    });
  });

  describe('RequestTimeoutError', () => {
    it('should have status 408', () => {
      const error = new RequestTimeoutError();
      expect(error.status).toBe(408);
      expect(error.code).toBe('REQUEST_TIMEOUT');
    });
  });

  describe('ConflictError', () => {
    it('should have status 409', () => {
      const error = new ConflictError();
      expect(error.status).toBe(409);
      expect(error.code).toBe('CONFLICT');
    });

    it('should accept custom message', () => {
      const error = new ConflictError('Resource already exists');
      expect(error.message).toBe('Resource already exists');
    });
  });

  describe('GoneError', () => {
    it('should have status 410', () => {
      const error = new GoneError();
      expect(error.status).toBe(410);
      expect(error.code).toBe('GONE');
    });
  });

  describe('LengthRequiredError', () => {
    it('should have status 411', () => {
      const error = new LengthRequiredError();
      expect(error.status).toBe(411);
      expect(error.code).toBe('LENGTH_REQUIRED');
    });
  });

  describe('PreconditionFailedError', () => {
    it('should have status 412', () => {
      const error = new PreconditionFailedError();
      expect(error.status).toBe(412);
      expect(error.code).toBe('PRECONDITION_FAILED');
    });
  });

  describe('PayloadTooLargeError', () => {
    it('should have status 413', () => {
      const error = new PayloadTooLargeError();
      expect(error.status).toBe(413);
      expect(error.code).toBe('PAYLOAD_TOO_LARGE');
    });
  });

  describe('UriTooLongError', () => {
    it('should have status 414', () => {
      const error = new UriTooLongError();
      expect(error.status).toBe(414);
      expect(error.code).toBe('URI_TOO_LONG');
    });
  });

  describe('UnsupportedMediaTypeError', () => {
    it('should have status 415', () => {
      const error = new UnsupportedMediaTypeError();
      expect(error.status).toBe(415);
      expect(error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });
  });

  describe('RangeNotSatisfiableError', () => {
    it('should have status 416', () => {
      const error = new RangeNotSatisfiableError();
      expect(error.status).toBe(416);
      expect(error.code).toBe('RANGE_NOT_SATISFIABLE');
    });
  });

  describe('ExpectationFailedError', () => {
    it('should have status 417', () => {
      const error = new ExpectationFailedError();
      expect(error.status).toBe(417);
      expect(error.code).toBe('EXPECTATION_FAILED');
    });
  });

  describe('ImATeapotError', () => {
    it('should have status 418', () => {
      const error = new ImATeapotError();
      expect(error.status).toBe(418);
      expect(error.code).toBe('IM_A_TEAPOT');
      expect(error.message).toBe("I'm a teapot");
    });
  });

  describe('UnprocessableEntityError', () => {
    it('should have status 422', () => {
      const error = new UnprocessableEntityError();
      expect(error.status).toBe(422);
      expect(error.code).toBe('UNPROCESSABLE_ENTITY');
    });
  });

  describe('LockedError', () => {
    it('should have status 423', () => {
      const error = new LockedError();
      expect(error.status).toBe(423);
      expect(error.code).toBe('LOCKED');
    });
  });

  describe('FailedDependencyError', () => {
    it('should have status 424', () => {
      const error = new FailedDependencyError();
      expect(error.status).toBe(424);
      expect(error.code).toBe('FAILED_DEPENDENCY');
    });
  });

  describe('TooEarlyError', () => {
    it('should have status 425', () => {
      const error = new TooEarlyError();
      expect(error.status).toBe(425);
      expect(error.code).toBe('TOO_EARLY');
    });
  });

  describe('UpgradeRequiredError', () => {
    it('should have status 426', () => {
      const error = new UpgradeRequiredError();
      expect(error.status).toBe(426);
      expect(error.code).toBe('UPGRADE_REQUIRED');
    });
  });

  describe('PreconditionRequiredError', () => {
    it('should have status 428', () => {
      const error = new PreconditionRequiredError();
      expect(error.status).toBe(428);
      expect(error.code).toBe('PRECONDITION_REQUIRED');
    });
  });

  describe('TooManyRequestsError', () => {
    it('should have status 429', () => {
      const error = new TooManyRequestsError();
      expect(error.status).toBe(429);
      expect(error.code).toBe('TOO_MANY_REQUESTS');
    });

    it('should store retryAfter', () => {
      const error = new TooManyRequestsError('Rate limited', { retryAfter: 60 });
      expect(error.retryAfter).toBe(60);
      expect(error.details).toEqual({ retryAfter: 60 });
    });
  });

  describe('RequestHeaderFieldsTooLargeError', () => {
    it('should have status 431', () => {
      const error = new RequestHeaderFieldsTooLargeError();
      expect(error.status).toBe(431);
      expect(error.code).toBe('REQUEST_HEADER_FIELDS_TOO_LARGE');
    });
  });

  describe('UnavailableForLegalReasonsError', () => {
    it('should have status 451', () => {
      const error = new UnavailableForLegalReasonsError();
      expect(error.status).toBe(451);
      expect(error.code).toBe('UNAVAILABLE_FOR_LEGAL_REASONS');
    });
  });
});

describe('5xx Server Errors', () => {
  describe('InternalServerError', () => {
    it('should have status 500', () => {
      const error = new InternalServerError();
      expect(error.status).toBe(500);
      expect(error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(error.expose).toBe(false);
    });

    it('should accept custom message', () => {
      const error = new InternalServerError('Database connection failed');
      expect(error.message).toBe('Database connection failed');
    });
  });

  describe('NotImplementedError', () => {
    it('should have status 501', () => {
      const error = new NotImplementedError();
      expect(error.status).toBe(501);
      expect(error.code).toBe('NOT_IMPLEMENTED');
      expect(error.expose).toBe(false);
    });
  });

  describe('BadGatewayError', () => {
    it('should have status 502', () => {
      const error = new BadGatewayError();
      expect(error.status).toBe(502);
      expect(error.code).toBe('BAD_GATEWAY');
      expect(error.expose).toBe(false);
    });
  });

  describe('ServiceUnavailableError', () => {
    it('should have status 503', () => {
      const error = new ServiceUnavailableError();
      expect(error.status).toBe(503);
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
      expect(error.expose).toBe(false);
    });

    it('should store retryAfter', () => {
      const error = new ServiceUnavailableError('Maintenance', { retryAfter: 3600 });
      expect(error.retryAfter).toBe(3600);
    });
  });

  describe('GatewayTimeoutError', () => {
    it('should have status 504', () => {
      const error = new GatewayTimeoutError();
      expect(error.status).toBe(504);
      expect(error.code).toBe('GATEWAY_TIMEOUT');
      expect(error.expose).toBe(false);
    });
  });

  describe('HttpVersionNotSupportedError', () => {
    it('should have status 505', () => {
      const error = new HttpVersionNotSupportedError();
      expect(error.status).toBe(505);
      expect(error.code).toBe('HTTP_VERSION_NOT_SUPPORTED');
    });
  });

  describe('VariantAlsoNegotiatesError', () => {
    it('should have status 506', () => {
      const error = new VariantAlsoNegotiatesError();
      expect(error.status).toBe(506);
      expect(error.code).toBe('VARIANT_ALSO_NEGOTIATES');
    });
  });

  describe('InsufficientStorageError', () => {
    it('should have status 507', () => {
      const error = new InsufficientStorageError();
      expect(error.status).toBe(507);
      expect(error.code).toBe('INSUFFICIENT_STORAGE');
    });
  });

  describe('LoopDetectedError', () => {
    it('should have status 508', () => {
      const error = new LoopDetectedError();
      expect(error.status).toBe(508);
      expect(error.code).toBe('LOOP_DETECTED');
    });
  });

  describe('NotExtendedError', () => {
    it('should have status 510', () => {
      const error = new NotExtendedError();
      expect(error.status).toBe(510);
      expect(error.code).toBe('NOT_EXTENDED');
    });
  });

  describe('NetworkAuthRequiredError', () => {
    it('should have status 511', () => {
      const error = new NetworkAuthRequiredError();
      expect(error.status).toBe(511);
      expect(error.code).toBe('NETWORK_AUTH_REQUIRED');
    });
  });
});

describe('Error inheritance', () => {
  it('all 4xx errors should be instanceof HttpError', () => {
    const errors = [
      new BadRequestError(),
      new UnauthorizedError(),
      new ForbiddenError(),
      new NotFoundError(),
      new MethodNotAllowedError(),
      new ConflictError(),
      new TooManyRequestsError(),
    ];

    for (const error of errors) {
      expect(error).toBeInstanceOf(HttpError);
      expect(error).toBeInstanceOf(Error);
    }
  });

  it('all 5xx errors should be instanceof HttpError', () => {
    const errors = [
      new InternalServerError(),
      new NotImplementedError(),
      new BadGatewayError(),
      new ServiceUnavailableError(),
      new GatewayTimeoutError(),
    ];

    for (const error of errors) {
      expect(error).toBeInstanceOf(HttpError);
      expect(error).toBeInstanceOf(Error);
    }
  });
});
