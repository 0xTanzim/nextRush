/**
 * 🚄 Express.js Framework Adapter
 *
 * Popular Node.js web framework adapter
 */

import { FrameworkAdapter } from '../core/types.js';

export class ExpressAdapter extends FrameworkAdapter {
  readonly frameworkName = 'Express';
  readonly packageName = 'express';
  readonly dependencies = ['express', '@types/express'];

  async createApp(): Promise<void> {
    const express = await import('express');
    this.app = express.default();
    this.app.use(express.default.json());
  }

  async setupRoutes(): Promise<void> {
    if (!this.app) throw new Error('App not created');

    // Simple route
    this.app.get('/simple', (req: any, res: any) => {
      res.json({ message: 'Hello, World!' });
    });

    // JSON response
    this.app.get('/json', (req: any, res: any) => {
      res.json({
        timestamp: Date.now(),
        data: { id: 1, name: 'Express', version: '4.x' },
        meta: { framework: 'Express', test: true },
      });
    });

    // Middleware stack
    this.app.use((req: any, res: any, next: any) => {
      req.startTime = Date.now();
      next();
    });

    this.app.use(async (req: any, res: any, next: any) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
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
    this.app.get('/error', (req: any, res: any, next: any) => {
      next(new Error('Test error for benchmarking'));
    });

    // Error handler middleware
    this.app.use((err: any, req: any, res: any, next: any) => {
      res.status(500).json({ error: err.message });
    });

    // Large payload
    const largePayload = {
      data: 'x'.repeat(1024 * 10),
      meta: { size: '10KB', test: true },
      timestamp: Date.now(),
    };
    this.app.get('/large-payload', (req: any, res: any) => {
      res.json(largePayload);
    });

    // POST endpoint
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
      'Middleware',
      'Parameter Parsing',
      'Error Handling',
      'JSON Body Parsing',
      'Static Files',
      'Template Engine',
      'Large Ecosystem',
    ];
  }
}
