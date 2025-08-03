#!/usr/bin/env tsx

import { createApp } from 'nextrush-v2';
import type { Server } from 'node:http';
import type { BenchmarkAdapter } from '../types.js';

export class NextRushMinimalAdapter implements BenchmarkAdapter {
  private app: any;
  private server: Server | null = null;

  async setup(): Promise<{ port: number; server: Server }> {
    this.app = createApp({
      port: 0,
      host: 'localhost',
      trustProxy: true,
      enableLogging: false,
    });

    this.app.get('/ping', (ctx: any) => {
      ctx.res.json({ success: true });
    });

    this.server = await this.app.listen();

    return new Promise(resolve => {
      const checkServer = () => {
        const address = this.server!.address();
        if (address) {
          const port = (address as any).port;
          resolve({ port, server: this.server! });
        } else {
          setTimeout(checkServer, 50);
        }
      };
      checkServer();
    });
  }

  async teardown(): Promise<void> {
    if (this.server) {
      await this.app.shutdown();
      this.server = null;
    }
  }

  getName(): string {
    return 'NextRush v2 (Minimal)';
  }

  getVersion(): string {
    return '2.0.0-alpha.1';
  }
}
