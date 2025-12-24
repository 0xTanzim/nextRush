/**
 * Status Handling Integration Test for NextRush v2
 *
 * @packageDocumentation
 */

import { createApp } from '@/index';
import type { Application, Context } from '@/types/context';
import { AddressInfo } from 'node:net';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';

describe('Status Handling Integration Test', () => {
  let app: Application;
  let server: any;
  let baseUrl: string;

  beforeAll(async () => {
    app = createApp();

    // Test both ways of setting status
    app.get('/status-koa', (ctx: Context) => {
      ctx.status = 500;
      ctx.res.json({ error: 'Koa-style status' });
    });

    app.get('/status-express', (ctx: Context) => {
      ctx.res.status(500).json({ error: 'Express-style status' });
    });

    app.get('/status-both', (ctx: Context) => {
      ctx.status = 404;
      ctx.res.json({ error: 'Both styles work' });
    });

    // Start server
    server = app.listen();
    await new Promise<void>(resolve => {
      server.on('listening', () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://localhost:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  it('should handle Koa-style status setting', async () => {
    const response = await fetch(`${baseUrl}/status-koa`);
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data).toEqual({ error: 'Koa-style status' });
  });

  it('should handle Express-style status setting', async () => {
    const response = await fetch(`${baseUrl}/status-express`);
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data).toEqual({ error: 'Express-style status' });
  });

  it('should handle both styles in same route', async () => {
    const response = await fetch(`${baseUrl}/status-both`);
    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data).toEqual({ error: 'Both styles work' });
  });
});
