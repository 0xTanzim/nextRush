/**
 * @nextrush/adapter-edge - Public API surface test
 *
 * Locks the exported symbol set from `src/index.ts`. If this test fails, the
 * public API has changed. Intentional changes require an explicit update to
 * the expected list below, plus a changeset for a published package.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as adapterEdgeApi from '../index';
import type {
  BodySource,
  CloudflareFetchHandler,
  Context,
  EdgeExecutionContext,
  EdgeRuntimeInfo,
  FetchHandler,
  FetchHandlerOptions,
  HttpMethod,
  Middleware,
  Runtime,
  RuntimeCapabilities,
} from '../index';

describe('Public API surface (runtime exports)', () => {
  it('exports exactly the intended runtime symbols', () => {
    const actualExports = Object.keys(adapterEdgeApi).sort();

    // SEALED: intentional public runtime API surface.
    const expectedRuntime = [
      // Main adapter functions
      'createCloudflareHandler',
      'createFetchHandler',
      'createHandler',
      'createNetlifyHandler',
      'createVercelHandler',
      'DEFAULT_EDGE_TIMEOUT_MS',

      // Context
      'EdgeContext',
      'createEdgeContext',

      // HttpError re-export (uniform across all adapters — audit F-10)
      'HttpError',

      // Body source
      'createEmptyBodySource',
      'createWebBodySource',
      'EmptyBodySource',
      'WebBodySource',

      // Shared error classes (parity with node/bun/deno — audit F-10)
      'BodyConsumedError',
      'BodyTooLargeError',

      // Utility exports
      'detectEdgeRuntime',
      'getContentLength',
      'getContentType',
      'parseQueryString',
    ].sort();

    expect(actualExports).toEqual(expectedRuntime);
  });
});

describe('Public API surface (type-only exports)', () => {
  it('the type-only surface stays importable from the barrel', () => {
    // Compile-time only: removing/renaming any of these in src/index.ts fails
    // this file to type-check.
    type Surface = [
      CloudflareFetchHandler,
      FetchHandler,
      FetchHandlerOptions,
      EdgeExecutionContext,
      EdgeRuntimeInfo,
      BodySource,
      Context,
      HttpMethod,
      Middleware,
      Runtime,
      RuntimeCapabilities,
    ];
    expectTypeOf<Surface>().not.toBeNever();
  });
});
