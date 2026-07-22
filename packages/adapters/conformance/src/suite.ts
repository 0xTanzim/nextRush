/**
 * Reusable cross-adapter conformance suite (testing tier — task group 11.1).
 *
 * The SAME assertions the built-in adapters run, packaged as callable functions
 * so an EXTERNAL adapter author can certify their adapter:
 *
 * ```ts
 * import { describe } from 'vitest';
 * import { defineConformanceSuite } from '@nextrush/adapter-conformance';
 * import { myDriver } from './my-driver';
 * describe('my-adapter conformance', () => defineConformanceSuite(myDriver));
 * ```
 *
 * These functions register `it(...)` cases via vitest (both this package and an
 * external author use vitest), so the caller only wraps them in a `describe`.
 * This is the single source of truth: the internal `conformance-*.test.ts` files
 * delegate here, so a divergence fails everywhere at once.
 *
 * @packageDocumentation
 */

import type { Application } from '@nextrush/core';
import { expect, it } from '@nextrush/adapter-conformance/test-primitives';
import type { ConformanceDriver } from './drivers/types';
import { json } from './support';

/** Request-side behaviors (audit F-01, spec rows #1-#4, #11, #16-#18). */
export function defineRequestConformance(driver: ConformanceDriver): void {
  it('#1 request line: method upper-cased; path split from query', async () => {
    const res = await driver.dispatch((app) => {
      app.use((ctx) => {
        ctx.json({ method: ctx.method, path: ctx.path, url: ctx.url });
      });
    }, { method: 'get', path: '/users/5?x=1' });

    const body = json<{ method: string; path: string; url: string }>(res);
    expect(body.method).toBe('GET');
    expect(body.path).toBe('/users/5');
    expect(body.url).toContain('/users/5');
    expect(body.url).toContain('x=1');
  });

  it('#2 query parsing: repeats become arrays; proto-pollution keys rejected', async () => {
    const res = await driver.dispatch((app) => {
      app.use((ctx) => {
        ctx.json({ a: ctx.query.a, b: ctx.query.b });
      });
    }, { path: '/q?a=1&b=2&b=3&__proto__=evil' });

    const body = json<{ a: string; b: string[] }>(res);
    expect(body.a).toBe('1');
    expect(body.b).toEqual(['2', '3']);
    expect((Object.prototype as Record<string, unknown>).evil).toBeUndefined();
  });

  it('#3 route params: default empty; writable and readable across middleware', async () => {
    const res = await driver.dispatch((app) => {
      app.use(async (ctx) => {
        ctx.state.emptyCount = Object.keys(ctx.params).length;
        ctx.params = { id: '42' };
        await ctx.next();
      });
      app.use((ctx) => {
        ctx.json({ emptyCount: ctx.state.emptyCount, id: ctx.params.id });
      });
    });

    const body = json<{ emptyCount: number; id: string }>(res);
    expect(body.emptyCount).toBe(0);
    expect(body.id).toBe('42');
  });

  it('#4 request headers: ctx.get() is case-insensitive', async () => {
    const res = await driver.dispatch((app) => {
      app.use((ctx) => {
        ctx.json({ lower: ctx.get('x-custom-header'), upper: ctx.get('X-CUSTOM-HEADER') });
      });
    }, { headers: { 'X-Custom-Header': 'val' } });

    const body = json<{ lower: string; upper: string }>(res);
    expect(body.lower).toBe('val');
    expect(body.upper).toBe('val');
  });

  it('#11 body reading: text and json read identically', async () => {
    const textRes = await driver.dispatch((app) => {
      app.use(async (ctx) => {
        ctx.json({ text: await ctx.bodySource.text() });
      });
    }, { method: 'POST', body: 'hello-body', headers: { 'content-type': 'text/plain' } });
    expect(json<{ text: string }>(textRes).text).toBe('hello-body');

    const jsonRes = await driver.dispatch((app) => {
      app.use(async (ctx) => {
        ctx.json({ echo: await ctx.bodySource.json() });
      });
    }, { method: 'POST', body: JSON.stringify({ a: 1 }), headers: { 'content-type': 'application/json' } });
    expect(json<{ echo: { a: number } }>(jsonRes).echo).toEqual({ a: 1 });
  });

  it('#11 body reading: over-limit body → 413 (BodyTooLarge)', async () => {
    const big = 'x'.repeat(1024 * 1024 + 16); // > DEFAULT_BODY_LIMIT (1 MB)
    const res = await driver.dispatch((app) => {
      app.use(async (ctx) => {
        await ctx.bodySource.text();
        ctx.json({ ok: true });
      });
    }, {
      method: 'POST',
      body: big,
      headers: { 'content-length': String(big.length) },
    });
    expect(res.status).toBe(413);
  });

  it('#11 body reading: re-read after stream() → 400 (BodyConsumed)', async () => {
    const res = await driver.dispatch((app) => {
      app.use(async (ctx) => {
        ctx.bodySource.stream();
        await ctx.bodySource.text();
        ctx.json({ ok: true });
      });
    }, { method: 'POST', body: 'data' });
    expect(res.status).toBe(400);
  });

  it('#16 state bag: mutable and shared across middleware', async () => {
    const res = await driver.dispatch((app) => {
      app.use(async (ctx) => {
        ctx.state.user = 'alice';
        await ctx.next();
      });
      app.use((ctx) => {
        ctx.json({ user: ctx.state.user });
      });
    });
    expect(json<{ user: string }>(res).user).toBe('alice');
  });

  it('#17 middleware order: onion (before down, after up)', async () => {
    const res = await driver.dispatch((app) => {
      app.use(async (ctx) => {
        const order: string[] = [];
        ctx.state.order = order;
        order.push('a');
        await ctx.next();
        order.push('d');
        ctx.json(order);
      });
      app.use(async (ctx) => {
        (ctx.state.order as string[]).push('b');
        await ctx.next();
        (ctx.state.order as string[]).push('c');
      });
      app.use(async (ctx) => {
        (ctx.state.order as string[]).push('h');
        await ctx.next();
      });
    });
    expect(json<string[]>(res)).toEqual(['a', 'b', 'h', 'c', 'd']);
  });

  it('#18 extension lifecycle: setup() runs before the handler', async () => {
    const res = await driver.dispatch((app) => {
      let setupDone = false;
      app.extend({ name: 'probe', setup: () => { setupDone = true; } });
      app.use((ctx) => {
        ctx.json({ setupRan: setupDone });
      });
    });
    expect(json<{ setupRan: boolean }>(res).setupRan).toBe(true);
  });

  it('#20 (F-02) streaming: ctx.stream() delivers written chunks concatenated, in order', async () => {
    const res = await driver.dispatch((app) => {
      app.use(async (ctx) => {
        await ctx.stream(async (writer) => {
          await writer.write('alpha-');
          await writer.write('beta-');
          await writer.write('gamma');
        });
      });
    });
    expect(res.text()).toBe('alpha-beta-gamma');
  });

  it('#20 (F-02) SSE: ctx.sse() delivers well-formed text/event-stream events', async () => {
    const res = await driver.dispatch((app) => {
      app.use(async (ctx) => {
        await ctx.sse(async (writer) => {
          await writer.write({ event: 'greeting', data: 'hello' });
          await writer.write({ data: 'world' });
        });
      });
    });
    expect(res.header('content-type')).toContain('text/event-stream');
    const body = res.text();
    expect(body).toContain('event: greeting\ndata: hello\n\n');
    expect(body).toContain('data: world\n\n');
  });
}

