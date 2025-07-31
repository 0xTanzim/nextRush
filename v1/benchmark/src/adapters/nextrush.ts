/**
 * 🚀 NextRush Framework Adapter
 *
 * Zero-dependency framework adapter for benchmarking
 */

import { FrameworkAdapter } from '../core/types.js';

export class NextRushAdapter extends FrameworkAdapter {
  readonly frameworkName = 'NextRush';
  readonly packageName = '../../../dist/index.js'; // Relative to benchmark/dist/adapters/
  readonly dependencies: string[] = [];

  async createApp(): Promise<void> {
    // Import NextRush from parent directory's dist
    const { createApp, PluginMode } = await import(this.packageName);

    // 🚀 PERFORMANCE OPTIMIZATION: Use PERFORMANCE mode for maximum benchmark speed
    // This loads only 4 essential plugins instead of 10-12 plugins
    this.app = createApp({
      pluginMode: PluginMode.PERFORMANCE, // Only essential plugins for max performance
      enableEvents: false, // Disable events for benchmark performance
      enableWebSocket: false, // Disable WebSocket for benchmark performance
      timeout: 30000, // Match other frameworks
      maxRequestSize: 1024 * 1024, // 1MB limit
    });
  }

  async setupRoutes(): Promise<void> {
    if (!this.app) throw new Error('App not created');

    // Simple route
    this.app.get('/simple', (req: any, res: any) => {
      res.json({ message: 'Hello, World!' });
    });

    // JSON response with data
    this.app.get('/json', (req: any, res: any) => {
      res.json({
        timestamp: Date.now(),
        data: { id: 1, name: 'NextRush', version: '3.0' },
        meta: { framework: 'NextRush', test: true },
      });
    });

    // Middleware stack test
    this.app.use((req: any, res: any, next: any) => {
      req.startTime = Date.now();
      next();
    });

    this.app.use(async (req: any, res: any, next: any) => {
      await new Promise((resolve) => setTimeout(resolve, 1)); // Simulate async work
      next();
    });

    this.app.get('/middleware', (req: any, res: any) => {
      res.json({
        processingTime: Date.now() - req.startTime,
        middlewareStack: 'processed',
      });
    });

    // Parameter parsing
    this.app.get('/users/:id/posts/:postId', (req: any, res: any) => {
      res.json({
        userId: req.params.id,
        postId: req.params.postId,
        query: req.query,
      });
    });

    // Error handling
    this.app.get('/error', (req: any, res: any) => {
      res
        .status(500)
        .json({ error: 'Test error for benchmarking', framework: 'NextRush' });
    });

    // Large payload
    const largePayload = {
      data: 'x'.repeat(1024 * 10), // 10KB
      meta: { size: '10KB', test: true },
      timestamp: Date.now(),
    };
    this.app.get('/large-payload', (req: any, res: any) => {
      res.json(largePayload);
    });

    // POST endpoint for body parsing
    this.app.post('/echo', (req: any, res: any) => {
      res.json({ echo: req.body });
    });

    // Complex nested route
    this.app.get(
      '/api/v1/users/:userId/posts/:postId/comments/:commentId',
      (req: any, res: any) => {
        res.json({
          userId: req.params.userId,
          postId: req.params.postId,
          commentId: req.params.commentId,
          nested: true,
        });
      }
    );

    // Static file simulation
    this.app.get('/static/:filename', (req: any, res: any) => {
      res.json({
        filename: req.params.filename,
        size: '1KB',
        type: 'static',
      });
    });

    // Query parameter test
    this.app.get('/search', (req: any, res: any) => {
      res.json({
        query: req.query.q,
        filters: req.query.filter,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
      });
    });
  }

  async startServer(port: number): Promise<void> {
    this.port = port;
    return new Promise((resolve, reject) => {
      try {
        // NextRush listen returns the Application instance, not the server
        this.app.listen(port, () => {
          this.isRunning = true;
          // Access the underlying HTTP server for cleanup
          this.server = (this.app as any).httpServer;
          resolve();
        });
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
      } else if (this.app && typeof this.app.close === 'function') {
        // Use NextRush's close method if server not available
        this.app.close(() => {
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
      'Middleware',
      'Parameter Parsing',
      'Error Handling',
      'JSON Body Parsing',
      'Static Files',
      'WebSocket',
      'Template Engine',
      'Plugin System',
      'Zero Dependencies',
    ];
  }
}
