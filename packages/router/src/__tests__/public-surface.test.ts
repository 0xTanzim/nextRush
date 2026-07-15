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
  RadixNode,
  Route,
  RouteGroup,
  RouteHandler,
  RouteMatch,
  RouterInterface,
  RouterOptions,
} from '../index';

describe('Public API surface (runtime exports)', () => {
  it('exports exactly the intended runtime symbols', () => {
    const actualExports = Object.keys(routerApi).sort();

    // SEALED: intentional public runtime API surface.
    // Note: `createNode`/`NodeType`/`parseSegments` retain the historical
    // "radix" naming (see the barrel's own comment, audit RT-2 / gap-checklist
    // T002) — locked as-is here; a future rename is a separate breaking change.
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
      RadixNode,
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
