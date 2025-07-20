/**
 * 🏥 Hapi.js Framework Adapter
 *
 * Configuration-centric web framework adapter
 */

import { FrameworkAdapter } from '../core/types.js';

export class HapiAdapter extends FrameworkAdapter {
  readonly frameworkName = 'Hapi';
  readonly packageName = '@hapi/hapi';
  readonly dependencies = ['@hapi/hapi'];

  async createApp(): Promise<void> {
    try {
      const Hapi = await import('@hapi/hapi');
      this.app = Hapi.server({
        port: 0, // Will be set in startServer
        host: 'localhost',
      });
    } catch (error) {
      throw new Error(`Hapi not available: ${error}`);
    }
  }

  async setupRoutes(): Promise<void> {
    if (!this.app) throw new Error('App not created');

    // Simple route
    this.app.route({
      method: 'GET',
      path: '/simple',
      handler: (request: any, h: any) => {
        return { message: 'Hello, World!' };
      },
    });

    // JSON response
    this.app.route({
      method: 'GET',
      path: '/json',
      handler: (request: any, h: any) => {
        return {
          timestamp: Date.now(),
          data: { id: 1, name: 'Hapi', version: '21.x' },
          meta: { framework: 'Hapi', test: true },
        };
      },
    });

    // Middleware (extensions in Hapi)
    this.app.ext('onRequest', (request: any, h: any) => {
      (request as any).startTime = Date.now();
      return h.continue;
    });

    this.app.ext('onPreHandler', async (request: any, h: any) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return h.continue;
    });

    this.app.route({
      method: 'GET',
      path: '/middleware',
      handler: (request: any, h: any) => {
        return {
          processingTime: Date.now() - (request as any).startTime,
          middlewareStack: 'processed',
        };
      },
    });

    // Parameter parsing
    this.app.route({
      method: 'GET',
      path: '/users/{id}/posts/{postId}',
      handler: (request: any, h: any) => {
        return {
          userId: request.params.id,
          postId: request.params.postId,
          query: request.query,
        };
      },
    });

    // Error handling
    this.app.route({
      method: 'GET',
      path: '/error',
      handler: (request: any, h: any) => {
        throw new Error('Test error for benchmarking');
      },
    });

    // Large payload
    const largePayload = {
      data: 'x'.repeat(1024 * 10),
      meta: { size: '10KB', test: true },
      timestamp: Date.now(),
    };
    this.app.route({
      method: 'GET',
      path: '/large-payload',
      handler: (request: any, h: any) => {
        return largePayload;
      },
    });

    // POST endpoint
    this.app.route({
      method: 'POST',
      path: '/echo',
      handler: (request: any, h: any) => {
        return { echo: request.payload };
      },
    });

    // Complex nested route
    this.app.route({
      method: 'GET',
      path: '/api/v1/users/{userId}/posts/{postId}/comments/{commentId}',
      handler: (request: any, h: any) => {
        return {
          userId: request.params.userId,
          postId: request.params.postId,
          commentId: request.params.commentId,
          nested: true,
        };
      },
    });

    // Static file simulation
    this.app.route({
      method: 'GET',
      path: '/static/{filename}',
      handler: (request: any, h: any) => {
        return {
          filename: request.params.filename,
          size: '1KB',
          type: 'static',
        };
      },
    });

    // Query parameter test
    this.app.route({
      method: 'GET',
      path: '/search',
      handler: (request: any, h: any) => {
        return {
          query: request.query.q,
          filters: request.query.filter,
          page: parseInt(request.query.page as string) || 1,
          limit: parseInt(request.query.limit as string) || 10,
        };
      },
    });
  }

  async startServer(port: number): Promise<void> {
    this.port = port;
    this.app.settings.port = port;
    await this.app.start();
    this.isRunning = true;
  }

  async stopServer(): Promise<void> {
    if (this.app) {
      await this.app.stop();
      this.isRunning = false;
    }
  }

  getSupportedFeatures(): string[] {
    return [
      'Routing',
      'Extensions (Middleware)',
      'Parameter Parsing',
      'Error Handling',
      'JSON Body Parsing',
      'Built-in Validation',
      'Security Features',
      'Plugin System',
    ];
  }
}
