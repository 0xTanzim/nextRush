/**
 * Cross-adapter conformance — `BodySource.buffer(limit)` (BP-A / RFC 017).
 *
 * The caller-supplied per-read limit MUST be enforced identically across every
 * adapter: an over-limit body is rejected (413) before the full body is accepted,
 * and a within-limit body reads through. Run against every built-in driver so the
 * limit-propagation contract cannot drift between Node and the Web adapters.
 */

import { describe, expect, it } from 'vitest';
import { drivers } from '../drivers';

describe.each(drivers)('conformance: BodySource.buffer(limit) [$name]', (driver) => {
  it('rejects a body over the caller limit with 413', async () => {
    const res = await driver.dispatch(
      (app) => {
        app.use(async (ctx) => {
          try {
            await ctx.bodySource.buffer(10); // 10-byte caller limit
            ctx.status = 200;
            ctx.send('accepted');
          } catch (err) {
            // BodyTooLargeError extends PayloadTooLargeError (status 413).
            ctx.status = (err as { status?: number }).status ?? 500;
            ctx.send('rejected');
          }
        });
      },
      {
        method: 'POST',
        path: '/',
        // An honest Content-Length drives the synchronous pre-check path: the caller
        // limit is enforced before any body is read, so no mid-stream socket destroy
        // races the 413 response. Incremental (chunked) enforcement is unit-tested at
        // the adapter level (body-source-limit.test.ts).
        headers: { 'content-type': 'text/plain', 'content-length': '100' },
        body: 'x'.repeat(100),
      }
    );
    expect(res.status).toBe(413);
  });

  it('rejects a chunked over-limit body (no Content-Length) with 413 — not a reset (BP-K)', async () => {
    const res = await driver.dispatch(
      (app) => {
        app.use(async (ctx) => {
          try {
            await ctx.bodySource.buffer(10); // 10-byte caller limit
            ctx.status = 200;
            ctx.send('accepted');
          } catch (err) {
            ctx.status = (err as { status?: number }).status ?? 500;
            ctx.send('rejected');
          }
        });
      },
      {
        method: 'POST',
        path: '/',
        // No Content-Length → the Node driver sends it chunked, exercising the
        // mid-stream breach path. BP-K: the adapter must deliver a clean 413 instead
        // of destroying the socket (which surfaced as ECONNRESET). Kept small so the
        // client finishes sending before the server responds, making it deterministic.
        headers: { 'content-type': 'text/plain' },
        body: 'x'.repeat(100),
      }
    );
    expect(res.status).toBe(413);
  });

  it('accepts a body within the caller limit', async () => {
    const res = await driver.dispatch(
      (app) => {
        app.use(async (ctx) => {
          const buf = await ctx.bodySource.buffer(1000);
          ctx.status = 200;
          ctx.send(String(buf.length));
        });
      },
      {
        method: 'POST',
        path: '/',
        headers: { 'content-type': 'text/plain' },
        body: 'hello',
      }
    );
    expect(res.status).toBe(200);
    expect(res.text()).toBe('5');
  });
});
