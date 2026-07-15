/**
 * Cross-adapter conformance — runtime behaviors (audit F-01, spec rows #13-#15,
 * #19). These involve cancellation and connection semantics; documented,
 * legitimate differences are encoded via driver capability flags rather than
 * skipped (e.g. Node's socket-level timeout vs the Web adapters' 504).
 */

import { describe, expect, it } from 'vitest';
import { drivers } from '../drivers';

describe.each(drivers)('conformance: runtime behaviors [$name]', (driver) => {
  it('#13 timeout: Web adapters return 504 and cancel via ctx.signal (F-08); Node is socket-level', async () => {
    const result = await driver.timeoutResult();
    if (driver.handlerTimeout504) {
      // Bun / Deno / Edge: the handler race returns 504 AND aborts ctx.signal
      // so a cooperative handler can stop (audit F-08).
      expect(result).toEqual({ status: 504, signalFired: true });
    } else {
      // Node: `timeout` is enforced at the socket level (`server.timeout`), which
      // closes the connection rather than emitting a 504 — a documented, encoded
      // difference, not a skipped case.
      expect(result).toBeNull();
    }
  });

  it('#15 abort: ctx.signal fires when the transport aborts mid-request', async () => {
    // Node: real client disconnect closes the socket. Web: the platform
    // Request.signal aborts. Both must propagate to ctx.signal identically.
    if (driver.transportAbortFiresSignal) {
      expect(await driver.abortFiresSignal()).toBe(true);
    } else {
      // Serverless: the platform delivers a fully-buffered event, so there is no
      // mid-request transport abort to propagate. Cancellation is timeout-driven
      // (#13), where ctx.signal DOES fire. Encoded difference, not a skip.
      expect(await driver.abortFiresSignal()).toBe(false);
    }
  });

  it('#18/#14 lifecycle capability: teardown runs on shutdown except on lifetime-less adapters', () => {
    // Encodes the documented exception (F-14): server adapters (node/bun/deno)
    // run extension destroy() on close(); edge and serverless have no server
    // lifetime and intentionally never tear down. Shutdown/drain itself is a
    // serve()-level concern covered by each server adapter's own adapter.test.ts.
    const hasServerLifetime = driver.name !== 'edge' && driver.name !== 'serverless';
    expect(driver.teardownOnShutdown).toBe(hasServerLifetime);
  });

  it('#19 client IP: same precedence + validation across adapters (F-11)', async () => {
    const xff = '203.0.113.9';

    // trustProxy on → first X-Forwarded-For entry wins.
    const trusted = await driver.dispatch((app) => {
      app.use((ctx) => ctx.send(ctx.ip));
    }, { proxy: true, directIp: '10.0.0.1', headers: { 'x-forwarded-for': `${xff}, 70.41.3.18` } });
    expect(trusted.text()).toBe(xff);

    // trustProxy off → proxy headers ignored (never the spoofed XFF value).
    const untrusted = await driver.dispatch((app) => {
      app.use((ctx) => ctx.send(ctx.ip));
    }, { proxy: false, directIp: '10.0.0.1', headers: { 'x-forwarded-for': xff } });
    expect(untrusted.text()).not.toBe(xff);

    // Malformed XFF is rejected by validation → falls through to X-Real-IP.
    const validated = await driver.dispatch((app) => {
      app.use((ctx) => ctx.send(ctx.ip));
    }, {
      proxy: true,
      directIp: '10.0.0.1',
      headers: { 'x-forwarded-for': '<script>alert(1)</script>', 'x-real-ip': '198.51.100.2' },
    });
    expect(validated.text()).toBe('198.51.100.2');
  });
});
