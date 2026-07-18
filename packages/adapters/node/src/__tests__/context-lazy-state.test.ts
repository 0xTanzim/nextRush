/**
 * @nextrush/adapter-node — Lazy `ctx.state` regression contract (NF-2)
 *
 * Executable contract for OpenSpec change
 * `hot-path-dispatch-deasync-and-lazy-state`. `NodeContext` no longer allocates
 * `state = {}` eagerly in a class-field initializer; it holds a private
 * `_state?` backing field and materializes the object lazily via a memoized
 * `get state()` / `set state()` accessor pair, so a request that never touches
 * `state` allocates no object — mirroring the shipped lazy `raw`/`signal`.
 *
 * Two kinds of tests:
 *  - OPTIMIZATION ASSERTION (RED before NF-2): `state` is a lazy ACCESSOR on the
 *    prototype and is NOT an eager own data property on a state-unread context.
 *    The eager class field made `state` an own property allocated in the
 *    constructor, so these fail against the current code and pass only once the
 *    field becomes an accessor. (The byte-level "no {} allocated" is measured by
 *    the §7.2 micro-bench, exactly as HP-5's lazy-raw did.)
 *  - CHARACTERIZATION (green before and after): first-access materialization,
 *    identity stability, intra-request sharing, reassignment, and the
 *    symbol-keyed write/clear the `createPrefixMount` path performs.
 */

import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { describe, expect, it, vi } from 'vitest';
import { NodeContext } from '../context';

function createMockReq(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.method = overrides.method ?? 'GET';
  req.url = overrides.url ?? '/';
  req.headers = overrides.headers ?? {};
  return req;
}

function createMockRes(): ServerResponse {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  const res = new ServerResponse(req);
  vi.spyOn(res, 'setHeader').mockImplementation(() => res);
  vi.spyOn(res, 'end').mockImplementation(() => res);
  vi.spyOn(res, 'writeHead').mockImplementation(() => res);
  return res;
}

const newCtx = (): NodeContext => new NodeContext(createMockReq(), createMockRes());

// ===========================================================================
// §4.1 — a state-unread request allocates no state object (RED before NF-2)
// ===========================================================================

describe('NF-2 §4.1: state is lazy — no object on a state-unread request', () => {
  it('state is a lazy accessor on the prototype, not an eager own field', () => {
    // Eager class field → `state` lives on the instance; lazy accessor → it lives
    // on the prototype as a getter. This is the structural proof the eager {} is gone.
    const desc = Object.getOwnPropertyDescriptor(NodeContext.prototype, 'state');
    expect(typeof desc?.get).toBe('function');
    expect(typeof desc?.set).toBe('function');
  });

  it('does not materialize `state` as an own property until it is read', () => {
    const ctx = newCtx();
    // A request that uses json/body/params but never touches state.
    ctx.status = 201;
    void ctx.params;
    expect(Object.prototype.hasOwnProperty.call(ctx, 'state')).toBe(false);
  });
});

// ===========================================================================
// §4.2 — materializes on first read, identity-stable (characterization)
// ===========================================================================

describe('NF-2 §4.2: materializes on first access and is identity-stable', () => {
  it('returns a mutable object on first read', () => {
    const ctx = newCtx();
    expect(typeof ctx.state).toBe('object');
    expect(ctx.state).not.toBeNull();
  });

  it('repeated reads return the same object (ctx.state === ctx.state)', () => {
    const ctx = newCtx();
    expect(ctx.state).toBe(ctx.state);
  });

  it('gives each context its own state object (no shared instance)', () => {
    expect(newCtx().state).not.toBe(newCtx().state);
  });
});

// ===========================================================================
// §4.3 — intra-request sharing preserved (characterization)
// ===========================================================================

describe('NF-2 §4.3: middleware share data through state', () => {
  it('a value written by one reader is visible to a later reader', () => {
    const ctx = newCtx();
    (ctx.state as Record<string, unknown>).user = { id: 7 };
    expect((ctx.state as Record<string, unknown>).user).toEqual({ id: 7 });
  });
});

// ===========================================================================
// §4.4 — reassignment preserved (characterization)
// ===========================================================================

describe('NF-2 §4.4: state is reassignable', () => {
  it('ctx.state = {...} succeeds and subsequent reads return the assigned object', () => {
    const ctx = newCtx();
    const fresh = { fresh: true };
    ctx.state = fresh;
    expect(ctx.state).toBe(fresh);
    expect((ctx.state as Record<string, unknown>).fresh).toBe(true);
  });

  it('reassignment after first materialization replaces the object', () => {
    const ctx = newCtx();
    (ctx.state as Record<string, unknown>).a = 1; // materialize
    const replacement = { b: 2 };
    ctx.state = replacement;
    expect(ctx.state).toBe(replacement);
    expect((ctx.state as Record<string, unknown>).a).toBeUndefined();
  });
});

// ===========================================================================
// §4.5 — symbol-keyed writes (the createPrefixMount pattern) (characterization)
// ===========================================================================

describe('NF-2 §4.5: symbol-keyed writes land and clear through the accessor', () => {
  it('supports the write-then-clear symbol pattern createPrefixMount uses', () => {
    const ORIGINAL_PATH = Symbol.for('nextrush.originalPath');
    const ROUTE_PREFIX = Symbol.for('nextrush.routePrefix');
    const ctx = newCtx();

    // Read materializes state, then symbol keys are written on the real object.
    (ctx.state as Record<symbol, unknown>)[ORIGINAL_PATH] = '/api/users';
    (ctx.state as Record<symbol, unknown>)[ROUTE_PREFIX] = '/api';
    expect((ctx.state as Record<symbol, unknown>)[ORIGINAL_PATH]).toBe('/api/users');
    expect((ctx.state as Record<symbol, unknown>)[ROUTE_PREFIX]).toBe('/api');

    // The finally-block clear goes through the same getter.
    (ctx.state as Record<symbol, unknown>)[ORIGINAL_PATH] = undefined;
    (ctx.state as Record<symbol, unknown>)[ROUTE_PREFIX] = undefined;
    expect((ctx.state as Record<symbol, unknown>)[ORIGINAL_PATH]).toBeUndefined();
    expect((ctx.state as Record<symbol, unknown>)[ROUTE_PREFIX]).toBeUndefined();

    // Symbol writes materialized state as an own property (identity stable).
    expect(ctx.state).toBe(ctx.state);
  });
});
