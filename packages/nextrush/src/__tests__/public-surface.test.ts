/**
 * nextrush (meta package) - Public API surface test
 *
 * Locks the exported symbol set from `src/index.ts`. If this test fails, the
 * public API has changed. Intentional changes require an explicit update to
 * the expected list below, plus a changeset for a published package.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as nextrushApi from '../index';
import { Application, ContentType, HttpStatus, ERROR_CODES, codeForStatus, HttpError, NextRushError, BadRequestError, BadGatewayError, ConflictError, ForbiddenError, GatewayTimeoutError, InternalServerError, MethodNotAllowedError, NotFoundError, NotImplementedError, ServiceUnavailableError, TooManyRequestsError, UnauthorizedError, UnprocessableEntityError, ValidationError, catchAsync, createError, errorHandler, isHttpError, notFoundHandler, Router, compose, createApp, createRouter, endpoint, createHandler, listen, serve } from '../index';
import type { ApplicationOptions, ComposedMiddleware, RouterOptions, ServeOptions, ServerInstance, ErrorHandlerOptions, HttpErrorOptions, ValidationIssue, Context, Extension, ExtensionContext, HttpMethod, HttpStatusCode, Middleware, Next, RouteHandler, RouteDefinition, RouteMetadata, Runtime } from '../index';

describe('Public API surface (runtime exports)', () => {
  it('exports exactly the intended runtime symbols', () => {
    const actualExports = Object.keys(nextrushApi).sort();

    // SEALED: intentional public runtime API surface — the functional meta
    // entry point. Class-based API lives at the `nextrush/class` subpath,
    // not re-exported here.
    const expectedRuntime = [
      'createApp',
      'Application',
      'compose',
      'Router',
      'createRouter',
      'endpoint',
      'createHandler',
      'listen',
      'serve',
      'BadGatewayError',
      'BadRequestError',
      'ConflictError',
      'ForbiddenError',
      'GatewayTimeoutError',
      'HttpError',
      'InternalServerError',
      'MethodNotAllowedError',
      'NextRushError',
      'NotFoundError',
      'NotImplementedError',
      'ServiceUnavailableError',
      'TooManyRequestsError',
      'UnauthorizedError',
      'UnprocessableEntityError',
      'catchAsync',
      'createError',
      'errorHandler',
      'isHttpError',
      'notFoundHandler',
      'ERROR_CODES',
      'codeForStatus',
      'ValidationError',
      'ContentType',
      'HttpStatus',
    ].sort();

    expect(actualExports).toEqual(expectedRuntime);
    expect(typeof createApp).toBe('function');
    expect(typeof Application).toBe('function');
    expect(typeof HttpError).toBe('function');
    expect(typeof ContentType).toBe('object');
    expect(typeof HttpStatus).toBe('object');
    expect(typeof ERROR_CODES).toBe('object');
    expect(typeof codeForStatus).toBe('function');
    expect(typeof isHttpError).toBe('function');
    expect(typeof notFoundHandler).toBe('function');
    expect(typeof Router).toBe('function');
    expect(typeof compose).toBe('function');
    expect(typeof createRouter).toBe('function');
    expect(typeof endpoint).toBe('function');
    expect(typeof createHandler).toBe('function');
    expect(typeof listen).toBe('function');
    expect(typeof serve).toBe('function');
    expect(typeof NextRushError).toBe('function');
    expect(typeof BadRequestError).toBe('function');
    expect(typeof BadGatewayError).toBe('function');
    expect(typeof ConflictError).toBe('function');
    expect(typeof ForbiddenError).toBe('function');
    expect(typeof GatewayTimeoutError).toBe('function');
    expect(typeof InternalServerError).toBe('function');
    expect(typeof MethodNotAllowedError).toBe('function');
    expect(typeof NotFoundError).toBe('function');
    expect(typeof NotImplementedError).toBe('function');
    expect(typeof ServiceUnavailableError).toBe('function');
    expect(typeof TooManyRequestsError).toBe('function');
    expect(typeof UnauthorizedError).toBe('function');
    expect(typeof UnprocessableEntityError).toBe('function');
    expect(typeof ValidationError).toBe('function');
    expect(typeof catchAsync).toBe('function');
    expect(typeof createError).toBe('function');
    expect(typeof errorHandler).toBe('function');
  });
});

describe('Public API surface (type-only exports)', () => {
  it('the type-only surface stays importable from the barrel', () => {
    // Compile-time only: removing/renaming any of these in src/index.ts fails
    // this file to type-check.
    type Surface = [
      ApplicationOptions,
      ComposedMiddleware,
      RouterOptions,
      ServeOptions,
      ServerInstance,
      ErrorHandlerOptions,
      HttpErrorOptions,
      ValidationIssue,
      Context,
      Extension,
      ExtensionContext,
      HttpMethod,
      HttpStatusCode,
      Middleware,
      Next,
      RouteHandler,
      RouteDefinition,
      RouteMetadata,
      Runtime,
    ];
    expectTypeOf<Surface>().not.toBeNever();
  });
});
