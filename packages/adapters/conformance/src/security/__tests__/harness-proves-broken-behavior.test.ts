/**
 * RED harness proof (task 2.3): the security scenario helper and fixtures
 * (2.1-2.2) must themselves demonstrate the SEC-01 and SEC-02 findings are
 * currently broken, on every primary adapter, before any fix lands. A harness
 * that cannot see the bug cannot be trusted to prove the fix later.
 *
 * SEC-01 update (WS-B, RFC-030): `proxy: true` no longer exists — `createApp`
 * rejects it at construction (task 4.3). The two SEC-01 cases below now prove
 * the FIX instead of the bug: a forged leftmost X-Forwarded-For entry under a
 * typed `proxy: 1` (one trusted hop) resolves to the real, rightmost/trusted
 * entry, and no longer rotates per forged request. This is the exact
 * inversion the original comments predicted once RFC-030/WS-B landed.
 */

import { describe, expect, it } from 'vitest';
import { createRouter } from '@nextrush/router';
import type { Application } from '@nextrush/core';
import { primarySecurityDrivers, securityScenario } from '..';
import { FORGED_FORWARDED_CHAINS, PATH_TARGET_VARIANTS } from '..';

describe.each(primarySecurityDrivers())('security harness proves broken behavior [$name]', (driver) => {
  it('SEC-01 (fixed): a client-forged leftmost X-Forwarded-For entry is no longer honored as ctx.ip', async () => {
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

    const [{ result }] = [results[0]!];
    // Under proxy: 1 (one trusted hop), resolution walks the chain from the
    // right rather than trusting the client-authored leftmost entry — the
    // forged value ('203.0.113.9', the leftmost entry) must never surface.
    expect(result.text()).not.toBe('203.0.113.9');
  });

  it('SEC-01 (fixed): a rotating leftmost X-Forwarded-For value no longer changes ctx.ip per request', async () => {
    const first = await securityScenario(
      {
        path: '/',
        proxy: 1,
        directIp: '10.0.0.5',
        headers: FORGED_FORWARDED_CHAINS.rotatingLeftmost(1),
        configure: (app: Application) => {
          app.use((ctx) => {
            ctx.send(ctx.ip);
          });
        },
      },
      [driver]
    );
    const second = await securityScenario(
      {
        path: '/',
        proxy: 1,
        directIp: '10.0.0.5',
        headers: FORGED_FORWARDED_CHAINS.rotatingLeftmost(2),
        configure: (app: Application) => {
          app.use((ctx) => {
            ctx.send(ctx.ip);
          });
        },
      },
      [driver]
    );

    // Post-fix, ctx.ip is stable across requests that only rotate the
    // client-authored (leftmost) entry — the exact bypass a rate limiter's
    // per-IP key would otherwise fall for (SEC-01).
    expect(first[0]!.result.text()).toBe(second[0]!.result.text());
  });

  it('4.12: an untrusted direct peer cannot use a CIDR-list trust to inject a forged IP via headers', async () => {
    if (driver.name === 'edge') return; // Edge has no peer address — CIDR-list trust is rejected at boot (task 4.3), not applicable here.

    const results = await securityScenario(
      {
        path: '/',
        proxy: ['10.0.0.0/8'],
        // The connecting peer is OUTSIDE the trusted range — a forged
        // x-forwarded-for from a peer the trust list doesn't recognize must
        // never be consulted, regardless of what it claims.
        directIp: '198.51.100.200',
        headers: FORGED_FORWARDED_CHAINS.leftmostForged,
        configure: (app: Application) => {
          app.use((ctx) => {
            ctx.send(ctx.ip);
          });
        },
      },
      [driver]
    );

    const [{ result }] = [results[0]!];
    expect(result.text()).not.toBe('203.0.113.9');
    expect(result.text()).not.toBe('10.0.0.5');
  });

  it('SEC-02: a mixed-case request path dispatches to the lowercase-registered handler', async () => {
    const results = await securityScenario(
      {
        path: PATH_TARGET_VARIANTS.mixedCaseAdminUsers,
        configure: (app: Application) => {
          const admin = createRouter();
          admin.get('/admin/users', (ctx) => {
            ctx.send('handled');
          });
          app.route('/', admin);
        },
      },
      [driver]
    );

    const [{ result }] = [results[0]!];
    // The router still dispatches; whether a path-comparing guard sees the
    // same request is the separate, more severe question the next test
    // covers — this only establishes that case folding lets the mismatched
    // request reach a lowercase-registered handler at all.
    expect(result.status).toBe(200);
    expect(result.text()).toBe('handled');
  });

  it('SEC-02: a naive ctx.path.startsWith() guard never fires for a mixed-case request the router still dispatches', async () => {
    // Reproduces report/security-review.md's exact SEC-02 attack scenario:
    // a global app.use() guard compares raw ctx.path (never folded) against
    // the router, which folds and dispatches anyway — the guard is bypassed.
    const results = await securityScenario(
      {
        path: PATH_TARGET_VARIANTS.mixedCaseAdminUsers,
        configure: (app: Application) => {
          let guardRan = false;
          app.use(async (ctx, next) => {
            if (ctx.path.startsWith('/admin')) {
              guardRan = true;
            }
            await next();
          });
          const admin = createRouter();
          admin.get('/admin/users', (ctx) => {
            ctx.send(guardRan ? 'guarded' : 'bypassed');
          });
          app.route('/', admin);
        },
      },
      [driver]
    );

    const [{ result }] = [results[0]!];
    // The authorization-bypass shape of SEC-02: the handler is reached
    // ('bypassed'), but the raw-path guard never matched.
    expect(result.text()).toBe('bypassed');
  });
});
