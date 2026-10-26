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
 * These functions register test cases through the scenario ledger
 * (`./scenario.ts`) via the runner's own `it` (both this package and an external
 * author use vitest), so the caller only wraps them in a `describe`. That ledger
 * is also what records the PROOF LEVEL of each scenario — real-runtime over a
 * socket, real-runtime in-process, simulated, or not satisfied at all. This is
 * the single source of truth: the internal `conformance-*.test.ts` files delegate
 * here, so a divergence fails everywhere at once.
 *
 * @packageDocumentation
 */

import type { Application } from '@nextrush/core';
import { bodyParser, type BodyParserOptions } from '@nextrush/body-parser';
import { cookies } from '@nextrush/cookies';
import { createRouter } from '@nextrush/router';
import { registerScenario } from './scenario';
import { expect } from '@nextrush/adapter-conformance/test-primitives';
import { OUTGOING_RESPONSE } from '@nextrush/types';
import type { ConformanceDriver } from './drivers/types';
import { json } from './support';

/**
 * Per-run adjustments for the reusable suite.
 *
 * @remarks
 * The suite exercises one body-parser configuration: with no options the
 * middleware runs its documented default (eager parsing). A caller can pass
 * `{ bodyParser: { lazy: true } }` to run the same scenarios through deferred
 * parsing, which proves the two modes are observationally identical instead of
 * trusting the lazy unit tests alone.
 */
export interface ConformanceSuiteOptions {
  /** Options applied to every `bodyParser()` the suite installs. */
  readonly bodyParser?: BodyParserOptions;
}

