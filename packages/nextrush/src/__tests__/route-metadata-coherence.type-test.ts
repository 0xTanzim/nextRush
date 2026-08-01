import { describe, expect, it } from 'vitest';
import type { RouteMetadata as RendererRouteMetadata } from '@nextrush/types';
import type { RouteMetadata as ClassSubpathRouteMetadata, ControllerRouteMetadata } from '@nextrush/class';

/**
 * Cross-subpath public type-name coherence check
 * (openspec/changes/framework-composition-integrity — capability: public-surface-lock,
 * requirement "Public type names are coherent across a package's subpaths").
 *
 * BEFORE this change, `nextrush`'s `.` entry and `nextrush/class` entry each exported a
 * DIFFERENT, structurally-unrelated interface under the identical name `RouteMetadata`. FIXED:
 * `@nextrush/class` renamed its decorator-storage interface to `ControllerRouteMetadata`,
 * reserving `RouteMetadata` for the single renderer-facing contract in `@nextrush/types`. The
 * old name survives for one minor ONLY as a `@deprecated` alias of `ControllerRouteMetadata` —
 * this test locks that the alias is the canonical class shape (so importing `RouteMetadata`
 * from either subpath during the deprecation window is safe), not a live second collision.
 */
describe('RouteMetadata cross-subpath coherence', () => {
  it('the deprecated nextrush/class RouteMetadata alias is ControllerRouteMetadata, not a second collision', () => {
    // If the alias ever silently diverges from ControllerRouteMetadata again, this
    // assignment stops compiling — the collision this requirement exists to catch.
    // Intentionally exercises the deprecated alias to prove it during its one-minor window.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const viaAlias: ClassSubpathRouteMetadata = {
      method: 'GET',
      path: '/users',
      methodName: 'findAll',
      propertyKey: 'findAll',
    };
    const viaCanonical: ControllerRouteMetadata = viaAlias;
    expect(viaCanonical.method).toBe('GET');
  });

  it('the renderer-facing RouteMetadata (from `.`) remains its own distinct shape', () => {
    const rendererShape: RendererRouteMetadata = {
      summary: 'List users',
      tags: ['users'],
      visibility: 'public',
    };
    // The renderer shape still lacks method/path/methodName/propertyKey — proving
    // RouteMetadata now means exactly one thing PER SUBPATH, with no accidental overlap.
    // @ts-expect-error — renderer shape is not assignable to the class decorator-storage shape
    const asClassShape: ControllerRouteMetadata = rendererShape;
    expect(asClassShape).toBeDefined();
  });
});
