/**
 * Body Parser Integration Test
 *
 * Tests the body parser middleware in a real application context
 */

import { createApp } from '@/index';
import type { Application } from '@/types/context';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Body Parser Integration', () => {
  let app: Application;
  let server: any;
  const PORT = 3003;

  beforeAll(async () => {
    app = createApp({
      port: PORT,
      host: 'localhost',
      debug: true,
    });

    // Set up middleware
    app.use(app.json());
    app.use(app.logger());

    // Test route
    app.post('/test', ctx => {
      ctx.res.json({
        received: ctx.body,
        contentType: ctx.req.headers['content-type'],
      });
    });

    server = app.listen(PORT);
  });

  afterAll(async () => {
    if (server) {
      await app.shutdown();
    }
  });

  it('should parse JSON body correctly', async () => {
    const response = await fetch(`http://localhost:${PORT}/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Alice', email: 'alice@example.com' }),
    });

    const data = (await response.json()) as {
      received: { name: string; email: string };
      contentType: string;
    };
    expect(response.status).toBe(200);
    expect(data.received).toEqual({
      name: 'Alice',
      email: 'alice@example.com',
    });
    expect(data.contentType).toBe('application/json');
  });

  it('should handle empty JSON body', async () => {
    const response = await fetch(`http://localhost:${PORT}/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: '',
    });

    const data = (await response.json()) as { received: unknown };
    expect(response.status).toBe(200);
    expect(data.received).toBeUndefined();
  });
});