/** Response-side behaviors (audit F-01, spec rows #5-#10, #12). */
export function defineResponseConformance(driver: ConformanceDriver): void {
  it('#5/#9 (F-02): ctx.set() headers survive an implicit empty response', async () => {
    const res = await driver.dispatch((app) => {
      app.use((ctx) => {
        ctx.set('X-Custom', 'kept');
        ctx.status = 200;
      });
    });
    expect(res.status).toBe(200);
    expect(res.header('x-custom')).toBe('kept');
    expect(res.text()).toBe('');
  });

  it('#5 (F-02): ctx.set() headers survive a redirect', async () => {
    const res = await driver.dispatch((app) => {
      app.use((ctx) => {
        ctx.set('X-Trace', 't1');
        ctx.redirect('/next');
      });
    });
    expect(res.status).toBe(302);
    expect(res.header('location')).toBe('/next');
    expect(res.header('x-trace')).toBe('t1');
  });

  it('#6 Set-Cookie: an array sets multiple cookies and survives empty responses', async () => {
    const res = await driver.dispatch((app) => {
      app.use((ctx) => {
        ctx.set('Set-Cookie', ['a=1; Path=/', 'b=2; Path=/']);
        ctx.status = 204;
      });
    });
    expect(res.setCookies()).toEqual(['a=1; Path=/', 'b=2; Path=/']);
  });

  it('#6 Set-Cookie: a later array replaces the earlier one', async () => {
    const res = await driver.dispatch((app) => {
      app.use((ctx) => {
        ctx.set('Set-Cookie', ['a=1']);
        ctx.set('Set-Cookie', ['b=2']);
      });
    });
    expect(res.setCookies()).toEqual(['b=2']);
  });

  it('#7 content-type parity: json/send/html carry identical charset (F-16)', async () => {
    const jsonRes = await driver.dispatch((app) => {
      app.use((ctx) => { ctx.json({ ok: true }); });
    });
    expect(jsonRes.header('content-type')).toBe('application/json; charset=utf-8');

    const textRes = await driver.dispatch((app) => {
      app.use((ctx) => { ctx.send('plain'); });
    });
    expect(textRes.header('content-type')).toBe('text/plain; charset=utf-8');

    const htmlRes = await driver.dispatch((app) => {
      app.use((ctx) => { ctx.html('<b>hi</b>'); });
    });
    expect(htmlRes.header('content-type')).toBe('text/html; charset=utf-8');
  });

  it('#8 redirect: default 302, Location set, text/plain body', async () => {
    const res = await driver.dispatch((app) => {
      app.use((ctx) => { ctx.redirect('/dest'); });
    });
    expect(res.status).toBe(302);
    expect(res.header('location')).toBe('/dest');
    expect(res.header('content-type')).toBe('text/plain; charset=utf-8');
    expect(res.text()).toBe('Redirecting to /dest');
  });

  it('#9 empty response: status preserved, no body', async () => {
    const res = await driver.dispatch((app) => {
      app.use((ctx) => {
        ctx.status = 204;
      });
    });
    expect(res.status).toBe(204);
    expect(res.text()).toBe('');
  });

  it('#10 body suppression: HEAD / 204 / 304 never carry a body', async () => {
    const headRes = await driver.dispatch((app) => {
      app.use((ctx) => { ctx.json({ hidden: true }); });
    }, { method: 'HEAD' });
    expect(headRes.text()).toBe('');

    const noContentRes = await driver.dispatch((app) => {
      app.use((ctx) => {
        ctx.status = 204;
        ctx.json({ hidden: true });
      });
    });
    expect(noContentRes.status).toBe(204);
    expect(noContentRes.text()).toBe('');

    const notModifiedRes = await driver.dispatch((app) => {
      app.use((ctx) => {
        ctx.status = 304;
        ctx.send('hidden');
      });
    });
    expect(notModifiedRes.status).toBe(304);
    expect(notModifiedRes.text()).toBe('');
  });

  it('#10 (F-03): HEAD carries a Content-Length equal to the equivalent GET body length', async () => {
    const route = (app: Application): void => {
      app.use((ctx) => {
        ctx.json({ hello: 'world', n: 42, nested: { a: [1, 2, 3] } });
      });
    };

    const getRes = await driver.dispatch(route, { method: 'GET' });
    const headRes = await driver.dispatch(route, { method: 'HEAD' });

    const expectedLength = new TextEncoder().encode(getRes.text()).length;
    expect(headRes.text()).toBe('');
    expect(headRes.header('content-length')).toBe(String(expectedLength));
  });

  it('#12 error propagation: HttpError exposes status+message; unknown → 500, no leak', async () => {
    const thrown = await driver.dispatch((app) => {
      app.use((ctx) => ctx.throw(403, 'Forbidden-XYZ'));
    });
    expect(thrown.status).toBe(403);
    expect(json<{ message: string; status: number }>(thrown).message).toBe('Forbidden-XYZ');
    expect(json<{ status: number }>(thrown).status).toBe(403);

    const unknown = await driver.dispatch((app) => {
      app.use(() => {
        throw new Error('secret-leak-123');
      });
    });
    expect(unknown.status).toBe(500);
    const body = json<{ error: string; message: string }>(unknown);
    expect(body.message).toBe('Internal Server Error');
    expect(unknown.text()).not.toContain('secret-leak-123');
    // F-05: framework-generated error responses carry a uniform Content-Type
    // (application/json; charset=utf-8) on every adapter — no bare application/json.
    expect(unknown.header('content-type')).toBe('application/json; charset=utf-8');
  });
}

