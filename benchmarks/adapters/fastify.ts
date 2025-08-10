/**
 * 🚀 Fastify Clean Adapter
 * Minimal implementation for fair benchmarking
 */

import Fastify from 'fastify';

export class FastifyAdapter {
  private app: any;
  private server: any = null;

  constructor() {
    this.app = Fastify({ logger: false });
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.app.get('/hello', async () => {
      return 'Hello World!';
    });

    this.app.get('/json', async () => {
      return { message: 'Hello World!', timestamp: Date.now() };
    });

    this.app.post('/echo', async (request: any) => {
      return request.body;
    });
  }

  async start(port: number): Promise<void> {
    await this.app.listen({ port, host: '0.0.0.0' });
    this.server = this.app.server;
  }

  async stop(): Promise<void> {
    if (this.app) {
      await this.app.close();
      this.server = null;
    }
  }

  async isReady(): Promise<boolean> {
    return this.server !== null;
  }

  get name(): string {
    return 'Fastify';
  }
}
