#!/usr/bin/env tsx

/**
 * 🚀 Simple NextRush v2 Benchmark
 *
 * Basic benchmark to test NextRush v2 performance
 */

import autocannon from 'autocannon';
import { createApp } from 'nextrush-v2';

async function runSimpleBenchmark() {
  console.log('🚀 NextRush v2 Simple Benchmark');
  console.log('================================\n');

  // Create NextRush v2 app
  const app = createApp({
    port: 0,
    host: 'localhost',
    trustProxy: true,
    enableLogging: false,
  });

  // Add basic routes
  app.get('/', ctx => {
    ctx.res.json({ message: 'Hello from NextRush v2!' });
  });

  app.get('/api/health', ctx => {
    ctx.res.json({ status: 'ok', framework: 'NextRush v2' });
  });

  app.get('/api/users', ctx => {
    const users = [
      { id: 1, name: 'John Doe', email: 'john@example.com' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
      { id: 3, name: 'Bob Johnson', email: 'bob@example.com' },
    ];
    ctx.res.json(users);
  });

  app.post('/api/users', ctx => {
    const body = ctx.body as { name?: string; email?: string };
    if (!body?.name || !body?.email) {
      ctx.status = 400;
      ctx.res.json({ error: 'Name and email are required' });
      return;
    }
    ctx.res.status(201).json({ id: Date.now(), ...body });
  });

  // Start server and wait for it to be ready
  let server: any;
  let port: number;

  try {
    server = await app.listen();
    
    // Wait for server to be ready
    await new Promise<void>((resolve) => {
      const checkServer = () => {
        const address = server.address();
        if (address) {
          port = (address as any).port;
          console.log(`📡 Server started on port ${port}`);
          resolve();
        } else {
          setTimeout(checkServer, 100);
        }
      };
      checkServer();
    });

    // Run benchmark
    console.log('🔄 Running benchmark...');

    const result = await new Promise<any>((resolve, reject) => {
      autocannon(
        {
          url: `http://localhost:${port}/api/users`,
          connections: 10,
          duration: 10,
          pipelining: 1,
        },
        (err, result) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(result);
        }
      );
    });

    // Display results
    console.log('\n📊 Benchmark Results:');
    console.log('=====================');
    console.log(`🏆 Framework: NextRush v2`);
    console.log(`📈 Requests/sec: ${result.requests.average.toFixed(2)}`);
    console.log(`⏱️  Latency (ms): ${result.latency.average.toFixed(2)}`);
    console.log(`📊 Throughput: ${result.throughput.average.toFixed(2)} MB/s`);
    console.log(`❌ Errors: ${result.errors}`);
    console.log(`⏰ Timeouts: ${result.timeouts}`);
    console.log(`📦 Total Requests: ${result.requests.total}`);
    console.log(`⏱️  Duration: ${result.duration}ms`);

    console.log('\n✅ Benchmark completed successfully!');

  } catch (error) {
    console.error('❌ Benchmark failed:', error);
  } finally {
    // Cleanup
    if (server) {
      await app.shutdown();
      console.log('🧹 Server shutdown complete');
    }
  }
}

runSimpleBenchmark().catch(console.error);
