/**
 * Cross-adapter conformance — request-side behaviors (audit F-01, spec rows
 * #1-#4, #11, #16-#18). The SAME assertions run against every adapter driver
 * so a divergence in one runtime fails the suite (the project rule "every
 * adapter must behave identically").
 */

import { describe, expect, it } from 'vitest';
import { drivers } from '../drivers';
import { json } from '../support';

describe.each(drivers)('conformance: request behaviors [$name]', (driver) => {
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
      // A real client always sends Content-Length; it lets every adapter reject
      // via the identical content-length pre-check before reading the body.
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
    // Edge has no server lifetime, so destroy()/teardown is intentionally never
    // run (F-14, driver.teardownOnShutdown === false); setup-before-handler is
    // uniform across all four adapters and is what this row guards.
    const res = await driver.dispatch((app) => {
      let setupDone = false;
      app.extend({ name: 'probe', setup: () => { setupDone = true; } });
      app.use((ctx) => {
        ctx.json({ setupRan: setupDone });
      });
    });
    expect(json<{ setupRan: boolean }>(res).setupRan).toBe(true);
  });
});
