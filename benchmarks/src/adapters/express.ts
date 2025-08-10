/**
 * 🚀 Express.js Clean Adapter
 * Minimal implementation for fair benchmarking
 */

import express from 'express';

export class ExpressAdapter {
  private app: any;
  private server: any = null;

  constructor() {
    this.app = express();

    // Essential middleware for fair comparison
    this.app.use(express.json());
    this.app.use(express.text());

    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Exactly same responses as other frameworks
    this.app.get('/hello', (_req: any, res: any) => {
      res.send('Hello World!');
    });

    this.app.get('/json', (_req: any, res: any) => {
      res.json({ message: 'Hello World!', timestamp: Date.now() });
    });

    this.app.post('/echo', (req: any, res: any) => {
      res.json(req.body || {});
    });
  }

  async start(port: number): Promise<void> {
    return new Promise(resolve => {
      this.server = this.app.listen(port, resolve);
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  async isReady(): Promise<boolean> {
    return this.server !== null;
  }

  get name(): string {
    return 'Express.js';
  }
}
