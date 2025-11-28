/**
 * Hono Performance Test Server
 *
 * Configuration:
 * - Production mode
 * - Built-in JSON support
 * - Bun/Node.js compatible
 * - No logging middleware
 *
 * Hono is one of the fastest web frameworks, perfect for comparison.
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';

const app = new Hono();

// Test Routes

// 1. Hello World - Baseline performance
app.get('/', (c) => {
  return c.json({ message: 'Hello World' });
});

// 2. Route Parameters - Router performance
app.get('/users/:id', (c) => {
  const id = c.req.param('id');
  return c.json({
    id,
    name: `User ${id}`,
    email: `user${id}@example.com`,
  });
});

// 3. Query Strings - Query parsing
app.get('/search', (c) => {
  const q = c.req.query('q') || '';
  const limit = c.req.query('limit') || '10';
  return c.json({
    query: q,
    limit: parseInt(limit),
    results: Array.from({ length: Math.min(parseInt(limit), 10) }, (_, i) => ({
      id: i + 1,
      title: `Result ${i + 1} for "${q}"`,
    })),
  });
});

// 4. POST JSON - Body parser performance
app.post('/users', async (c) => {
  const data = await c.req.json();
  return c.json({
    success: true,
    user: {
      id: Math.floor(Math.random() * 10000),
      ...data,
      createdAt: new Date().toISOString(),
    },
  });
});

// Start server
const server = serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  () => {
    console.log('Hono server running on http://localhost:3000');
  }
);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Hono server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Hono server closed');
    process.exit(0);
  });
});

export { app, server };
