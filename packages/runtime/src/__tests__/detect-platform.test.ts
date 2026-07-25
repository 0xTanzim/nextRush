/**
 * @nextrush/runtime - detectPlatform() Tests (RFC-026 P0)
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detectPlatform, resetRuntimeCache } from '../detection.js';

describe('detectPlatform', () => {
  const originalEnv = { ...process.env };
  const g = globalThis as { Deno?: unknown };
  const originalDeno = g.Deno;
  let originalUserAgentDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    resetRuntimeCache();
    originalUserAgentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    delete process.env.VERCEL_REGION;
    delete process.env.NETLIFY;
    delete g.Deno;
  });

  afterEach(() => {
    resetRuntimeCache();
    process.env = { ...originalEnv };
    if (originalDeno !== undefined) {
      g.Deno = originalDeno;
    } else {
      delete g.Deno;
    }
    if (originalUserAgentDescriptor) {
      Object.defineProperty(globalThis, 'navigator', originalUserAgentDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'navigator');
    }
  });

  it('detects Cloudflare Workers via navigator.userAgent', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: 'Cloudflare-Workers' },
      configurable: true,
    });

    expect(detectPlatform()).toEqual({ platform: 'cloudflare-workers' });
  });

  it('detects Vercel Edge via VERCEL_REGION', () => {
    process.env.VERCEL_REGION = 'iad1';

    expect(detectPlatform()).toEqual({ platform: 'vercel-edge' });
  });

  it('detects Netlify Edge via Deno global + NETLIFY env var', () => {
    g.Deno = {};
    process.env.NETLIFY = 'true';

    expect(detectPlatform()).toEqual({ platform: 'netlify-edge' });
  });

  it('returns undefined platform when no named edge platform is detected', () => {
    expect(detectPlatform()).toEqual({ platform: undefined });
  });

  it('caches its result like detectEdgeRuntime does', () => {
    const first = detectPlatform();
    process.env.VERCEL_REGION = 'iad1'; // mutate env after first call
    const second = detectPlatform();

    expect(second).toBe(first);
  });
});
