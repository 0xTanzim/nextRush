/**
 * Cross-adapter conformance — the full suite over deferred body parsing
 * (RFC-047).
 *
 * @remarks
 * Lazy parsing moves the byte read and the parse from the middleware into
 * `ctx.readBody()`, which changes *when* every body error surfaces. The
 * scenario suite is the only place that proves the change is invisible from
 * outside: the same assertions, the same status codes, the same error bodies,
 * run against every built-in driver with `bodyParser({ lazy: true })`.
 *
 * The suite is the single source of assertions (see `../suite`); this file only
 * supplies the parser configuration, so an adapter that passes eagerly and fails
 * lazily shows up here as a mode divergence rather than a missing scenario.
 */

import { describe, expect, it } from 'vitest';
import { bodyParser } from '@nextrush/body-parser';
import { drivers } from '../drivers';
import { defineConformanceSuite } from '../suite';
import { json } from '../support';

/**
 * The built-in drivers, labelled by mode so a failure names the configuration
 * that produced it. Identity is otherwise the driver's own — the suite only
 * reads capability flags and `name`.
 */
const lazyDrivers = drivers.map((driver) => ({ ...driver, name: `lazy:${driver.name}` }));

describe.each(lazyDrivers)(
  'conformance: full suite with bodyParser({ lazy: true }) [$name]',
  (driver) => {
    defineConformanceSuite(driver, { bodyParser: { lazy: true } });

    // Without this the file would be green even if the options never reached
    // `bodyParser()`: the shared scenarios assert outcomes that are identical in
    // both modes by design, so they cannot tell an ignored `lazy` flag apart from
    // a working one. Here the difference IS the assertion — unread `ctx.body`
    // throws, `readBody()` still returns the parsed body.
    it('runs deferred parsing: ctx.body is unread until readBody() resolves it', async () => {
      const res = await driver.dispatch(
        (app) => {
          app.use(bodyParser({ lazy: true }));
          app.use(async (ctx) => {
            let code: string | null = null;
            try {
              void ctx.body;
            } catch (err) {
              code = (err as { code?: string }).code ?? null;
            }
            ctx.json({ code, parsed: await ctx.readBody() });
          });
        },
        { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"a":1}' }
      );

      expect(res.status).toBe(200);
      expect(json<{ code: string | null; parsed: unknown }>(res)).toEqual({
        code: 'BODY_NOT_READ',
        parsed: { a: 1 },
      });
    });
  }
);
