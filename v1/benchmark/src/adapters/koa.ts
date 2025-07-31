/**
 * 🕷️ Koa.js Framework Adapter
 *
 * Minimalist web framework adapter
 */

import { FrameworkAdapter } from '../core/types.js';

export class KoaAdapter extends FrameworkAdapter {
  readonly frameworkName = 'Koa';
  readonly packageName = 'koa';
  readonly dependencies = ['koa', '@koa/router', 'koa-bodyparser'];

  private router: any = null;

  async createApp(): Promise<void> {
    try {
      const Koa = await import('koa');
      const Router = await import('@koa/router');
      const bodyParser = await import('koa-bodyparser');

      this.app = new Koa.default();
      this.router = new Router.default();

      this.app.use(bodyParser.default());
      this.app.use(this.router.routes());
      this.app.use(this.router.allowedMethods());
    } catch (error) {
      throw new Error(`Koa not available: ${error}`);
    }
  }

  async setupRoutes(): Promise<void> {
    if (!this.app || !this.router) throw new Error('App not created');

    // Simple route
    this.router.get('/simple', async (ctx: any) => {
      ctx.body = { message: 'Hello, World!' };
    });

    // JSON response
    this.router.get('/json', async (ctx: any) => {
      ctx.body = {
        timestamp: Date.now(),
        data: { id: 1, name: 'Koa', version: '2.x' },
        meta: { framework: 'Koa', test: true },
      };
    });

    // Middleware stack test
    this.app.use(async (ctx: any, next: any) => {
      ctx.startTime = Date.now();
      await next();
    });

    this.app.use(async (ctx: any, next: any) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      await next();
    });

    this.router.get('/middleware', async (ctx: any) => {
      ctx.body = {
        processingTime: Date.now() - ctx.startTime,
        middlewareStack: 'processed',
      };
    });

    // Parameter parsing
    this.router.get('/users/:id/posts/:postId', async (ctx: any) => {
      ctx.body = {
        userId: ctx.params.id,
        postId: ctx.params.postId,
        query: ctx.query,
      };
    });

    // Error handling
    this.router.get('/error', async (ctx: any) => {
      throw new Error('Test error for benchmarking');
    });

    // Large payload
    const largePayload = {
      data: 'x'.repeat(1024 * 10),
      meta: { size: '10KB', test: true },
      timestamp: Date.now(),
    };
    this.router.get('/large-payload', async (ctx: any) => {
      ctx.body = largePayload;
    });

    // POST endpoint
    this.router.post('/echo', async (ctx: any) => {
      ctx.body = { echo: ctx.request.body };
    });

    // Complex nested route
    this.router.get(
      '/api/v1/users/:userId/posts/:postId/comments/:commentId',
      async (ctx: any) => {
        ctx.body = {
          userId: ctx.params.userId,
          postId: ctx.params.postId,
          commentId: ctx.params.commentId,
          nested: true,
        };
      }
    );

    // Static file simulation
    this.router.get('/static/:filename', async (ctx: any) => {
      ctx.body = {
        filename: ctx.params.filename,
        size: '1KB',
        type: 'static',
      };
    });

    // Query parameter test
    this.router.get('/search', async (ctx: any) => {
      ctx.body = {
        query: ctx.query.q,
        filters: ctx.query.filter,
        page: parseInt(ctx.query.page as string) || 1,
        limit: parseInt(ctx.query.limit as string) || 10,
      };
    });

    // Error handling middleware (should be added early)
    this.app.use(async (ctx: any, next: any) => {
      try {
        await next();
      } catch (err: any) {
        ctx.status = 500;
        ctx.body = { error: err.message };
      }
    });
  }

  async startServer(port: number): Promise<void> {
    this.port = port;
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(port, () => {
          this.isRunning = true;
          resolve();
        });
        this.server.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  async stopServer(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.isRunning = false;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getSupportedFeatures(): string[] {
    return [
      'Routing',
      'Async/Await Middleware',
      'Parameter Parsing',
      'Error Handling',
      'JSON Body Parsing',
      'Context Object',
      'Minimal Core',
    ];
  }
}
