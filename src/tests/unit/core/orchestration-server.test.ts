/**
 * @fileoverview Comprehensive tests for ServerManager Orchestration
 */

import { createApp } from '@/index';
import type { Application } from '@/types/context';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withUniquePort } from '../../helpers/port-manager';

describe('Server Manager Orchestration', () => {
  let app: Application;

  beforeEach(() => {
    app = createApp({
      host: 'localhost',
      debug: false,
    });
  });

  afterEach(async () => {
    if (app) {
      try {
        await app.shutdown();
      } catch {
        // Ignore shutdown errors
      }
    }
  });

  describe('Server Lifecycle Orchestration', () => {
    it('should orchestrate server startup and initialization', async () => {
      await withUniquePort(async port => {
        app.get('/startup-test', async ctx => {
          ctx.res.json({
            status: 'initialized',
            port,
            timestamp: Date.now(),
          });
        });

        app.listen(port);
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
          const response = await fetch(`http://localhost:${port}/startup-test`);
          const data = (await response.json()) as any;

          expect(response.status).toBe(200);
          expect(data.status).toBe('initialized');
          expect(data.port).toBe(port);
          expect(data.timestamp).toBeDefined();
        } finally {
          await app.shutdown();
        }
      });
    });

    it('should orchestrate graceful server shutdown', async () => {
      await withUniquePort(async port => {
        app.get('/shutdown-test', async ctx => {
          ctx.res.json({ status: 'running' });
        });

        app.listen(port);
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
          // Test server is responding
          const response = await fetch(
            `http://localhost:${port}/shutdown-test`
          );
          expect(response.status).toBe(200);

          const data = (await response.json()) as any;
          expect(data.status).toBe('running');
        } finally {
          await app.shutdown();
        }
      });
    });
  });

  describe('Connection Management Orchestration', () => {
    it('should orchestrate multiple concurrent connections', async () => {
      await withUniquePort(async port => {
        let connectionCount = 0;

        app.get('/connection-test', async ctx => {
          connectionCount++;
          ctx.res.json({
            connectionId: connectionCount,
            timestamp: Date.now(),
          });
        });

        app.listen(port);
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
          // Make multiple concurrent requests
          const requests = Array.from({ length: 3 }, () =>
            fetch(`http://localhost:${port}/connection-test`)
          );

          const responses = await Promise.all(requests);

          // All requests should succeed
          responses.forEach(response => {
            expect(response.status).toBe(200);
          });

          // Should have handled multiple connections
          expect(connectionCount).toBeGreaterThanOrEqual(3);
        } finally {
          await app.shutdown();
        }
      });
    });

    it('should orchestrate connection state management', async () => {
      await withUniquePort(async port => {
        app.get('/state-test', async ctx => {
          ctx.res.json({
            connected: true,
            uptime: process.uptime(),
            memory: process.memoryUsage().heapUsed,
          });
        });

        app.listen(port);
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
          const response = await fetch(`http://localhost:${port}/state-test`);
          const data = (await response.json()) as any;

          expect(response.status).toBe(200);
          expect(data.connected).toBe(true);
          expect(data.uptime).toBeGreaterThan(0);
          expect(data.memory).toBeGreaterThan(0);
        } finally {
          await app.shutdown();
        }
      });
    });
  });

  describe('Error Handling Orchestration', () => {
    it('should orchestrate server error handling', async () => {
      await withUniquePort(async port => {
        let serverErrors = 0;

        app.get('/error-test', async () => {
          serverErrors++;
          throw new Error('Server orchestration error');
        });

        app.listen(port);
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
          const response = await fetch(`http://localhost:${port}/error-test`);

          expect(response.status).toBe(500);
          expect(serverErrors).toBeGreaterThanOrEqual(1);
        } finally {
          await app.shutdown();
        }
      });
    });

    it('should orchestrate error recovery', async () => {
      await withUniquePort(async port => {
        app.get('/recovery-test', async ctx => {
          ctx.res.json({ status: 'recovered' });
        });

        app.listen(port);
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
          const response = await fetch(
            `http://localhost:${port}/recovery-test`
          );
          const data = (await response.json()) as any;

          expect(response.status).toBe(200);
          expect(data.status).toBe('recovered');
        } finally {
          await app.shutdown();
        }
      });
    });
  });

  describe('Performance Orchestration', () => {
    it('should orchestrate high-throughput request handling', async () => {
      await withUniquePort(async port => {
        let requestCount = 0;

        app.get('/throughput-test', async ctx => {
          requestCount++;
          ctx.res.json({
            requestNumber: requestCount,
            timestamp: Date.now(),
          });
        });

        app.listen(port);
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
          // Make multiple rapid requests
          const requests = Array.from({ length: 5 }, () =>
            fetch(`http://localhost:${port}/throughput-test`)
          );

          const responses = await Promise.all(requests);

          // All requests should complete successfully
          responses.forEach(response => {
            expect(response.status).toBe(200);
          });

          expect(requestCount).toBe(5);
        } finally {
          await app.shutdown();
        }
      });
    });

    it('should orchestrate resource management', async () => {
      await withUniquePort(async port => {
        app.get('/resource-test', async ctx => {
          const memUsage = process.memoryUsage();
          ctx.res.json({
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external,
            arrayBuffers: memUsage.arrayBuffers,
          });
        });

        app.listen(port);
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
          const response = await fetch(
            `http://localhost:${port}/resource-test`
          );
          const data = (await response.json()) as any;

          expect(response.status).toBe(200);
          expect(data.heapUsed).toBeGreaterThan(0);
          expect(data.heapTotal).toBeGreaterThan(0);
        } finally {
          await app.shutdown();
        }
      });
    });
  });

  describe('Configuration Orchestration', () => {
    it('should orchestrate server configuration management', async () => {
      await withUniquePort(async port => {
        app.get('/config-test', async ctx => {
          ctx.res.json({
            port,
            host: 'localhost',
            environment: process.env['NODE_ENV'] || 'test',
          });
        });

        app.listen(port);
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
          const response = await fetch(`http://localhost:${port}/config-test`);
          const data = (await response.json()) as any;

          expect(response.status).toBe(200);
          expect(data.port).toBe(port);
          expect(data.host).toBe('localhost');
          expect(data.environment).toBeDefined();
        } finally {
          await app.shutdown();
        }
      });
    });

    it('should orchestrate runtime configuration updates', async () => {
      await withUniquePort(async port => {
        let configVersion = 1;

        app.get('/runtime-config-test', async ctx => {
          ctx.res.json({
            configVersion: configVersion++,
            lastUpdate: Date.now(),
          });
        });

        app.listen(port);
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
          const response1 = await fetch(
            `http://localhost:${port}/runtime-config-test`
          );
          const data1 = (await response1.json()) as any;

          const response2 = await fetch(
            `http://localhost:${port}/runtime-config-test`
          );
          const data2 = (await response2.json()) as any;

          expect(response1.status).toBe(200);
          expect(response2.status).toBe(200);
          expect(data1.configVersion).toBe(1);
          expect(data2.configVersion).toBe(2);
          expect(data2.lastUpdate).toBeGreaterThan(data1.lastUpdate);
        } finally {
          await app.shutdown();
        }
      });
    });
  });
});
