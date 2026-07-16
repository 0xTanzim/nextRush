/**
 * @nextrush/adapter-node - Public API surface test
 *
 * Locks the exported symbol set from `src/index.ts`. If this test fails, the
 * public API has changed. Intentional changes require an explicit update to
 * the expected list below, plus a changeset for a published package.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as adapterNodeApi from '../index';
import type { Application } from '../index';
import type { BodySource, Context, HttpMethod, Middleware, Runtime } from '../index';
import type { NodeContextOptions, ServeOptions, ServerInstance } from '../index';

describe('Public API surface (runtime exports)', () => {
  it('exports exactly the intended runtime symbols', () => {
    const actualExports = Object.keys(adapterNodeApi).sort();

    // SEALED: intentional public runtime API surface.
    const expectedRuntime = [
      // Adapter
      'createHandler',
      'listen',
      'serve',

      // Context (HttpError re-exported from @nextrush/errors — uniform across
      // node/bun/deno/edge adapters, per audit F-10)
      'HttpError',
      'createNodeContext',
      'NodeContext',

      // Body source (BodyConsumedError/BodyTooLargeError re-exported from
      // @nextrush/runtime)
      'BodyConsumedError',
      'BodyTooLargeError',
      'createEmptyBodySource',
      'createNodeBodySource',
      'EmptyBodySource',
      'NodeBodySource',

      // Utilities
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
      ServeOptions,
      ServerInstance,
      NodeContextOptions,
      Application,
      BodySource,
      Context,
      HttpMethod,
      Middleware,
      Runtime,
    ];
    expectTypeOf<Surface>().not.toBeNever();
  });
});
