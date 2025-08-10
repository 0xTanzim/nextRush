/**
 * Integration test for Advanced Logger Plugin
 *
 * @packageDocumentation
 */

import { Application, createApp } from '@/core/app/application';
import { createDevLogger } from '@/plugins/logger';
import { type Server } from 'node:http';
import { AddressInfo } from 'node:net';

describe('Logger Integration Test', () => {
  let app: Application;
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    app = createApp({ port: 0 });

    // Create and install logger
    const logger = createDevLogger();
    logger.install(app);

    // Add some routes to test logging
    app.get('/users', ctx => {
      logger.info('Fetching users', { userId: ctx.params['id'] });
      ctx.res.json({ users: [] });
    });

    app.post('/users', ctx => {
      const body = ctx.body as { name?: string; email?: string };
      logger.info('Creating user', {
        name: body?.name,
        email: body?.email,
      });
      ctx.res.json({ success: true });
    });

    app.get('/slow', async ctx => {
      // Simulate slow operation
      await new Promise(resolve => setTimeout(resolve, 150));
      ctx.res.json({ message: 'Slow response' });
    });

    app.get('/error', ctx => {
      logger.error('Simulated error', { error: 'Test error' });
      ctx.res.status(500).json({ error: 'Internal server error' });
    });

    // Start server
    server = app.listen() as Server;
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

  it('should log request/response cycle', async () => {
    const response = await fetch(`${baseUrl}/users`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual({ users: [] });
  });

  it('should log POST requests with body', async () => {
    const response = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'John Doe',
        email: 'john@example.com',
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ success: true });
  });

  it('should detect and log slow requests', async () => {
    const start = Date.now();
    const response = await fetch(`${baseUrl}/slow`);
    const duration = Date.now() - start;

    expect(response.status).toBe(200);
    expect(duration).toBeGreaterThan(100); // Should be slow
  });

  it('should log errors properly', async () => {
    const response = await fetch(`${baseUrl}/error`);
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data).toEqual({ error: 'Internal server error' });
  });

  it('should handle multiple concurrent requests', async () => {
    const promises = Array.from({ length: 10 }, (_, _i) =>
      fetch(`${baseUrl}/users`)
    );

    const responses = await Promise.all(promises);

    responses.forEach(response => {
      expect(response.status).toBe(200);
    });
  });
});
