/**
 * @nextrush/express-bridge — shared-state projection tests
 */

import { describe, expect, it, vi } from 'vitest';
import type { Context } from '@nextrush/types';
import { projectState, readState } from '../state';

function ctx(): Context {
  return {
    method: 'GET',
    url: '/',
    path: '/',
    query: {},
    headers: {},
    ip: '127.0.0.1',
    body: undefined,
    params: {},
    status: 200,
    state: {},
    cookies: {} as never,
    raw: { req: {}, res: {} },
    runtime: 'node',
    platform: undefined,
    json: vi.fn(),
    send: vi.fn(),
    html: vi.fn(),
    redirect: vi.fn(),
    throw: vi.fn(),
    assert: vi.fn(),
    set: vi.fn(),
    get: vi.fn(),
    next: vi.fn(),
    responded: false,
    bodySource: {} as never,
    signal: new AbortController().signal,
    sendStream: vi.fn(),
    stream: vi.fn(),
    sse: vi.fn(),
    ndjson: vi.fn(),
  };
}

describe('state projection', () => {
  it('projects a safe key onto ctx.state', () => {
    const c = ctx();
    expect(projectState(c, 'user', { id: 1 })).toBe(true);
    expect(c.state.user).toEqual({ id: 1 });
  });

  it('reads a projected key back', () => {
    const c = ctx();
    projectState(c, 'user', 'alice');
    expect(readState(c, 'user')).toBe('alice');
  });

  it('refuses to project a denylisted key (no pollution)', () => {
    const c = ctx();
    expect(projectState(c, '__proto__', { polluted: true })).toBe(false);
    expect(c.state.__proto__).not.toEqual({ polluted: true });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('readState returns undefined for a denylisted key', () => {
    const c = ctx();
    expect(readState(c, 'constructor')).toBeUndefined();
  });
});
