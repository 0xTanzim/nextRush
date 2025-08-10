/**
 * 🚀 Koa.js Clean Adapter
 * Minimal implementation for fair benchmarking
 */

import Router from '@koa/router';
import Koa from 'koa';

export class KoaAdapter {
  private app: Koa;
  private server: any = null;

  constructor() {
    this.app = new Koa();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    const router = new Router();

    router.get('/hello', ctx => {
      ctx.body = 'Hello World!';
    });

    router.get('/json', ctx => {
      ctx.body = { message: 'Hello World!', timestamp: Date.now() };
    });

    router.post('/echo', ctx => {
      ctx.body = ctx.request.body;
    });

    this.app.use(router.routes());
    this.app.use(router.allowedMethods());
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
    return 'Koa.js';
  }
}
