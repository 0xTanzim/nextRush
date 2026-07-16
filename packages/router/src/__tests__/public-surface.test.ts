/**
 * @nextrush/router - Public API surface test
 *
 * Locks the exported symbol set from `src/index.ts`. If this test fails, the
 * public API has changed. Intentional changes require an explicit update to
 * the expected list below, plus a changeset for a published package.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as routerApi from '../index';
import { NodeType } from '../index';
import type {
  HandlerEntry,
  HttpMethod,
  Middleware,
  ParsedSegment,
  Route,
  RouteGroup,
  RouteHandler,
  RouteMatch,
  RouterInterface,
  RouterOptions,
  TrieNode,
} from '../index';

describe('Public API surface (runtime exports)', () => {
  it('exports exactly the intended runtime symbols', () => {
    const actualExports = Object.keys(routerApi).sort();

    // SEALED: intentional public runtime API surface.
    // `createNode`/`NodeType`/`parseSegments` are internal segment-trie
    // helpers exposed for advanced usage (see the barrel's own comment) —
    // locked as-is here; renaming any of them is a separate breaking change.
    const expectedRuntime = ['createRouter', 'endpoint', 'Router', 'createNode', 'NodeType', 'parseSegments'].sort();

    expect(actualExports).toEqual(expectedRuntime);
    expect(typeof NodeType).toBe('object');
  });
});

describe('Public API surface (type-only exports)', () => {
  it('the type-only surface stays importable from the barrel', () => {
    // Compile-time only: removing/renaming any of these in src/index.ts fails
    // this file to type-check.
    type Surface = [
      RouteGroup,
      HandlerEntry,
      ParsedSegment,
      TrieNode,
      HttpMethod,
      Middleware,
      Route,
      RouteHandler,
      RouteMatch,
      RouterInterface,
      RouterOptions,
    ];
    expectTypeOf<Surface>().not.toBeNever();
  });
});
