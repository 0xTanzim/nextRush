/**
 * ⚡ Fastify Framework Adapter
 *
 * High-performance web framework adapter
 */

import { FrameworkAdapter } from '../core/types.js';

export class FastifyAdapter extends FrameworkAdapter {
  readonly frameworkName = 'Fastify';
  readonly packageName = 'fastify';
  readonly dependencies = ['fastify'];

  async createApp(): Promise<void> {
    try {
      const fastify = await import('fastify');
      this.app = fastify.default({ logger: false });
    } catch (error) {
      throw new Error(`Fastify not available: ${error}`);
    }
  }

  async setupRoutes(): Promise<void> {
    if (!this.app) throw new Error('App not created');

    // Simple route
    this.app.get('/simple', async (request: any, reply: any) => {
      return { message: 'Hello, World!' };
    });

    // JSON response
    this.app.get('/json', async (request: any, reply: any) => {
      return {
        timestamp: Date.now(),
        data: { id: 1, name: 'Fastify', version: '4.x' },
        meta: { framework: 'Fastify', test: true },
      };
    });

    // Middleware (hooks in Fastify)
    this.app.addHook('onRequest', async (request: any, reply: any) => {
      (request as any).startTime = Date.now();
    });

    this.app.addHook('preHandler', async (request: any, reply: any) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
    });

    this.app.get('/middleware', async (request: any, reply: any) => {
      return {
        processingTime: Date.now() - (request as any).startTime,
        middlewareStack: 'processed',
      };
    });

    // Parameter parsing
    this.app.get(
      '/users/:id/posts/:postId',
      async (request: any, reply: any) => {
        return {
          userId: request.params.id,
          postId: request.params.postId,
          query: request.query,
        };
      }
    );

    // Error handling
    this.app.get('/error', async (request: any, reply: any) => {
      throw new Error('Test error for benchmarking');
    });

    // Large payload
    const largePayload = {
      data: 'x'.repeat(1024 * 10),
      meta: { size: '10KB', test: true },
      timestamp: Date.now(),
    };
    this.app.get('/large-payload', async (request: any, reply: any) => {
      return largePayload;
    });

    // POST endpoint
    this.app.post('/echo', async (request: any, reply: any) => {
      return { echo: request.body };
    });

    // Complex nested route
    this.app.get(
      '/api/v1/users/:userId/posts/:postId/comments/:commentId',
      async (request: any, reply: any) => {
        return {
          userId: request.params.userId,
          postId: request.params.postId,
          commentId: request.params.commentId,
          nested: true,
        };
      }
    );

    // Static file simulation
    this.app.get('/static/:filename', async (request: any, reply: any) => {
      return {
        filename: request.params.filename,
        size: '1KB',
        type: 'static',
      };
    });

    // Query parameter test
    this.app.get('/search', async (request: any, reply: any) => {
      return {
        query: request.query.q,
        filters: request.query.filter,
        page: parseInt(request.query.page as string) || 1,
        limit: parseInt(request.query.limit as string) || 10,
      };
    });
  }

  async startServer(port: number): Promise<void> {
    this.port = port;
    try {
      await this.app.listen({ port });
      this.isRunning = true;
    } catch (error) {
      throw error;
    }
  }

  async stopServer(): Promise<void> {
    if (this.app) {
      await this.app.close();
      this.isRunning = false;
    }
  }

  getSupportedFeatures(): string[] {
    return [
      'Routing',
      'Hooks (Middleware)',
      'Parameter Parsing',
      'Error Handling',
      'JSON Body Parsing',
      'Schema Validation',
      'Built-in Logging',
      'High Performance',
    ];
  }
}
