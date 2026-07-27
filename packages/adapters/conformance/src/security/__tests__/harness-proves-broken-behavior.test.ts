/**
 * RED harness proof (task 2.3): the security scenario helper and fixtures
 * (2.1-2.2) must themselves demonstrate the SEC-01 and SEC-02 findings are
 * currently broken, on every primary adapter, before any fix lands. A harness
 * that cannot see the bug cannot be trusted to prove the fix later.
 */

import { describe, expect, it } from 'vitest';
import { createRouter } from '@nextrush/router';
import type { Application } from '@nextrush/core';
import { primarySecurityDrivers, securityScenario } from '..';
import { FORGED_FORWARDED_CHAINS, PATH_TARGET_VARIANTS } from '..';

describe.each(primarySecurityDrivers())('security harness proves broken behavior [$name]', (driver) => {
  it('SEC-01: a client-forged leftmost X-Forwarded-For entry is currently honored as ctx.ip', async () => {
    const results = await securityScenario(
      {
        path: '/',
        proxy: true,
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

    const [{ result }] = results;
    // The forged value is the leftmost entry, not the real peer — this is the
    // bug (SEC-01). Once RFC-030/WS-B lands, this becomes the direct peer
    // instead, and this assertion must be inverted.
    expect(result.text()).toBe('203.0.113.9');
  });

  it('SEC-01: a rotating leftmost X-Forwarded-For value produces a different ctx.ip per request', async () => {
    const first = await securityScenario(
      {
        path: '/',
        proxy: true,
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
        proxy: true,
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

    // Today, ctx.ip changes with every forged header — the exact mechanism a
    // rate limiter's per-IP key would mint a fresh bucket from (SEC-01).
    expect(first[0].result.text()).not.toBe(second[0].result.text());
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

    const [{ result }] = results;
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

    const [{ result }] = results;
    // The authorization-bypass shape of SEC-02: the handler is reached
    // ('bypassed'), but the raw-path guard never matched.
    expect(result.text()).toBe('bypassed');
  });
});
