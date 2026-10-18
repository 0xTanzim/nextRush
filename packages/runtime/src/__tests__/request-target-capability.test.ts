/**
 * @nextrush/runtime — the raw-request-target capability.
 *
 * Whether the framework can see a dot segment at all is a property of the HTTP
 * front end, not of the framework. A runtime that parses the request line into a
 * `URL` before the application runs has already resolved the segment, and no
 * amount of care further in can recover the spelling the client sent — the
 * resolution is upstream and invisible.
 *
 * Measured on this machine over a real socket, sending each target verbatim in
 * the request line through a handler that returns its own `request.url`:
 *
 *   Node (`req.url`)         `/files/../admin` → `/files/../admin`  (preserved)
 *   Deno (`Deno.serve`)      `/files/../admin` → `/files/../admin`  (preserved)
 *   Bun (`Bun.serve`)        `/files/../admin` → `/admin`           (resolved)
 *   workerd (miniflare)      `/files/../admin` → `/admin`           (resolved)
 *
 * every percent-encoded spelling resolving identically on Bun and workerd.
 *
 * The capability records what the platform does. It is NOT consulted to decide
 * behavior — the target is derived and a dot segment rejected the same way
 * everywhere — so a deployment whose platform resolves segments cannot be
 * mistaken for one where the rejection is doing the work. It exists to claim the
 * guarantee only where it holds, and to let a conformance expectation follow from
 * the claim instead of from whichever adapter happens to be running.
 */

import { describe, expect, it } from 'vitest';
import { capabilitiesFor, getRuntimeCapabilities } from '../detection';
import { BunProfile, DenoProfile, EdgeProfile, NodeProfile } from '../profiles';
import type { Runtime } from '@nextrush/types';

/** Every runtime the matrix answers by name, plus the probed fallback. */
const ALL_RUNTIMES = [
  'node',
  'bun',
  'deno',
  'deno-deploy',
  'cloudflare-workers',
  'vercel-edge',
  'edge',
  'unknown',
] as const satisfies readonly Runtime[];

describe('rawRequestTarget — the platform preserves the target, or it does not', () => {
  it.each([
    ['node', true],
    ['deno', true],
    ['bun', false],
    ['deno-deploy', false],
    ['cloudflare-workers', false],
    ['vercel-edge', false],
    ['edge', false],
  ] as const)('%s reports %s', (runtime, expected) => {
    expect(capabilitiesFor(runtime).rawRequestTarget).toBe(expected);
  });

  it('reports false for an unrecognised runtime, where it cannot be probed', () => {
    // The front end's behavior is not a global, so `probeCapabilities` cannot
    // detect it. A capability that gates a security guarantee is claimed only
    // when it is known, never optimistically.
    expect(capabilitiesFor('unknown').rawRequestTarget).toBe(false);
  });

  it.each(ALL_RUNTIMES)('%s answers the field as a boolean, never undefined', (runtime) => {
    expect(typeof capabilitiesFor(runtime).rawRequestTarget).toBe('boolean');
  });

  it('is reported by the running runtime (node here) and by the named profiles', () => {
    expect(getRuntimeCapabilities().rawRequestTarget).toBe(true);
    expect(NodeProfile.capabilities.rawRequestTarget).toBe(true);
    expect(DenoProfile.capabilities.rawRequestTarget).toBe(true);
    expect(BunProfile.capabilities.rawRequestTarget).toBe(false);
    expect(EdgeProfile.capabilities.rawRequestTarget).toBe(false);
  });
});
