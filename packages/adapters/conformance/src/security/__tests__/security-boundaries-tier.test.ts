/**
 * Cross-adapter security-boundaries conformance tier (task 8.8).
 *
 * Builds on the existing `securityScenario()` harness (task 2.1, already
 * landed on this integration branch) to assert cross-adapter PARITY for
 * fixes shipped by WS-A through WS-E — not to re-derive those fixes. Every
 * scenario here runs against {@link primarySecurityDrivers}, so a newly
 * registered adapter is automatically exercised by every scenario already
 * defined the moment it's added to `drivers` (`../drivers/index.ts`) — no
 * scenario file needs to change to cover it.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';
import type { Application } from '@nextrush/core';
import { primarySecurityDrivers, securityScenario } from '..';
import { FORGED_FORWARDED_CHAINS, MALFORMED_HEADERS } from '..';
import type { SecurityScenarioResult } from '..';

/**
 * `securityScenario(init, [driver])` always dispatches to exactly the one
 * driver passed in, so its result array is never empty — narrows the type
 * without a repeated non-null assertion at every call site.
 */
function single(results: readonly SecurityScenarioResult[]): SecurityScenarioResult {
  const [first] = results;
  if (!first) {
    throw new Error('securityScenario() with a single driver returned no results');
  }
  return first;
}

describe.each(primarySecurityDrivers())(
  'security-boundaries conformance tier [$name]',
  (driver) => {
    it('a header write rejected by assertHeaderSafe fails the SAME way on every adapter (task 7.11 — closes the deferred gap)', async () => {
      const results = await securityScenario(
        {
          path: '/',
          configure: (app: Application) => {
            app.use((ctx) => {
              let errorName = 'no-throw';
              try {
                // MALFORMED_HEADERS.valueWithCr's value contains a bare CR —
                // rejected by the RFC 9110 field-value grammar (task 7.5)
                // regardless of which adapter's ctx.set() runs it.
                ctx.set('X-Custom', MALFORMED_HEADERS.valueWithCr['x-custom']);
              } catch (err) {
                errorName = err instanceof Error ? err.constructor.name : String(err);
              }
              ctx.send(errorName);
            });
          },
        },
        [driver]
      );

      const { result } = single(results);
      // Verified against @nextrush/runtime's assertHeaderSafe (shared by
      // every adapter's ctx.set() — packages/runtime/src/response-builder.ts)
      // and @nextrush/errors' HeaderValidationError.
      expect(result.text()).toBe('HeaderValidationError');
    });

    it('a header name rejected by assertHeaderSafe fails the SAME way on every adapter', async () => {
      const results = await securityScenario(
        {
          path: '/',
          configure: (app: Application) => {
            app.use((ctx) => {
              let errorName = 'no-throw';
              try {
                ctx.set('bad name', 'x');
              } catch (err) {
                errorName = err instanceof Error ? err.constructor.name : String(err);
              }
              ctx.send(errorName);
            });
          },
        },
        [driver]
      );

      const { result } = single(results);
      expect(result.text()).toBe('HeaderValidationError');
    });

    it('a forged X-Forwarded-For chain never surfaces as ctx.ip under trusted-hop resolution, on every adapter', async () => {
      const results = await securityScenario(
        {
          path: '/',
          proxy: 1,
          directIp: '10.0.0.5',
          headers: FORGED_FORWARDED_CHAINS.leftmostForged,
          configure: (app: Application) => {
            app.use((ctx) => {
              ctx.send(ctx.ip);
            });
          },
        },
        [driver]
      );

      const { result } = single(results);
      expect(result.text()).not.toBe('203.0.113.9');
    });

    it('a vendor header (cf-connecting-ip) alongside XFF never overrides trusted-hop resolution on a non-edge adapter', async () => {
      if (driver.name === 'edge') return; // Edge legitimately honors cf-connecting-ip (F-11) — documented, not a parity gap.

      const results = await securityScenario(
        {
          path: '/',
          proxy: 1,
          directIp: '10.0.0.5',
          headers: FORGED_FORWARDED_CHAINS.cloudflarePlusXff,
          configure: (app: Application) => {
            app.use((ctx) => {
              ctx.send(ctx.ip);
            });
          },
        },
        [driver]
      );

      const { result } = single(results);
      expect(result.text()).not.toBe('198.51.100.7');
      expect(result.text()).not.toBe('203.0.113.9');
    });
  }
);
