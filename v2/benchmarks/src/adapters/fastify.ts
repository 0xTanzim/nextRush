#!/usr/bin/env tsx

/**
 * 🚀 Fastify Benchmark Adapter
 *
 * Comprehensive Fastify server setup for benchmarking
 */

import compress from '@fastify/compress';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import Fastify from 'fastify';

export class FastifyAdapter {
  private app: any;
  private server: any;
  private port: number = 0;

  constructor() {
    this.app = Fastify({
      logger: false,
      trustProxy: true,
    });
    this.setupPlugins();
    this.setupRoutes();
  }

  private async setupPlugins(): Promise<void> {
    // Security plugins
    await this.app.register(helmet);
    await this.app.register(cors);

    // Performance plugins
    await this.app.register(compress);

    // Rate limiting - DISABLED for benchmarks
    // await this.app.register(rateLimit, {
    //   max: 1000,
    //   timeWindow: '15 minutes',
    //   errorResponseBuilder: (req: any, context: any) => ({
    //     code: 429,
    //     error: 'Too Many Requests',
    //     message: `Rate limit exceeded, retry in ${context.after}`,
    //     date: Date.now(),
    //     expiresIn: context.ttl,
    //   }),
    // });

    // Request logging
    this.app.addHook('onResponse', (request: any, reply: any, done: any) => {
      const duration = reply.getResponseTime();
      console.log(
        `← ${new Date().toISOString()} ${request.ip} ${request.method} ${request.url} ${reply.statusCode} ${duration}ms ${reply.getHeader('content-length') || 0}b "${request.headers['user-agent'] || '-'}" "${request.headers.referer || '-'}"`
      );
      done();
    });
  }

  private setupRoutes(): void {
    // Basic API
    this.app.get('/', async (request: any, reply: any) => {
      return {
        message: 'Fastify API',
        version: '4.24.3',
        timestamp: Date.now(),
        uptime: process.uptime(),
      };
    });

    // Health check
    this.app.get('/api/health', async (request: any, reply: any) => {
      return {
        status: 'healthy',
        timestamp: Date.now(),
        memory: process.memoryUsage(),
        uptime: process.uptime(),
      };
    });

    // CRUD operations
    const users = [
      { id: 1, name: 'John Doe', email: 'john@example.com' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
      { id: 3, name: 'Bob Johnson', email: 'bob@example.com' },
    ];

    // List users
    this.app.get('/api/users', async (request: any, reply: any) => {
      return {
        users,
        total: users.length,
        page: 1,
        limit: 10,
      };
    });

    // Get user by ID
    this.app.get('/api/users/:id', async (request: any, reply: any) => {
      const id = parseInt(request.params.id);
      const user = users.find(u => u.id === id);
      if (!user) {
        reply.code(404);
        return { error: 'User not found' };
      }
      return user;
    });

    // Create user
    this.app.post('/api/users', async (request: any, reply: any) => {
      const { name, email } = request.body;
      if (!name || !email) {
        reply.code(400);
        return { error: 'Name and email are required' };
      }
      const newUser = {
        id: users.length + 1,
        name,
        email,
      };
      users.push(newUser);
      reply.code(201);
      return newUser;
    });

    // Update user
    this.app.put('/api/users/:id', async (request: any, reply: any) => {
      const id = parseInt(request.params.id);
      const userIndex = users.findIndex(u => u.id === id);
      if (userIndex === -1) {
        reply.code(404);
        return { error: 'User not found' };
      }
      const { name, email } = request.body;
      users[userIndex] = { ...users[userIndex], name, email };
      return users[userIndex];
    });

    // Search functionality
    this.app.get('/api/search', async (request: any, reply: any) => {
      const { q, page = 1, limit = 20 } = request.query;
      const results = users.filter(
        user =>
          user.name.toLowerCase().includes((q || '').toLowerCase()) ||
          user.email.toLowerCase().includes((q || '').toLowerCase())
      );
      return {
        results,
        total: results.length,
        page: parseInt(page),
        limit: parseInt(limit),
        query: q,
      };
    });

    // Large payload test
    this.app.post('/api/upload', async (request: any, reply: any) => {
      const data = request.body;
      return {
        message: 'Data received',
        size: JSON.stringify(data).length,
        items: Array.isArray(data) ? data.length : 1,
        timestamp: Date.now(),
      };
    });

    // Error handling
    this.app.setErrorHandler((error: any, request: any, reply: any) => {
      console.error('Fastify error:', error);
      reply.code(500).send({
        error: 'Internal server error',
        message: error.message,
        timestamp: Date.now(),
      });
    });

    // 404 handler
    this.app.setNotFoundHandler((request: any, reply: any) => {
      reply.code(404).send({
        error: 'Route not found',
        path: request.url,
        method: request.method,
      });
    });
  }

  async setup(): Promise<{ port: number; server: any }> {
    try {
      await this.app.listen({ port: 0, host: '0.0.0.0' });
      const address = this.app.server.address();
      this.port = (address as any).port;
      this.server = this.app.server;
      console.log(`📡 Fastify server started on port ${this.port}`);
      return { port: this.port, server: this.server };
    } catch (error) {
      console.error('Fastify setup error:', error);
      throw error;
    }
  }

  async teardown(): Promise<void> {
    if (this.app) {
      await this.app.close();
      console.log('🧹 Fastify server shutdown complete');
    }
  }

  getName(): string {
    return 'Fastify';
  }

  getVersion(): string {
    return '4.24.3';
  }
}