/** Request-side behaviors (audit F-01, spec rows #1-#4, #11, #16-#18). */
export function defineRequestConformance(driver: ConformanceDriver): void {
  registerScenario(driver, '#1 request line: method upper-cased; path split from query', {}, async () => {
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

  registerScenario(driver, '#2 query parsing: repeats become arrays; proto-pollution keys rejected', {}, async () => {
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

  registerScenario(driver, '#3 route params: default empty; writable and readable across middleware', {}, async () => {
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

  registerScenario(driver, '#3 route params: a case-insensitive match binds the case the client sent', {}, async () => {
    const res = await driver.dispatch((app) => {
      const router = createRouter();
      router.get('/users/:id', (ctx) => {
        ctx.json({ id: ctx.params.id, path: ctx.path });
      });
      app.use(router.routes());
    }, { path: '/Users/ABC123' });

    const body = json<{ id: string; path: string }>(res);
    // The value is data the handler acts on, so it keeps the client's casing...
    expect(body.id).toBe('ABC123');
    // ...while the route decision stays folded, and that folded string is what
    // the app sees on ctx.path.
    expect(body.path).toBe('/users/abc123');
  });

  registerScenario(driver, '#3 route params: a wildcard keeps its case and its inner slashes', {}, async () => {
    const res = await driver.dispatch((app) => {
      const router = createRouter();
      router.get('/files/*', (ctx) => {
        ctx.json({ wildcard: ctx.params['*'] });
      });
      app.use(router.routes());
    }, { path: '/files/Foo/Bar.TXT' });

    expect(json<{ wildcard: string }>(res).wildcard).toBe('Foo/Bar.TXT');
  });

  registerScenario(driver, '#3 route params: a mounted router binds the case the client sent through the mount prefix', {}, async () => {
    const res = await driver.dispatch((app) => {
      const mounted = createRouter();
      mounted.get('/Users/:name', (ctx) => {
        ctx.json({ name: ctx.params.name, path: ctx.path });
      });
      app.route('/API', mounted);
    }, { path: '/API/Users/ABC' });

    const body = json<{ name: string; path: string }>(res);
    // The mount boundary is matched case-insensitively, and the remainder the
    // mounted router then sees must still carry the client's casing — folding it
    // at the boundary would make the value unrecoverable.
    expect(body.name).toBe('ABC');
    expect(body.path).toBe('/users/abc');
  });

  registerScenario(driver, '#4 request headers: ctx.get() is case-insensitive', {}, async () => {
    const res = await driver.dispatch((app) => {
      app.use((ctx) => {
        ctx.json({ lower: ctx.get('x-custom-header'), upper: ctx.get('X-CUSTOM-HEADER') });
      });
    }, { headers: { 'X-Custom-Header': 'val' } });

    const body = json<{ lower: string; upper: string }>(res);
    expect(body.lower).toBe('val');
    expect(body.upper).toBe('val');
  });

  registerScenario(driver, '#11 body reading: text and json read identically', {}, async () => {
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

  registerScenario(driver, '#11 body reading: over-limit body → 413 (BodyTooLarge)', {}, async () => {
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

  registerScenario(driver, '#11 body reading: re-read after stream() → 400 (BodyConsumed)', {}, async () => {
    const res = await driver.dispatch((app) => {
      app.use(async (ctx) => {
        ctx.bodySource.stream();
        await ctx.bodySource.text();
        ctx.json({ ok: true });
      });
    }, { method: 'POST', body: 'data' });
    expect(res.status).toBe(400);
  });

  registerScenario(driver, '#16 state bag: mutable and shared across middleware', {}, async () => {
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

  registerScenario(driver, '#17 middleware order: onion (before down, after up)', {}, async () => {
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

  registerScenario(driver, '#18 extension lifecycle: setup() runs before the handler', {}, async () => {
    const res = await driver.dispatch((app) => {
      let setupDone = false;
      app.extend({ name: 'probe', setup: () => { setupDone = true; } });
      app.use((ctx) => {
        ctx.json({ setupRan: setupDone });
      });
    });
    expect(json<{ setupRan: boolean }>(res).setupRan).toBe(true);
  });

  registerScenario(driver, '#20 (F-02) streaming: ctx.stream() delivers written chunks concatenated, in order', {}, async () => {
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

  registerScenario(driver, '#20 (F-02) SSE: ctx.sse() delivers well-formed text/event-stream events', {}, async () => {
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

  // Socket-required, and the target is written into the request line rather than
  // sent through `fetch`, which resolves a dot segment client-side on every
  // runtime. Two spellings, because a client that spells `..` as `%2e%2e` must not
  // get a different answer than one that spells it literally.
  //
  // The expectation comes from the driver's declared capability rather than from a
  // table kept here: a platform that hands the target over un-reshaped has to
  // reject the segment (400), and one that resolved it before the framework ran
  // answers with the resolved path. Whichever the driver declares, the observed
  // behaviour must agree — so a platform that changes under the framework fails
  // this test instead of quietly turning the rejection into a no-op.
  registerScenario(
    driver,
    '#28 request line: a dot-segment target is rejected where the platform preserves it',
    { socketRequired: true },
    async () => {
      for (const target of ['/files/../admin', '/files/%2e%2e/admin']) {
        const res = await driver.dispatch(
          (app) => {
            // A mounted router, because that is what puts the canonical-path check
            // in the chain: the rejection lives in the routing middleware, which a
            // router-less application never installs. Declaring the resolved path as
            // a route is what makes the platform's answer observable rather than a
            // 404 either way.
            const router = createRouter();
            router.get('/admin', (ctx) => {
              ctx.json({ path: ctx.path });
            });
            app.route('/', router);
          },
          { path: target, verbatimTarget: true }
        );

        if (driver.rawRequestTarget) {
          expect(res.status).toBe(400);
          continue;
        }

        // The platform resolved the segment, or the proxy in front of it did; the
        // framework never saw it, so the documented outcome is the resolved path —
        // and whatever the status, the handler must not have been handed a path
        // that still carries a dot segment.
        expect([200, 400]).toContain(res.status);
        if (res.status === 200) expect(res.text()).not.toContain('..');
      }
    }
  );
}

/** Response-side behaviors (audit F-01, spec rows #5-#10, #12). */
export function defineResponseConformance(
  driver: ConformanceDriver,
  options?: ConformanceSuiteOptions
): void {
  registerScenario(driver, '#5/#9 (F-02): ctx.set() headers survive an implicit empty response', {}, async () => {
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

  registerScenario(driver, '#5 (F-02): ctx.set() headers survive a redirect', {}, async () => {
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

  registerScenario(driver, '#6 Set-Cookie: an array sets multiple cookies and survives empty responses', {}, async () => {
    const res = await driver.dispatch((app) => {
      app.use((ctx) => {
        ctx.set('Set-Cookie', ['a=1; Path=/', 'b=2; Path=/']);
        ctx.status = 204;
      });
    });
    expect(res.setCookies()).toEqual(['a=1; Path=/', 'b=2; Path=/']);
  });

  registerScenario(driver, '#6 Set-Cookie: a later array replaces the earlier one', {}, async () => {
    const res = await driver.dispatch((app) => {
      app.use((ctx) => {
        ctx.set('Set-Cookie', ['a=1']);
        ctx.set('Set-Cookie', ['b=2']);
      });
    });
    expect(res.setCookies()).toEqual(['b=2']);
  });

  registerScenario(driver, '#7 content-type parity: json/send/html carry the shared media types (F-16)', {}, async () => {
    const jsonRes = await driver.dispatch((app) => {
      app.use((ctx) => { ctx.json({ ok: true }); });
    });
    expect(jsonRes.header('content-type')).toBe('application/json');

    const textRes = await driver.dispatch((app) => {
      app.use((ctx) => { ctx.send('plain'); });
    });
    expect(textRes.header('content-type')).toBe('text/plain;charset=UTF-8');

    const htmlRes = await driver.dispatch((app) => {
      app.use((ctx) => { ctx.html('<b>hi</b>'); });
    });
    expect(htmlRes.header('content-type')).toBe('text/html; charset=utf-8');
  });

  registerScenario(driver, '#8 redirect: default 302, Location set, text/plain body', {}, async () => {
    const res = await driver.dispatch((app) => {
      app.use((ctx) => { ctx.redirect('/dest'); });
    });
    expect(res.status).toBe(302);
    expect(res.header('location')).toBe('/dest');
    expect(res.header('content-type')).toBe('text/plain;charset=UTF-8');
    expect(res.text()).toBe('Redirecting to /dest');
  });

  registerScenario(driver, '#9 empty response: status preserved, no body', {}, async () => {
    const res = await driver.dispatch((app) => {
      app.use((ctx) => {
        ctx.status = 204;
      });
    });
    expect(res.status).toBe(204);
    expect(res.text()).toBe('');
  });

  registerScenario(driver, '#10 body suppression: HEAD / 204 / 304 never carry a body', {}, async () => {
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

  registerScenario(driver, '#10 (F-03): HEAD carries a Content-Length equal to the equivalent GET body length', {}, async () => {
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

  registerScenario(driver, '#12 error propagation: HttpError exposes status+message; unknown → 500, no leak', {}, async () => {
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
    // F-05: framework-generated error responses carry one media type on every
    // adapter. JSON has no `charset` parameter (RFC 8259 §8.1), and the bare
    // value is what Deno's static-response fast path accepts.
    expect(unknown.header('content-type')).toBe('application/json');
  });

  registerScenario(driver, '#5/#12 serialization failure: a body JSON cannot represent is answered, never left empty', {}, async () => {
    let cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const cases: readonly [label: string, body: unknown][] = [
      ['a BigInt', { id: 10n }],
      ['a circular structure', cyclic],
    ];

    for (const [label, body] of cases) {
      const res = await driver.dispatch((app) => {
        app.use((ctx) => {
          ctx.json(body);
        });
      });

      expect(res.status, label).toBe(500);
      expect(res.header('content-type'), label).toBe('application/json');
      expect(res.text(), label).not.toBe('');
    }
    cyclic = {};
  });

  registerScenario(driver, '#5/#12 serialization failure: a body that serializes to nothing is rejected, not sent as 200', {}, async () => {
    const res = await driver.dispatch((app) => {
      app.use((ctx) => {
        ctx.json(undefined);
      });
    });

    expect(res.status).not.toBe(200);
    expect(res.text()).not.toBe('');
  });

  registerScenario(driver, '#12 the error path answers when the error handler writes nothing', {}, async () => {
    const res = await driver.dispatch((app) => {
      app.setErrorHandler(() => undefined);
      app.use(() => {
        throw new Error('handler boom');
      });
    });

    expect(res.status).toBe(500);
    expect(res.header('content-type')).toBe('application/json');
    expect(json<{ status: number }>(res).status).toBe(500);
    expect(res.text()).not.toBe('');
  });

  registerScenario(driver, '#12 the error path answers when the error handler itself throws', {}, async () => {
    const res = await driver.dispatch((app) => {
      app.setErrorHandler(() => {
        throw new Error('error handler boom');
      });
      app.use(() => {
        throw new Error('handler boom');
      });
    });

    expect(res.status).toBe(500);
    expect(json<{ status: number }>(res).status).toBe(500);
  });

  registerScenario(driver, '#12 an error status that nothing wrote is answered with the framework body', {}, async () => {
    const res = await driver.dispatch((app) => {
      app.use((ctx) => {
        ctx.status = 503;
      });
    });

    expect(res.status).toBe(503);
    expect(res.header('content-type')).toBe('application/json');
    expect(json<{ error: string }>(res).error).toBe('Service Unavailable');
  });

  registerScenario(driver, '#12 a success status that nothing wrote stays the documented empty response', {}, async () => {
    const res = await driver.dispatch((app) => {
      app.use(() => undefined);
    });

    expect(res.status).toBe(200);
    expect(res.text()).toBe('');
  });

  registerScenario(
    driver,
    '#16 an entry point built before the application booted still routes a declared route (F-02)',
    {},
    async () => {
      const res = await driver.dispatch(
        (app) => {
          app.get('/booted', (ctx) => {
            ctx.json({ booted: true });
          });
        },
        { beforeBoot: true, path: '/booted' }
      );

      expect(res.status).toBe(200);
      expect(json<{ booted: boolean }>(res).booted).toBe(true);
    }
  );

  registerScenario(
    driver,
    '#16 an entry point built before the application booted answers 404 for an unrouted path (F-02)',
    {},
    async () => {
      const res = await driver.dispatch(
        (app) => {
          app.get('/booted', (ctx) => {
            ctx.json({ booted: true });
          });
        },
        { beforeBoot: true, path: '/definitely-unrouted' }
      );

      expect(res.status).toBe(404);
      expect(json<{ error: string }>(res).error).toBe('Not Found');
    }
  );

  registerScenario(
    driver,
    '#12 (F-V07, F-V08): a malformed JSON body answers one error body on every adapter',
    {},
    async () => {
      const res = await driver.dispatch(
        (app) => {
          app.use(bodyParser(options?.bodyParser));
          app.use(async (ctx) => {
            ctx.json({ parsed: await ctx.readBody() });
          });
        },
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{ "unterminated": ',
        }
      );

      // Byte-for-byte the same body wherever the request runs: the message is a
      // framework constant, not the engine's own parse text, and the 4xx reports
      // its own code rather than reading to a client like a server fault.
      expect(res.status).toBe(400);
      expect(res.header('content-type')).toBe('application/json');
      expect(res.text()).toBe(
        '{"error":"BodyParserError","message":"Invalid JSON","code":"INVALID_JSON","status":400}'
      );
    }
  );

  registerScenario(
    driver,
    '#12 (F-V09): the rejecting policy answers 415 for an unparsed content type before the handler runs',
    {},
    async () => {
      let handlerRan = false;

      const res = await driver.dispatch(
        (app) => {
          app.use(bodyParser({ ...options?.bodyParser, onUnsupportedContentType: 'reject' }));
          app.use(async (ctx) => {
            handlerRan = true;
            ctx.json({ parsed: await ctx.readBody() });
          });
        },
        {
          method: 'POST',
          headers: { 'content-type': 'application/xml' },
          body: '<note/>',
        }
      );

      expect(res.status).toBe(415);
      expect(handlerRan).toBe(false);
      expect(json<{ code: string }>(res).code).toBe('UNSUPPORTED_CONTENT_TYPE');
    }
  );

  registerScenario(
    driver,
    "#12 the default policy leaves an unparsed content type to the handler, as it always has",
    {},
    async () => {
      const res = await driver.dispatch(
        (app) => {
          app.use(bodyParser(options?.bodyParser));
          app.use(async (ctx) => {
            ctx.json({ body: (await ctx.readBody()) ?? null });
          });
        },
        {
          method: 'POST',
          headers: { 'content-type': 'application/xml' },
          body: '<note/>',
        }
      );

      expect(res.status).toBe(200);
      expect(json<{ body: unknown }>(res).body).toBeNull();
    }
  );

  // The two response models diverge on exactly this: writing a header after the
  // handler has responded. The expectation comes from the driver's declared
  // capability, not from a table kept here, so an adapter that changes under the
  // framework fails this scenario instead of silently flipping — the same shape
  // as the dot-segment scenario above.
  registerScenario(
    driver,
    '#29 middleware: a header written after the handler responds reaches the client',
    {},
    async () => {
      const res = await driver.dispatch((app) => {
        app.use(async (ctx, next) => {
          await next();
          // Every adapter records the response and flushes it once the chain
          // unwinds, so this write must land — and must not throw (RFC-041
          // §3.1.1: a discarded write is reported, never thrown).
          ctx.set('X-Late-Header', 'written-after-handler');
        });
        app.use((ctx) => {
          ctx.json({ ok: true });
        });
      });

      expect(res.status).toBe(200);
      expect(res.header('x-late-header')).toBe('written-after-handler');
      expect(json<{ ok: boolean }>(res).ok).toBe(true);
    }
  );

  // ---- RFC-048: per-call response status and headers ---------------------

  registerScenario(driver, '#48 a numeric status applies to the response', {}, async () => {
    const res = await driver.dispatch((app) => {
      app.use((ctx) => {
        ctx.json({ id: 'u_123' }, 201);
      });
    });

    expect(res.status).toBe(201);
    expect(res.header('content-type')).toBe('application/json');
    expect(json<{ id: string }>(res).id).toBe('u_123');
  });

  registerScenario(driver, '#48 an options status applies to the response', {}, async () => {
    const res = await driver.dispatch((app) => {
      app.use((ctx) => {
        ctx.json({ id: 'u_123' }, { status: 202 });
      });
    });

    expect(res.status).toBe(202);
    expect(json<{ id: string }>(res).id).toBe('u_123');
  });

  registerScenario(driver, '#48 an explicit status beats a previously assigned status', {}, async () => {
    const res = await driver.dispatch((app) => {
      app.use((ctx) => {
        ctx.status = 200;
        ctx.json({ ok: true }, 201);
      });
    });

    expect(res.status).toBe(201);
  });

  registerScenario(driver, '#48 an omitted status keeps the carried status', {}, async () => {
    const res = await driver.dispatch((app) => {
      app.use((ctx) => {
        ctx.status = 201;
        ctx.json({ ok: true });
      });
    });

    expect(res.status).toBe(201);
  });

  registerScenario(driver, '#48 every response helper accepts an explicit status', {}, async () => {
    const jsonRes = await driver.dispatch((app) => {
      app.use((ctx) => {
        ctx.json({ ok: true }, 201);
      });
    });
    expect(jsonRes.status).toBe(201);

    const htmlRes = await driver.dispatch((app) => {
      app.use((ctx) => {
        ctx.html('<b>hi</b>', { status: 202 });
      });
    });
    expect(htmlRes.status).toBe(202);
    expect(htmlRes.header('content-type')).toBe('text/html; charset=utf-8');

    const sendRes = await driver.dispatch((app) => {
      app.use((ctx) => {
        ctx.send('body', { status: 203 });
      });
    });
    expect(sendRes.status).toBe(203);
    expect(sendRes.text()).toBe('body');
  });

  registerScenario(driver, '#48 the effective status is visible to post-handler middleware', {}, async () => {
    const res = await driver.dispatch((app) => {
      app.use(async (ctx, next) => {
        await next();
        ctx.set('X-Observed-Status', String(ctx.status));
      });
      app.use((ctx) => {
        ctx.json({ ok: true }, { status: 202 });
      });
    });

    expect(res.status).toBe(202);
    expect(res.header('x-observed-status')).toBe('202');
  });

  registerScenario(driver, '#48 an invalid status is rejected before commit and the error handler answers', {}, async () => {
    const cases: readonly (number | { status: number })[] = [99, 600, 201.5];
    for (const invalid of cases) {
      const res = await driver.dispatch((app) => {
        app.use((ctx) => {
          ctx.json({ ok: true }, invalid);
        });
      });

      expect(res.status).toBe(500);
      expect(res.text()).not.toBe('');
    }
  });

  registerScenario(driver, '#48 supplied headers merge, override and accumulate', {}, async () => {
    const res = await driver.dispatch((app) => {
      app.use((ctx) => {
        ctx.set('X-Cache', 'old');
        ctx.set('Set-Cookie', 'a=1; Path=/');
        ctx.json(
          { ok: true },
          { headers: { 'X-Cache': 'new', 'Set-Cookie': 'b=2; Path=/' } }
        );
      });
    });

    expect(res.header('x-cache')).toBe('new');
    expect(res.setCookies()).toEqual(['a=1; Path=/', 'b=2; Path=/']);
  });

  registerScenario(driver, '#48 an array header replaces the field then appends', {}, async () => {
    const res = await driver.dispatch((app) => {
      app.use((ctx) => {
        ctx.set('Set-Cookie', 'a=1; Path=/');
        ctx.json(
          { ok: true },
          { headers: { 'Set-Cookie': ['b=2; Path=/', 'c=3; Path=/'] } }
        );
      });
    });

    expect(res.setCookies()).toEqual(['b=2; Path=/', 'c=3; Path=/']);
  });

  registerScenario(driver, '#48 a supplied Content-Type overrides the helper media type', {}, async () => {
    const res = await driver.dispatch((app) => {
      app.use((ctx) => {
        ctx.json({ ok: true }, { headers: { 'Content-Type': 'application/vnd.api+json' } });
      });
    });

    expect(res.header('content-type')).toBe('application/vnd.api+json');
  });

  registerScenario(driver, '#48 a supplied Content-Length is rejected before commit', {}, async () => {
    const res = await driver.dispatch((app) => {
      app.use((ctx) => {
        ctx.json({ ok: true }, { headers: { 'Content-Length': '10' } });
      });
    });

    expect(res.status).toBe(500);
  });

  registerScenario(driver, '#48 an invalid header name is rejected before commit', {}, async () => {
    const res = await driver.dispatch((app) => {
      app.use((ctx) => {
        ctx.json({ ok: true }, { headers: { 'Bad Header': 'x' } });
      });
    });

    expect(res.status).toBe(500);
  });

  registerScenario(driver, '#48 supplied headers survive a bodyless status', {}, async () => {
    const res = await driver.dispatch((app) => {
      app.use((ctx) => {
        ctx.json({ hidden: true }, { status: 204, headers: { 'Cache-Control': 'no-store' } });
      });
    });

    expect(res.status).toBe(204);
    expect(res.header('cache-control')).toBe('no-store');
    expect(res.text()).toBe('');
  });

  registerScenario(driver, '#48 204 and 304 supplied as numbers suppress the body', {}, async () => {
    const noContentRes = await driver.dispatch((app) => {
      app.use((ctx) => {
        ctx.json({ hidden: true }, 204);
      });
    });
    expect(noContentRes.status).toBe(204);
    expect(noContentRes.text()).toBe('');

    const notModifiedRes = await driver.dispatch((app) => {
      app.use((ctx) => {
        ctx.json({ hidden: true }, { status: 304 });
      });
    });
    expect(notModifiedRes.status).toBe(304);
    expect(notModifiedRes.text()).toBe('');
  });

  registerScenario(driver, '#48 HEAD stays bodyless with an explicit status', {}, async () => {
    const res = await driver.dispatch(
      (app) => {
        app.use((ctx) => {
          ctx.json({ ok: true }, 201);
        });
      },
      { method: 'HEAD' }
    );

    expect(res.status).toBe(201);
    expect(res.text()).toBe('');
  });

  registerScenario(driver, '#48 a helper call after the response was committed changes nothing', {}, async () => {
    const res = await driver.dispatch((app) => {
      app.use((ctx) => {
        ctx.json({ ok: true });
        ctx.json({ late: true }, { status: 500 });
      });
    });

    expect(res.status).toBe(200);
    expect(json<{ ok: boolean }>(res).ok).toBe(true);
  });
}

/** Runtime behaviors with encoded capability differences (rows #13-#15, #19). */
export function defineRuntimeConformance(driver: ConformanceDriver): void {
  registerScenario(driver, '#13 timeout: every server/edge/serverless adapter races the handler and returns 504, cancelling via ctx.signal (F-04/F-08)', {}, async () => {
    const result = await driver.timeoutResult();
    if (driver.handlerTimeout504) {
      expect(result).toEqual({ status: 504, signalFired: true });
    } else {
      expect(result).toBeNull();
    }
  });

  registerScenario(driver, '#30 timeout: a response the handler already committed outlives the handler timeout', {}, async () => {
    // The 504 is reserved for a request that produced nothing: a handler that
    // answered and then ran past the timeout must still have its response
    // delivered on every adapter. Restoring the Web 504 path fails this.
    const result = await driver.committedResponseOutlivesTimeout();
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true });
  });

  registerScenario(
    driver,
    '#31 middleware: a body rewritten after the handler is the body the client receives',
    {},
    async () => {
      // The counterpart to #29 for the body: a response-rewriting middleware
      // (compression is the shipped one) must be able to replace the recorded
      // body after the handler ran, and the flushed response must describe the
      // replacement — never the body it replaced.
      const original = JSON.stringify({ original: 'this body must not reach the client' });
      const replacement = JSON.stringify({ rewritten: true });
      const replacementLength = new TextEncoder().encode(replacement).byteLength;

      const res = await driver.dispatch((app) => {
        app.use(async (ctx, next) => {
          await next();
          const record = ctx[OUTGOING_RESPONSE];
          expect(record).toBeDefined();
          record?.setBody(replacement);
        });
        app.use((ctx) => {
          // A stale length for the original body: the replacement must not
          // inherit it, or the client would read a truncated response.
          ctx.set('Content-Length', String(new TextEncoder().encode(original).byteLength));
          ctx.json({ original: 'this body must not reach the client' });
        });
      });

      expect(res.status).toBe(200);
      expect(res.header('content-type')).toContain('application/json');
      expect(res.text()).toBe(replacement);

      // Frames the replacement when the adapter reports a length; a Web adapter
      // that lets the platform frame the body omits it here. Either way it must
      // never be the replaced body's length.
      const declared = res.header('content-length');
      if (declared !== undefined) expect(declared).toBe(String(replacementLength));
    }
  );

  registerScenario(driver, '#15 abort: ctx.signal fires when the transport aborts mid-request', {}, async () => {
    if (driver.transportAbortFiresSignal) {
      expect(await driver.abortFiresSignal()).toBe(true);
    } else {
      // Serverless: buffered event model, no mid-request transport abort;
      // cancellation is timeout-driven (#13). Encoded difference, not a skip.
      expect(await driver.abortFiresSignal()).toBe(false);
    }
  });

  registerScenario(driver, '#18/#14 lifecycle capability: teardown-on-shutdown is a declared boolean', {}, () => {
    // Teardown is a self-declared capability (server adapters run extension
    // destroy() on close; edge/serverless have no server lifetime, F-14). A
    // reusable suite can only assert the driver DECLARES it — the specific
    // per-adapter values are asserted by the built-in suite, which knows its set.
    expect(typeof driver.teardownOnShutdown).toBe('boolean');
  });

  registerScenario(driver, '#19 client IP: same precedence + validation across adapters (F-11)', {}, async () => {
    const xff = '203.0.113.9';

    const trusted = await driver.dispatch((app) => {
      app.use((ctx) => { ctx.send(ctx.ip); });
    }, { proxy: 1, directIp: '10.0.0.1', headers: { 'x-forwarded-for': `${xff}, 70.41.3.18` } });
    // proxy: 1 (one trusted hop) resolves the rightmost entry — the address
    // the trusted hop itself observed — never the client-authored leftmost
    // entry (SEC-01/RFC-030).
    expect(trusted.text()).toBe('70.41.3.18');
    expect(trusted.text()).not.toBe(xff);

    const untrusted = await driver.dispatch((app) => {
      app.use((ctx) => { ctx.send(ctx.ip); });
    }, { proxy: false, directIp: '10.0.0.1', headers: { 'x-forwarded-for': xff } });
    expect(untrusted.text()).not.toBe(xff);

    const validated = await driver.dispatch((app) => {
      app.use((ctx) => { ctx.send(ctx.ip); });
    }, {
      proxy: 1,
      directIp: '10.0.0.1',
      headers: { 'x-forwarded-for': '<script>alert(1)</script>', 'x-real-ip': '198.51.100.2' },
    });
    expect(validated.text()).toBe('198.51.100.2');
  });

  registerScenario(driver, '#19 client IP: untrusted proxy headers are ignored on every adapter (HP-1 parity)', {}, async () => {
    // proxy: false → the proxy headers are never consulted; ctx.ip is the
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

  registerScenario(driver, '#19 client IP: Cloudflare cf-connecting-ip precedence is honored only by edge/serverless', {}, async () => {
    // Pins design D2/D5: the edge trim must not drop cf-connecting-ip when
    // proxy is a hop count. Edge (and serverless, which reuses the edge context)
    // put cf-connecting-ip at the front; Node/Bun/Deno ignore it and fall to
    // x-forwarded-for. An encoded difference so a future edit can't silently drop it.
    const res = await driver.dispatch((app) => {
      app.use((ctx) => { ctx.send(ctx.ip); });
    }, {
      proxy: 1,
      directIp: '10.0.0.1',
      headers: { 'cf-connecting-ip': '198.51.100.7', 'x-forwarded-for': '203.0.113.9' },
    });
    if (driver.honorsCloudflareIp) {
      expect(res.text()).toBe('198.51.100.7');
    } else {
      expect(res.text()).toBe('203.0.113.9');
    }
  });

  registerScenario(driver, '#17 ctx.next(): tail next() is a resolved no-op (last middleware may await it, then respond)', {}, async () => {
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

  registerScenario(driver, '#17 ctx.next(): a downstream rejection propagates to an awaiting upstream middleware', {}, async () => {
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

  // Socket-required on purpose. Response framing and connection shutdown exist
  // only on a real connection: an in-process `Response` can be read back whole
  // whatever length it claims, so asserting this against one proves nothing. A
  // driver that cannot satisfy the requirement is recorded as not satisfied at
  // real-runtime level rather than credited with a pass.
  registerScenario(
    driver,
    '#25 real listener: a request read from a socket is answered and framed',
    { socketRequired: true },
    async () => {
      const payload = { answered: true, filler: 'x'.repeat(64) };
      const res = await driver.dispatch((app) => {
        app.use((ctx) => {
          ctx.json(payload);
        });
      });

      expect(res.status).toBe(200);
      expect(res.text()).toBe(JSON.stringify(payload));
      expect(res.header('content-length')).toBe(
        String(new TextEncoder().encode(res.text()).length)
      );
    }
  );
}

/**
 * Cookie capability behaviors (RFC-034): the uninitialized diagnostic and the
 * activated store must be observable-identical on every adapter.
 */
export function defineCookieConformance(driver: ConformanceDriver): void {
  registerScenario(driver, '#20 cookies: uninitialized ctx.cookies throws the diagnostic on every adapter', {}, async () => {
    const res = await driver.dispatch((app) => {
      app.use((ctx) => {
        try {
          ctx.cookies.get('session');
          ctx.json({ reached: true });
        } catch {
          ctx.json({ reached: false });
        }
      });
    });
    const body = json<{ reached: boolean }>(res);
    expect(body.reached).toBe(false);
  });

  registerScenario(driver, '#21 cookies: activation parses the Cookie header identically', {}, async () => {
    const res = await driver.dispatch((app) => {
      app.use(cookies());
      app.use((ctx) => {
        ctx.json({ a: ctx.cookies.get('a'), b: ctx.cookies.get('b') });
      });
    }, { headers: { cookie: 'a=1; b=2' } });
    const body = json<{ a: string; b: string }>(res);
    expect(body.a).toBe('1');
    expect(body.b).toBe('2');
  });

  registerScenario(driver, '#22 cookies: set() accumulates multiple Set-Cookie headers', {}, async () => {
    const res = await driver.dispatch((app) => {
      app.use(cookies());
      app.use((ctx) => {
        ctx.cookies.set('a', '1', { httpOnly: true });
        ctx.cookies.set('b', '2', { httpOnly: true });
        ctx.json({ ok: true });
      });
    });
    const setCookies = res.setCookies();
    expect(setCookies.some((c) => c.startsWith('a=1'))).toBe(true);
    expect(setCookies.some((c) => c.startsWith('b=2'))).toBe(true);
  });

  registerScenario(driver, '#23 cookies: delete() emits an expiring cookie with matching scope', {}, async () => {
    const res = await driver.dispatch((app) => {
      app.use(cookies());
      app.use((ctx) => {
        ctx.cookies.delete('session', { path: '/' });
        ctx.json({ ok: true });
      });
    }, { headers: { cookie: 'session=x' } });
    const setCookies = res.setCookies();
    expect(setCookies.some((c) => c.startsWith('session=') && c.includes('Max-Age=0'))).toBe(true);
  });

  registerScenario(driver, '#24 cookies: read-after-write is visible in the same request', {}, async () => {
    const res = await driver.dispatch((app) => {
      app.use(cookies());
      app.use((ctx) => {
        ctx.cookies.set('a', '1');
        ctx.json({ a: ctx.cookies.get('a'), has: ctx.cookies.has('a') });
      });
    });
    const body = json<{ a: string; has: boolean }>(res);
    expect(body.a).toBe('1');
    expect(body.has).toBe(true);
  });
}

/**
 * The full cross-adapter conformance suite for one driver — request + response
 * + runtime behaviors. External adapter authors wrap this in a `describe`.
 *
 * Pass `options` to run the same scenarios against a different body-parser
 * configuration (e.g. `{ bodyParser: { lazy: true } }`); omitting it keeps the
 * suite on the default eager parser.
 */
export function defineConformanceSuite(
  driver: ConformanceDriver,
  options?: ConformanceSuiteOptions
): void {
  defineRequestConformance(driver);
  defineResponseConformance(driver, options);
  defineRuntimeConformance(driver);
  defineCookieConformance(driver);
}
