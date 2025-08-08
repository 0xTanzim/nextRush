/**
 * 🚀 NextRush v2 Professional Adapter
 * Clean, minimal implementation for benchmarking
 */

import { createApp } from '../../../../v2/dist/index.js';

export class NextRushAdapter {
  private app: any;
  private server: any = null;

  async start(port: number): Promise<void> {
    this.app = createApp({ port });

    // Essential middleware for fair comparison
    this.app.use(this.app.smartBodyParser());

    // Essential routes with NextRush v2 API
    this.app.get('/hello', (ctx: any) => {
      ctx.res.send('Hello World!');
    });

    this.app.get('/json', (ctx: any) => {
      ctx.res.json({ message: 'Hello World!', timestamp: Date.now() });
    });

    this.app.post('/echo', (ctx: any) => {
      ctx.res.json(ctx.body || {});
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
