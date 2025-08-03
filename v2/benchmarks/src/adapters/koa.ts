#!/usr/bin/env tsx

/**
 * 🚀 Koa.js Benchmark Adapter
 *
 * Comprehensive Koa server setup for benchmarking
 */

import cors from '@koa/cors';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import compress from 'koa-compress';
import helmet from 'koa-helmet';
import rateLimit from 'koa-ratelimit';

export class KoaAdapter {
  private app: Koa;
  private server: any;
  private port: number = 0;

  constructor() {
    this.app = new Koa();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors());

    // Performance middleware
    this.app.use(compress());

    // Rate limiting
    const db = new Map();
    this.app.use(
      rateLimit({
        driver: 'memory',
        db: db,
        duration: 15 * 60 * 1000, // 15 minutes
        max: 1000, // limit each IP to 1000 requests per duration
        errorMessage: 'Too many requests from this IP',
        id: (ctx: any) => ctx.ip,
        headers: {
          remaining: 'X-RateLimit-Remaining',
          reset: 'X-RateLimit-Reset',
          total: 'X-RateLimit-Total',
        },
      })
    );

    // Body parsing
    this.app.use(
      bodyParser({
        enableTypes: ['json', 'form'],
        jsonLimit: '10mb',
        formLimit: '10mb',
      })
    );

    // Request logging
    this.app.use(async (ctx: any, next: any) => {
      const start = Date.now();
      await next();
      const duration = Date.now() - start;
      console.log(
        `← ${new Date().toISOString()} ${ctx.ip} ${ctx.method} ${ctx.path} ${ctx.status} ${duration}ms ${ctx.length || 0}b "${ctx.get('user-agent') || '-'}" "${ctx.get('referer') || '-'}"`
      );
    });
  }

  private setupRoutes(): void {
    // Basic API
    this.app.use(async (ctx: any) => {
      if (ctx.path === '/') {
        ctx.body = {
          message: 'Koa.js API',
          version: '2.14.2',
          timestamp: Date.now(),
          uptime: process.uptime(),
        };
        return;
      }

      // Health check
      if (ctx.path === '/api/health') {
        ctx.body = {
          status: 'healthy',
          timestamp: Date.now(),
          memory: process.memoryUsage(),
          uptime: process.uptime(),
        };
        return;
      }

      // CRUD operations
      const users = [
        { id: 1, name: 'John Doe', email: 'john@example.com' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
        { id: 3, name: 'Bob Johnson', email: 'bob@example.com' },
      ];

      // List users
      if (ctx.path === '/api/users' && ctx.method === 'GET') {
        ctx.body = {
          users,
          total: users.length,
          page: 1,
          limit: 10,
        };
        return;
      }

      // Get user by ID
      if (ctx.path.match(/^\/api\/users\/\d+$/) && ctx.method === 'GET') {
        const id = parseInt(ctx.path.split('/').pop());
        const user = users.find(u => u.id === id);
        if (!user) {
          ctx.status = 404;
          ctx.body = { error: 'User not found' };
          return;
        }
        ctx.body = user;
        return;
      }

      // Create user
      if (ctx.path === '/api/users' && ctx.method === 'POST') {
        const { name, email } = ctx.request.body;
        if (!name || !email) {
          ctx.status = 400;
          ctx.body = { error: 'Name and email are required' };
          return;
        }
        const newUser = {
          id: users.length + 1,
          name,
          email,
        };
        users.push(newUser);
        ctx.status = 201;
        ctx.body = newUser;
        return;
      }

      // Update user
      if (ctx.path.match(/^\/api\/users\/\d+$/) && ctx.method === 'PUT') {
        const id = parseInt(ctx.path.split('/').pop());
        const userIndex = users.findIndex(u => u.id === id);
        if (userIndex === -1) {
          ctx.status = 404;
          ctx.body = { error: 'User not found' };
          return;
        }
        const { name, email } = ctx.request.body;
        users[userIndex] = { ...users[userIndex], name, email };
        ctx.body = users[userIndex];
        return;
      }

      // Search functionality
      if (ctx.path === '/api/search' && ctx.method === 'GET') {
        const { q, page = 1, limit = 20 } = ctx.query;
        const results = users.filter(
          user =>
            user.name.toLowerCase().includes((q || '').toLowerCase()) ||
            user.email.toLowerCase().includes((q || '').toLowerCase())
        );
        ctx.body = {
          results,
          total: results.length,
          page: parseInt(page),
          limit: parseInt(limit),
          query: q,
        };
        return;
      }

      // Large payload test
      if (ctx.path === '/api/upload' && ctx.method === 'POST') {
        const data = ctx.request.body;
        ctx.body = {
          message: 'Data received',
          size: JSON.stringify(data).length,
          items: Array.isArray(data) ? data.length : 1,
          timestamp: Date.now(),
        };
        return;
      }

      // 404 handler
      ctx.status = 404;
      ctx.body = {
        error: 'Route not found',
        path: ctx.path,
        method: ctx.method,
      };
    });

    // Error handling
    this.app.on('error', (err: any, ctx: any) => {
      console.error('Koa error:', err);
      ctx.status = 500;
      ctx.body = {
        error: 'Internal server error',
        message: err.message,
        timestamp: Date.now(),
      };
    });
  }

  async setup(): Promise<{ port: number; server: any }> {
    return new Promise(resolve => {
      this.server = this.app.listen(0, () => {
        const address = this.server.address();
        this.port = (address as any).port;
        console.log(`📡 Koa server started on port ${this.port}`);
        resolve({ port: this.port, server: this.server });
      });
    });
  }

  async teardown(): Promise<void> {
    if (this.server) {
      return new Promise(resolve => {
        this.server.close(() => {
          console.log('🧹 Koa server shutdown complete');
          resolve();
        });
      });
    }
  }

  getName(): string {
    return 'Koa.js';
  }

  getVersion(): string {
    return '2.14.2';
  }
}