/** Runtime behaviors with encoded capability differences (rows #13-#15, #19). */
export function defineRuntimeConformance(driver: ConformanceDriver): void {
  it('#13 timeout: every server/edge/serverless adapter races the handler and returns 504, cancelling via ctx.signal (F-04/F-08)', async () => {
    const result = await driver.timeoutResult();
    if (driver.handlerTimeout504) {
      expect(result).toEqual({ status: 504, signalFired: true });
    } else {
      expect(result).toBeNull();
    }
  });

  it('#15 abort: ctx.signal fires when the transport aborts mid-request', async () => {
    if (driver.transportAbortFiresSignal) {
      expect(await driver.abortFiresSignal()).toBe(true);
    } else {
      // Serverless: buffered event model, no mid-request transport abort;
      // cancellation is timeout-driven (#13). Encoded difference, not a skip.
      expect(await driver.abortFiresSignal()).toBe(false);
    }
  });

  it('#18/#14 lifecycle capability: teardown-on-shutdown is a declared boolean', () => {
    // Teardown is a self-declared capability (server adapters run extension
    // destroy() on close; edge/serverless have no server lifetime, F-14). A
    // reusable suite can only assert the driver DECLARES it — the specific
    // per-adapter values are asserted by the built-in suite, which knows its set.
    expect(typeof driver.teardownOnShutdown).toBe('boolean');
  });

  it('#19 client IP: same precedence + validation across adapters (F-11)', async () => {
    const xff = '203.0.113.9';

    const trusted = await driver.dispatch((app) => {
      app.use((ctx) => { ctx.send(ctx.ip); });
    }, { proxy: true, directIp: '10.0.0.1', headers: { 'x-forwarded-for': `${xff}, 70.41.3.18` } });
    expect(trusted.text()).toBe(xff);

    const untrusted = await driver.dispatch((app) => {
      app.use((ctx) => { ctx.send(ctx.ip); });
    }, { proxy: false, directIp: '10.0.0.1', headers: { 'x-forwarded-for': xff } });
    expect(untrusted.text()).not.toBe(xff);

    const validated = await driver.dispatch((app) => {
      app.use((ctx) => { ctx.send(ctx.ip); });
    }, {
      proxy: true,
      directIp: '10.0.0.1',
      headers: { 'x-forwarded-for': '<script>alert(1)</script>', 'x-real-ip': '198.51.100.2' },
    });
    expect(validated.text()).toBe('198.51.100.2');
  });

  it('#19 client IP: untrusted proxy headers are ignored on every adapter (HP-1 parity)', async () => {
    // trustProxy false → the proxy headers are never consulted; ctx.ip is the
    // platform direct address (identical policy across adapters, differing only
    // in the platform-supplied value: socket for node/deno, clientIp for bun,
    // '' for edge). The invariant asserted here is "not the proxy value".
    const res = await driver.dispatch((app) => {
      app.use((ctx) => { ctx.send(ctx.ip); });
    }, {
      proxy: false,
      directIp: '10.0.0.1',
      headers: { 'x-forwarded-for': '203.0.113.9', 'x-real-ip': '198.51.100.2', 'cf-connecting-ip': '198.51.100.7' },
    });
    expect(res.text()).not.toBe('203.0.113.9');
    expect(res.text()).not.toBe('198.51.100.2');
    expect(res.text()).not.toBe('198.51.100.7');
  });

  it('#19 client IP: Cloudflare cf-connecting-ip precedence is honored only by edge/serverless', async () => {
    // Pins design D2/D5: the edge trim must not drop cf-connecting-ip when
    // trustProxy is true. Edge (and serverless, which reuses the edge context)
    // put cf-connecting-ip at the front; Node/Bun/Deno ignore it and fall to
    // x-forwarded-for. An encoded difference so a future edit can't silently drop it.
    const res = await driver.dispatch((app) => {
      app.use((ctx) => { ctx.send(ctx.ip); });
    }, {
      proxy: true,
      directIp: '10.0.0.1',
      headers: { 'cf-connecting-ip': '198.51.100.7', 'x-forwarded-for': '203.0.113.9' },
    });
    if (driver.honorsCloudflareIp) {
      expect(res.text()).toBe('198.51.100.7');
    } else {
      expect(res.text()).toBe('203.0.113.9');
    }
  });

  it('#17 ctx.next(): tail next() is a resolved no-op (last middleware may await it, then respond)', async () => {
    // HP-7: the innermost middleware's ctx.next() forwards to the composer's
    // terminal thunk, which resolves without throwing. Awaiting it and then
    // responding must succeed identically on every adapter.
    const res = await driver.dispatch((app) => {
      app.use(async (ctx) => {
        await ctx.next();
        ctx.json({ ok: true });
      });
    });
    expect(res.status).toBe(200);
    expect(json<{ ok: boolean }>(res).ok).toBe(true);
  });

  it('#17 ctx.next(): a downstream rejection propagates to an awaiting upstream middleware', async () => {
    // HP-7: ctx.next() returns the dispatch thunk's promise directly, so a
    // downstream throw surfaces as a rejection the upstream `await ctx.next()`
    // can catch — identical across adapters.
    const res = await driver.dispatch((app) => {
      app.use(async (ctx) => {
        try {
          await ctx.next();
        } catch {
          ctx.status = 418;
          ctx.json({ caught: true });
        }
      });
      app.use(() => {
        throw new Error('downstream boom');
      });
    });
    expect(res.status).toBe(418);
    expect(json<{ caught: boolean }>(res).caught).toBe(true);
  });
}

/**
 * The full cross-adapter conformance suite for one driver — request + response
 * + runtime behaviors. External adapter authors wrap this in a `describe`.
 */
export function defineConformanceSuite(driver: ConformanceDriver): void {
  defineRequestConformance(driver);
  defineResponseConformance(driver);
  defineRuntimeConformance(driver);
}
