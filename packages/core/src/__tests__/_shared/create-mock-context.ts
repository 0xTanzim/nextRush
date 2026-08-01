/**
 * @nextrush/core - Shared mock Context factory for tests
 *
 * Consolidates what were 3 independently hand-rolled createMockContext()
 * implementations (application.test.ts, route.test.ts, middleware.test.ts)
 * into one source of truth. They had already drifted apart once this
 * session — missing the signal/sendStream/stream/sse/ndjson members added
 * by a later Context revision — and only a forced full-graph typecheck
 * caught it. A single factory means a future Context change needs fixing
 * in one place, not silently re-diverging across files again.
 */

import type { Context } from '@nextrush/types';
import { vi } from 'vitest';

/** Build a minimal, fully Context-shaped mock for unit tests. */
export function createMockContext(overrides: Partial<Context> = {}): Context {
  return {
    method: 'GET',
    url: '/test',
    path: '/test',
    query: {},
    headers: {},
    ip: '127.0.0.1',
    body: undefined,
    params: {},
    status: 200,
    json: vi.fn(),
    send: vi.fn(),
    html: vi.fn(),
    redirect: vi.fn(),
    set: vi.fn(),
    get: vi.fn(),
    next: vi.fn().mockResolvedValue(undefined),
    state: {},
    responded: false,
    runtime: 'node' as const,
    bodySource: {} as never,
    signal: new AbortController().signal,
    sendStream: vi.fn().mockResolvedValue(undefined),
    stream: vi.fn().mockResolvedValue(undefined),
    sse: vi.fn().mockResolvedValue(undefined),
    ndjson: vi.fn().mockResolvedValue(undefined),
    throw: vi.fn(),
    assert: vi.fn(),
    raw: {
      req: {} as never,
      res: {} as never,
    },
    ...overrides,
  } as Context;
}
