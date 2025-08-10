/**
 * 🚀 Express.js Clean Adapter
 * Minimal implementation for fair benchmarking
 */

import express from 'express';
import type { Server } from 'http';

export class ExpressAdapter {
  private app: express.Application;
  private server: Server | null = null;

  constructor() {
    this.app = express();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.app.get('/hello', (req, res) => {
      res.send('Hello World!');
    });

    this.app.get('/json', (req, res) => {
      res.json({ message: 'Hello World!', timestamp: Date.now() });
    });

    this.app.post('/echo', (req, res) => {
      res.json(req.body);
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
