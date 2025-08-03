#!/usr/bin/env tsx

import express from 'express';
import type { Server } from 'node:http';
import type { BenchmarkAdapter } from '../types.js';

export class ExpressMinimalAdapter implements BenchmarkAdapter {
  private app: any;
  private server: Server | null = null;

  async setup(): Promise<{ port: number; server: Server }> {
    this.app = express();

    this.app.get('/ping', (_: any, res: any) => {
      res.json({ success: true });
    });

    return new Promise(resolve => {
      this.server = this.app.listen(0, 'localhost', () => {
        const port = (this.server!.address() as any).port;
        resolve({ port, server: this.server! });
      });
    });
  }

  async teardown(): Promise<void> {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  getName(): string {
    return 'Express (Minimal)';
  }

  getVersion(): string {
    return '4.18.2';
  }
}
