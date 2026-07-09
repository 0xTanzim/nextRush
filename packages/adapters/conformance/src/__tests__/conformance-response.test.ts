/**
 * Cross-adapter conformance — response-side behaviors (audit F-01, spec rows
 * #5-#10, #12). Headline guard: F-02 (headers set via ctx.set() must survive an
 * implicit/empty/redirect response on the Web adapters, matching Node).
 */

import { describe, expect, it } from 'vitest';
import { drivers } from '../drivers';
import { json } from '../support';

describe.each(drivers)('conformance: response behaviors [$name]', (driver) => {
  it('#5/#9 (F-02): ctx.set() headers survive an implicit empty response', async () => {
    const res = await driver.dispatch((app) => {
      app.use((ctx) => {
        ctx.set('X-Custom', 'kept');
        ctx.status = 200; // no body method called
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
        ctx.status = 204; // headers must survive a bodyless response (F-02)
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
      app.use((ctx) => ctx.json({ ok: true }));
    });
    expect(jsonRes.header('content-type')).toBe('application/json; charset=utf-8');

    const textRes = await driver.dispatch((app) => {
      app.use((ctx) => ctx.send('plain'));
    });
    expect(textRes.header('content-type')).toBe('text/plain; charset=utf-8');

    const htmlRes = await driver.dispatch((app) => {
      app.use((ctx) => ctx.html('<b>hi</b>'));
    });
    expect(htmlRes.header('content-type')).toBe('text/html; charset=utf-8');
  });

  it('#8 redirect: default 302, Location set, text/plain body', async () => {
    const res = await driver.dispatch((app) => {
      app.use((ctx) => ctx.redirect('/dest'));
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
    // 1xx uses the same shared isBodylessResponse() guard (runtime-unit-tested)
    // but cannot round-trip as a *final* status over a real Node socket (1xx are
    // interim), so the wire-observable cases HEAD/204/304 are asserted here.
    const headRes = await driver.dispatch((app) => {
      app.use((ctx) => ctx.json({ hidden: true }));
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

  it('#12 error propagation: HttpError exposes status+message; unknown → 500, no leak', async () => {
    const thrown = await driver.dispatch((app) => {
      app.use((ctx) => ctx.throw(403, 'Forbidden-XYZ'));
    });
    expect(thrown.status).toBe(403);
    expect(json<{ error: string }>(thrown).error).toBe('Forbidden-XYZ');

    const unknown = await driver.dispatch((app) => {
      app.use(() => {
        throw new Error('secret-leak-123');
      });
    });
    expect(unknown.status).toBe(500);
    const body = json<{ error: string }>(unknown);
    expect(body.error).toBe('Internal Server Error');
    expect(unknown.text()).not.toContain('secret-leak-123');
  });
});
