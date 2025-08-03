#!/usr/bin/env tsx

import Koa from 'koa';
import type { Server } from 'node:http';
import type { BenchmarkAdapter } from '../types.js';

export class KoaMinimalAdapter implements BenchmarkAdapter {
  private app: any;
  private server: Server | null = null;

  async setup(): Promise<{ port: number; server: Server }> {
    this.app = new Koa();

    this.app.use(async (ctx: any) => {
      if (ctx.path === '/ping') {
        ctx.body = { success: true };
      }
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
    return 'Koa (Minimal)';
  }

  getVersion(): string {
    return '2.13.4';
  }
}
