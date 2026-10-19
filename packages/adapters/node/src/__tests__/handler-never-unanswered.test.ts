/**
 * @nextrush/adapter-node - A request is never left unanswered
 *
 * Driven over a REAL server and socket, because a request that is never
 * answered is only observable there: in-process, "no response yet" and "no
 * response ever" are the same object. Every request here carries a client
 * timeout, so a regression fails the test instead of hanging the suite — the
 * measured pre-fix behaviour of a serialization failure was exactly a socket
 * that never received a byte.
 */

import { createApp, type Application } from '@nextrush/core';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createHandler } from '../adapter';

let server: ReturnType<typeof createServer> | undefined;

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = undefined;
  }
});

interface Observed {
  status: number;
  contentType: string | null;
  body: string;
}

async function request(app: Application, path = '/'): Promise<Observed> {
  server = createServer(createHandler(app, { timeout: 30_000 }));
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', () => resolve()));
  const { port } = server.address() as AddressInfo;

  const res = await fetch(`http://127.0.0.1:${String(port)}${path}`, {
    signal: AbortSignal.timeout(5_000),
  });

  return {
    status: res.status,
    contentType: res.headers.get('content-type'),
    body: await res.text(),
  };
}

describe('a serialization failure is answered rather than left hanging', () => {
  it('answers 500 for a BigInt body', async () => {
    const app = createApp();
    app.use((ctx) => {
      ctx.json({ id: 10n });
    });

    const res = await request(app);

    expect(res.status).toBe(500);
    expect(res.contentType).toBe('application/json; charset=utf-8');
    expect(JSON.parse(res.body)).toMatchObject({ status: 500 });
  });

  it('answers 500 for a value that serializes to nothing', async () => {
    const app = createApp();
    app.use((ctx) => {
      ctx.json(undefined);
    });

    const res = await request(app);

    expect(res.status).toBe(500);
    expect(res.body).not.toBe('');
  });

  it('answers 500 for a circular body', async () => {
    const app = createApp();
    app.use((ctx) => {
      const cyclic: Record<string, unknown> = {};
      cyclic.self = cyclic;
      ctx.json(cyclic);
    });

    const res = await request(app);

    expect(res.status).toBe(500);
    expect(res.body).not.toBe('');
  });
});

describe('the adapter finalizer answers an error status nothing wrote', () => {
  it('answers a handler that set an error status and wrote no body', async () => {
    const app = createApp();
    app.use((ctx) => {
      ctx.status = 503;
    });

    const res = await request(app);

    expect(res.status).toBe(503);
    expect(res.contentType).toBe('application/json; charset=utf-8');
    expect(JSON.parse(res.body)).toEqual({ error: 'Service Unavailable' });
  });

  it('keeps the framework 404 body for an unresponded 404', async () => {
    const app = createApp();
    app.use((ctx) => {
      ctx.status = 404;
    });

    const res = await request(app);

    expect(res.status).toBe(404);
    expect(JSON.parse(res.body)).toEqual({ error: 'Not Found' });
  });

  it('leaves a handler that resolved with a success status and no body empty', async () => {
    const app = createApp();
    app.use(() => undefined);

    const res = await request(app);

    expect(res.status).toBe(200);
    expect(res.contentType).toBe('text/plain; charset=utf-8');
    expect(res.body).toBe('');
  });
});

describe('the application error path answers when the error handler does not', () => {
  it('answers 500 when a custom error handler writes nothing', async () => {
    const app = createApp();
    app.setErrorHandler(() => undefined);
    app.use(() => {
      throw new Error('handler boom');
    });

    const res = await request(app);

    expect(res.status).toBe(500);
    expect(res.contentType).toBe('application/json; charset=utf-8');
    expect(JSON.parse(res.body)).toMatchObject({ status: 500, code: 'INTERNAL_ERROR' });
  });
});
