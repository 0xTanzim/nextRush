#!/usr/bin/env tsx

import fastify from 'fastify';
import type { Server } from 'node:http';
import type { BenchmarkAdapter } from '../types.js';

export class FastifyMinimalAdapter implements BenchmarkAdapter {
  private app: any;
  private server: Server | null = null;

  async setup(): Promise<{ port: number; server: Server }> {
    this.app = fastify();

    this.app.get('/ping', (_: any, reply: any) => {
      reply.send({ success: true });
    });

    return new Promise(resolve => {
      this.app.listen({ port: 0, host: 'localhost' }, () => {
        this.server = this.app.server;
        const port = (this.server!.address() as any).port;
        resolve({ port, server: this.server! });
      });
    });
  }

  async teardown(): Promise<void> {
    if (this.app) {
      await this.app.close();
    }
  }

  getName(): string {
    return 'Fastify (Minimal)';
  }

  getVersion(): string {
    return '4.24.3';
  }
}
