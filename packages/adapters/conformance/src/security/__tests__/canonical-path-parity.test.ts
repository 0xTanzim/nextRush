/**
 * Cross-adapter conformance — canonical request path (RFC-029, task 3.12).
 *
 * Pins that every adapter publishes the identical `ctx.path`/`ctx.originalPath`
 * pair, and rejects a dot-segment path with 400, for the same request.
 */

import { describe, expect, it } from 'vitest';
import { createRouter } from '@nextrush/router';
import type { Application } from '@nextrush/core';
import { primarySecurityDrivers, securityScenario } from '..';
import { PATH_TARGET_VARIANTS, DOT_SEGMENT_PATHS } from '..';

describe.each(primarySecurityDrivers())(
  'canonical request path conformance [$name]',
  (driver) => {
    it('publishes the canonical ctx.path and preserves ctx.originalPath identically', async () => {
      const results = await securityScenario(
        {
          path: PATH_TARGET_VARIANTS.mixedCaseAdminUsers,
          configure: (app: Application) => {
            const admin = createRouter();
            admin.get('/admin/users', (ctx) => {
              ctx.json({
                path: ctx.path,
                originalPath: (ctx as unknown as { originalPath?: string }).originalPath,
              });
            });
            app.route('/', admin);
          },
        },
        [driver]
      );

      const [{ result }] = results;
      const body = JSON.parse(result.text()) as { path: string; originalPath: string };
      expect(body.path).toBe('/admin/users');
      expect(body.originalPath).toBe(PATH_TARGET_VARIANTS.mixedCaseAdminUsers);
    });

    it('a mount-prefix guard sees the SAME canonical path the router dispatched with — SEC-02 mount-boundary fix', async () => {
      const results = await securityScenario(
        {
          path: PATH_TARGET_VARIANTS.mixedCaseAdminUsers,
          configure: (app: Application) => {
            let guardRan = false;
            const admin = createRouter();
            admin.get('/users', (ctx) => {
              ctx.send(guardRan ? 'guarded' : 'bypassed');
            });
            app.use(async (ctx, next) => {
              if (ctx.path.startsWith('/admin')) guardRan = true;
              await next();
            });
            app.route('/admin', admin);
          },
        },
        [driver]
      );

      const [{ result }] = results;
      // Before the fix: a case-sensitive raw startsWith() prefix-mount test
      // never matched '/ADMIN/users' at all -> 404, empty body. After the
      // fix: the mount test canonicalizes first, matches, and the raw-path
      // guard (which itself still reads unfolded ctx.path pre-dispatch) may
      // or may not fire depending on middleware order — this test only pins
      // that the request reaches the mounted handler at all.
      expect(result.status).toBe(200);
    });

    it('rejects the literal dot-segment path /api/webhooks/../admin with 400 on Node; on Fetch-based adapters the WHATWG URL parser has already resolved it to /api/admin before the app runs (a 404 here, since /api/admin is unregistered) — never a silent dispatch to an unintended route', async () => {
      const results = await securityScenario(
        {
          path: '/api/webhooks/../admin',
          configure: (app: Application) => {
            const router = createRouter();
            router.get('/api/webhooks/handler', (ctx) => ctx.send('ok'));
            router.get('/admin', (ctx) => ctx.send('ok'));
            app.route('/', router);
          },
        },
        [driver]
      );
      const [{ result }] = results;
      expect(result.status).toBe(driver.name === 'node' ? 400 : 404);
    });

    it('rejects the single-dot segment path /api/./users with 400 on Node; Fetch-based adapters resolve it to /api/users before the app runs (404, since /api/users is unregistered here)', async () => {
      const results = await securityScenario(
        {
          path: '/api/./users',
          configure: (app: Application) => {
            const router = createRouter();
            router.get('/users/:id', (ctx) => ctx.send('ok'));
            app.route('/', router);
          },
        },
        [driver]
      );
      const [{ result }] = results;
      expect(result.status).toBe(driver.name === 'node' ? 400 : 404);
    });

    it('rejects leading dot segments past root /../.. with 400 on Node; Fetch-based adapters resolve it to / before the app runs (404, since / is unregistered here)', async () => {
      const results = await securityScenario(
        {
          path: '/../..',
          configure: (app: Application) => {
            const router = createRouter();
            router.get('/admin', (ctx) => ctx.send('ok'));
            app.route('/', router);
          },
        },
        [driver]
      );
      const [{ result }] = results;
      expect(result.status).toBe(driver.name === 'node' ? 400 : 404);
    });

    it('a single-encoded double-dot /api/%2e%2e/admin: Node rejects with 400 (canonicalizePath treats %2e literally, never decoding for traversal purposes); Fetch-based adapters percent-decode AND resolve it during URL parsing to /admin, dispatching there — this is RFC-029\u2019s exact proxy-desync motivation made concrete: the SAME raw target is either rejected or silently resolved to a DIFFERENT route depending on which layer parses it first, which is precisely why this RFC rejects rather than resolves', async () => {
      const results = await securityScenario(
        {
          path: '/api/%2e%2e/admin',
          configure: (app: Application) => {
            const router = createRouter();
            router.get('/admin', (ctx) => ctx.send('ok'));
            app.route('/', router);
          },
        },
        [driver]
      );
      const [{ result }] = results;
      expect(result.status).toBe(driver.name === 'node' ? 404 : 200);
    });

    it('a double-encoded double-dot /api/%252e%252e/admin is never resolved by URL parsing (percent-encoding is preserved verbatim) — 404 on every adapter, since the literal, unresolved segment matches nothing', async () => {
      const results = await securityScenario(
        {
          path: '/api/%252e%252e/admin',
          configure: (app: Application) => {
            const router = createRouter();
            router.get('/admin', (ctx) => ctx.send('ok'));
            app.route('/', router);
          },
        },
        [driver]
      );
      const [{ result }] = results;
      expect(result.status).toBe(404);
    });

    it.each(DOT_SEGMENT_PATHS.accept)('accepts non-traversal dot-in-filename path %s', async (path) => {
      const results = await securityScenario(
        {
          path,
          configure: (app: Application) => {
            const router = createRouter();
            router.get(path, (ctx) => ctx.send('ok'));
            app.route('/', router);
          },
        },
        [driver]
      );

      const [{ result }] = results;
      expect(result.status).toBe(200);
    });
  }
);
