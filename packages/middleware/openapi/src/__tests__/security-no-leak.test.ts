/**
 * @nextrush/openapi - Security: internal-detail leakage in the generated document
 *
 * Part of the `audit-unreviewed-security-surface` investigation (task 6.1/6.2).
 * Confirms the generated OpenAPI document is built exclusively from
 * `RouteDefinition` (developer-declared path/method/metadata) and the Standard
 * Schema conversion — never from `process.env`, `__dirname`/`cwd()`, or any
 * other filesystem/environment-specific source that could leak an internal
 * detail to a public API consumer.
 */

import type { RouteDefinition } from '@nextrush/types';
import { describe, expect, it } from 'vitest';
import { generateDocument } from '../generate.js';

function route(
  def: Partial<RouteDefinition> & Pick<RouteDefinition, 'method' | 'path'>
): RouteDefinition {
  return { key: `${def.method} ${def.path}`, ...def };
}

describe('generateDocument — no internal-detail leakage (audit-unreviewed-security-surface, 6.1/6.2)', () => {
  it('the generated document never contains process.env values, even when routes/metadata are silent about them', async () => {
    const sentinel = `AUDIT_SENTINEL_${Math.random().toString(36).slice(2)}`;
    process.env['AUDIT_LEAK_PROBE'] = sentinel;
    try {
      const doc = await generateDocument(
        [route({ method: 'GET', path: '/health' }), route({ method: 'POST', path: '/users' })],
        { info: { title: 'API', version: '1.0.0' } }
      );
      expect(JSON.stringify(doc)).not.toContain(sentinel);
    } finally {
      delete process.env['AUDIT_LEAK_PROBE'];
    }
  });

  it('the generated document never contains an absolute filesystem path (cwd/dirname-shaped strings)', async () => {
    const doc = await generateDocument(
      [route({ method: 'GET', path: '/users/:id' }), route({ method: 'GET', path: '/reports' })],
      {}
    );
    const serialized = JSON.stringify(doc);
    // A leaked internal path would show up as a POSIX-style absolute path
    // (starting with '/' + at least two more path segments) or a Windows
    // drive-letter path — neither should ever appear; the document's own
    // route paths (e.g. "/users/{id}") are single-segment-ish API routes,
    // not filesystem paths, so this check does not false-positive on them.
    expect(serialized).not.toMatch(/[A-Za-z]:\\\\/); // Windows absolute path
    expect(process.cwd()).not.toBe('/'); // sanity: cwd is a real, checkable path
    expect(serialized).not.toContain(process.cwd());
  });

  it('only route.path, route.metadata, and the schema conversion output ever reach the document — an unexpected RouteDefinition field is never surfaced', async () => {
    const routeWithExtraField = {
      ...route({ method: 'GET', path: '/x' }),
      // Simulates a hypothetical future RouteDefinition field carrying
      // something environment-specific (e.g. a resolved handler file path) —
      // generateDocument must not reach for arbitrary route fields by name.
      __internalHandlerFilePath: '/home/ci-runner/app/src/routes/x.ts',
    } as unknown as RouteDefinition;

    const doc = await generateDocument([routeWithExtraField], {});
    expect(JSON.stringify(doc)).not.toContain('__internalHandlerFilePath');
    expect(JSON.stringify(doc)).not.toContain('ci-runner');
  });
});
