#!/usr/bin/env tsx

/**
 * NextRush v2 Benchmark Adapter
 *
 * Comprehensive test server with all NextRush v2 features
 */

import { createApp } from 'nextrush-v2';
import type { Server } from 'node:http';
import type { BenchmarkAdapter } from '../types.js';

export class NextRushAdapter implements BenchmarkAdapter {
  private app: any;
  private server: Server | null = null;
  private port: number = 0;

  async setup(): Promise<{ port: number; server: Server }> {
    // Create NextRush v2 application with all features
    this.app = createApp({
      port: 0, // Let OS assign port
      host: 'localhost',
      trustProxy: true,
      enableLogging: false, // Disable for benchmarks
    });

    // Register comprehensive middleware stack
    this.app.use(this.app.cors());
    this.app.use(this.app.helmet());
    this.app.use(this.app.requestId());
    this.app.use(this.app.timer());
    this.app.use(this.app.compression());
    this.app.use(this.app.smartBodyParser());
    this.app.use(this.app.logger());
    this.app.use(this.app.rateLimit());

    // Basic API routes
    this.app.get('/', ctx => {
      ctx.res.json({ message: 'Hello from NextRush v2!' });
    });

    this.app.get('/api/health', ctx => {
      ctx.res.json({ status: 'ok', framework: 'NextRush v2' });
    });

    // CRUD operations
    this.app.get('/api/users', ctx => {
      const users = [
        { id: 1, name: 'John Doe', email: 'john@example.com' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
        { id: 3, name: 'Bob Johnson', email: 'bob@example.com' },
      ];
      ctx.res.json(users);
    });

    this.app.get('/api/users/:id', ctx => {
      const id = parseInt(ctx.params.id);
      if (id === 404) {
        ctx.status = 404;
        ctx.res.json({ error: 'User not found' });
        return;
      }
      ctx.res.json({ id, name: 'John Doe', email: 'john@example.com' });
    });

    this.app.post('/api/users', ctx => {
      const body = ctx.body as { name?: string; email?: string };
      if (!body?.name || !body?.email) {
        ctx.status = 400;
        ctx.res.json({ error: 'Name and email are required' });
        return;
      }
      ctx.res.status(201).json({ id: Date.now(), ...body });
    });

    this.app.put('/api/users/:id', ctx => {
      const id = parseInt(ctx.params.id);
      const body = ctx.body as { name?: string; email?: string };
      ctx.res.json({ id, ...body, updated: true });
    });

    this.app.delete('/api/users/:id', ctx => {
      const id = parseInt(ctx.params.id);
      ctx.status = 204;
    });

    // Complex queries
    this.app.get('/api/search', ctx => {
      const { q, page = '1', limit = '10' } = ctx.query;
      ctx.res.json({
        query: q,
        page: parseInt(page),
        limit: parseInt(limit),
        results: Array(parseInt(limit))
          .fill(null)
          .map((_, i) => ({
            id: i + 1,
            name: `Item ${i + 1}`,
            description: `Description for item ${i + 1}`,
          })),
      });
    });

    // Large payload handling
    this.app.post('/api/upload', ctx => {
      const body = ctx.body as any;
      ctx.res.json({
        received: body ? Object.keys(body).length : 0,
        size: JSON.stringify(body).length,
        status: 'uploaded',
      });
    });

    // Error handling
    this.app.get('/api/error/:type', ctx => {
      const type = ctx.params.type;
      switch (type) {
        case '400':
          ctx.status = 400;
          ctx.res.json({ error: 'Bad Request' });
          break;
        case '404':
          ctx.status = 404;
          ctx.res.json({ error: 'Not Found' });
          break;
        case '500':
          ctx.status = 500;
          ctx.res.json({ error: 'Internal Server Error' });
          break;
        default:
          ctx.res.json({ message: 'No error' });
      }
    });

    // Middleware chain test
    this.app.get('/api/middleware-test', ctx => {
      ctx.res.json({
        headers: ctx.headers,
        ip: ctx.ip,
        method: ctx.method,
        url: ctx.url,
        timestamp: Date.now(),
      });
    });

    // Static file serving (if available)
    try {
      this.app.use('/static', this.app.static('public'));
    } catch (error) {
      // Static files not available in this version
    }

    // Start server
    this.server = await this.app.listen();
    this.port = (this.server.address() as any).port;

    return { port: this.port, server: this.server };
  }

  async teardown(): Promise<void> {
    if (this.server) {
      await this.app.shutdown();
      this.server = null;
    }
  }

  getName(): string {
    return 'NextRush v2';
  }

  getVersion(): string {
    return '2.0.0-alpha.1';
  }
}
