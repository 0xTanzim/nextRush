/**
 * 🚀 NextRush v2 Professional Adapter
 * Clean, minimal implementation for benchmarking
 */

import { createApp } from 'nextrush-v2';
import type { Server } from 'node:http';

export class NextRushAdapter {
  private app: any;
  private server: Server | null = null;

  async start(port: number): Promise<void> {
    this.app = createApp({ port });

    // Essential routes only
    this.app.get('/hello', (ctx: any) => {
      ctx.body = 'Hello World!';
    });

    this.app.get('/json', (ctx: any) => {
      ctx.json({ message: 'Hello World!', timestamp: Date.now() });
    });

    this.app.post('/echo', (ctx: any) => {
      ctx.json(ctx.body);
    });

    this.server = await this.app.listen(port);
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
    return 'NextRush v2';
  }
}
