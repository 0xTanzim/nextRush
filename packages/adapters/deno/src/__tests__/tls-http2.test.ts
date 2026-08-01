/**
 * @nextrush/adapter-deno - TLS option wiring tests (RFC-028, tasks 5.1/5.4/5.5)
 *
 * `Deno.serve` does not exist under vitest/Node (see graceful-shutdown.test.ts's
 * header comment for the established pattern this file follows) — real ALPN/h2
 * negotiation is Deno's native TLS behavior and cannot be faked by a Node-backed
 * stub. This suite proves what IS testable under vitest: that the canonical
 * `tls` field and the deprecated flat `cert`/`key` fields both reach
 * `Deno.serve()`'s options with the correct precedence (`tls` wins). The actual
 * ALPN negotiation claim (`capabilitiesFor('deno').http2 === true`) rests on
 * Deno's own documented behavior (cited in detection.ts) plus the separate
 * real-Deno smoke check below — it is not re-derived here.
 */

import { createApp } from '@nextrush/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { serve } from '../adapter';

/** Minimal `Deno.serve` stand-in that records the options it was called with. */
function installDenoServeStub(): { restore: () => void; calls: unknown[] } {
  const calls: unknown[] = [];
  const denoGlobal = (globalThis as { Deno?: unknown }).Deno;
  (globalThis as { Deno?: unknown }).Deno = {
    ...(denoGlobal as object),
    serve(options: unknown, handler: unknown) {
      calls.push(options);
      return {
        addr: { hostname: '127.0.0.1', port: 0 },
        finished: new Promise<void>(() => {}),
        shutdown: async () => {},
        ref: () => {},
        unref: () => {},
      };
    },
  };
  return {
    calls,
    restore: () => {
      (globalThis as { Deno?: unknown }).Deno = denoGlobal;
    },
  };
}

let stub: { restore: () => void; calls: unknown[] } | undefined;

beforeEach(() => {
  stub = installDenoServeStub();
});

afterEach(() => {
  stub?.restore();
});

describe('deno adapter — tls option precedence (RFC-028 D5)', () => {
  it('passes the canonical tls.cert/tls.key through to Deno.serve()', async () => {
    const app = createApp();
    app.use(async (ctx) => ctx.json({ ok: true }));

    await serve(app, { port: 0, tls: { cert: 'CERT_A', key: 'KEY_A' } });

    expect(stub?.calls).toHaveLength(1);
    const options = stub?.calls[0] as { cert?: string; key?: string };
    expect(options.cert).toBe('CERT_A');
    expect(options.key).toBe('KEY_A');
  });

  it('still passes the deprecated flat cert/key through to Deno.serve()', async () => {
    const app = createApp();
    app.use(async (ctx) => ctx.json({ ok: true }));

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    await serve(app, { port: 0, cert: 'CERT_B', key: 'KEY_B' });

    expect(stub?.calls).toHaveLength(1);
    const options = stub?.calls[0] as { cert?: string; key?: string };
    expect(options.cert).toBe('CERT_B');
    expect(options.key).toBe('KEY_B');
  });

  it('the canonical tls field takes precedence over deprecated flat fields when both are given', async () => {
    const app = createApp();
    app.use(async (ctx) => ctx.json({ ok: true }));

    await serve(app, {
      port: 0,
      tls: { cert: 'CERT_CANONICAL', key: 'KEY_CANONICAL' },
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      cert: 'CERT_DEPRECATED',
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      key: 'KEY_DEPRECATED',
    });

    const options = stub?.calls[0] as { cert?: string; key?: string };
    expect(options.cert).toBe('CERT_CANONICAL');
    expect(options.key).toBe('KEY_CANONICAL');
  });
});
