/**
 * @nextrush/core - Public API surface test
 *
 * Locks the exported symbol set from `src/index.ts`. If this test fails, the
 * public API has changed. Intentional changes require an explicit update to
 * the expected list below, plus a changeset for a published package.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as coreApi from '../index';
import { ContentType, HttpStatus } from '../index';
import type {
  ApplicationOptions,
  ComposedMiddleware,
  ComposeOptions,
  Context,
  ContextState,
  Extension,
  ExtensionContext,
  ExtensionHost,
  ErrorHandler,
  HttpMethod,
  HttpStatusCode,
  ListenCallback,
  Logger,
  Middleware,
  Next,
  QueryParams,
  Routable,
  RouteEntry,
  RouteHandler,
  RouteParams,
  Router,
} from '../index';

describe('Public API surface (runtime exports)', () => {
  it('exports exactly the intended runtime symbols', () => {
    const actualExports = Object.keys(coreApi).sort();

    // SEALED: intentional public runtime API surface.
    const expectedRuntime = [
      // Application
      'Application',
      'createApp',

      // Middleware
      'compose',
      'flattenMiddleware',
      'isMiddleware',

      // Errors (re-exported from @nextrush/errors for a single-package DX)
      'BadRequestError',
      'ForbiddenError',
      'HttpError',
      'InternalServerError',
      'NextRushError',
      'NotFoundError',
      'UnauthorizedError',

      // Re-exported constants from @nextrush/types
      'ContentType',
      'HttpStatus',
    ].sort();

    expect(actualExports).toEqual(expectedRuntime);
    expect(typeof ContentType).toBe('object');
    expect(typeof HttpStatus).toBe('object');
  });
});

describe('Public API surface (type-only exports)', () => {
  it('the type-only surface stays importable from the barrel', () => {
    // Compile-time only: removing/renaming any of these in src/index.ts fails
    // this file to type-check.
    type Surface = [
      ApplicationOptions,
      ErrorHandler,
      ListenCallback,
      Routable,
      ComposeOptions,
      ComposedMiddleware,
      Context,
      ContextState,
      Extension,
      ExtensionContext,
      ExtensionHost,
      HttpMethod,
      HttpStatusCode,
      Logger,
      Middleware,
      Next,
      QueryParams,
      RouteEntry,
      RouteHandler,
      RouteParams,
      Router,
    ];
    expectTypeOf<Surface>().not.toBeNever();
  });
});
