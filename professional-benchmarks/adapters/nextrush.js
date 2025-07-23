#!/usr/bin/env node

/**
 * NextRush Framework Adapter for Professional Benchmarking
 * ULTRA-OPTIMIZED setup with core functionality only
 */

import { createApp, PluginMode } from '../../dist/index.js';

const port = process.argv[2] || 3000;

// Create NextRush app with performance mode (we'll handle static file conflicts in routes)
const app = createApp({
  // Use PERFORMANCE mode for maximum speed
  pluginMode: PluginMode.PERFORMANCE,

  // Disable non-essential features for benchmarking
  logger: false,
  events: false,
  websocket: false,

  // Optimize for performance
  trustProxy: false,
  etag: false,
});

// Add early middleware to handle routes that might conflict with static files
app.use((req, res, next) => {
  // Log static file plugin behavior for debugging
  if (
    req.url.includes('search') ||
    req.url.includes('api/') ||
    req.url.includes('users/')
  ) {
    // These are API routes, not static files - skip static file processing
    req.skipStaticFiles = true;
  }
  next();
});

// Basic route for simple performance testing
app.get('/', (req, res) => {
  res.json({
    message: 'Hello from NextRush!',
    timestamp: Date.now(),
    framework: 'nextrush',
    version: '1.3.0',
  });
});

// JSON response test
app.get('/json', (req, res) => {
  res.json({
    framework: 'nextrush',
    version: '1.3.0',
    timestamp: Date.now(),
    data: {
      message: 'Hello World',
      status: 'success',
      benchmark: true,
    },
  });
});

// Plain text response for minimal overhead testing
app.get('/plaintext', (req, res) => {
  res.send('Hello World');
});

// Parameter parsing test
app.get('/users/:id/posts/:postId', (req, res) => {
  res.json({
    userId: req.params.id,
    postId: req.params.postId,
    timestamp: Date.now(),
  });
});

// Query parameter test
app.get('/search', (req, res) => {
  res.json({
    query: req.query.q || '',
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 10,
    timestamp: Date.now(),
  });
});

// POST request test
app.post('/data', (req, res) => {
  res.json({
    received: true,
    timestamp: Date.now(),
    body: req.body,
  });
});

// Error handling test
app.get('/error', (req, res) => {
  res.status(500).json({
    error: 'Test error',
    code: 500,
    timestamp: Date.now(),
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: Date.now(),
  });
});

// Static file serving test - REMOVED for benchmark testing to avoid conflicts
// app.static('/public', '../public');

// Middleware chain test
app.use((req, res, next) => {
  req.middleware1 = true;
  next();
});

app.use((req, res, next) => {
  req.middleware2 = true;
  next();
});

app.get('/middleware-test', (req, res) => {
  res.json({
    middleware1: req.middleware1,
    middleware2: req.middleware2,
    timestamp: Date.now(),
  });
});

// API routes for Artillery testing
app.get('/api/users', (req, res) => {
  res.json([
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
    { id: 3, name: 'Bob Wilson', email: 'bob@example.com' },
  ]);
});

app.get('/api/users/:id', (req, res) => {
  const id = parseInt(req.params.id);
  res.json({
    id,
    name: `User ${id}`,
    email: `user${id}@example.com`,
    created: Date.now() - Math.random() * 1000000,
  });
});

app.post('/api/users', (req, res) => {
  const { name, email } = req.body || {};
  res.json({
    id: Math.floor(Math.random() * 1000),
    name: name || 'Test User',
    email: email || 'test@example.com',
    created: Date.now(),
    success: true,
  });
});

app.put('/api/users/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const { name, email } = req.body || {};
  res.json({
    id,
    name: name || `Updated User ${id}`,
    email: email || `updated${id}@example.com`,
    updated: Date.now(),
    success: true,
  });
});

app.delete('/api/users/:id', (req, res) => {
  const id = parseInt(req.params.id);
  res.json({
    id,
    deleted: true,
    timestamp: Date.now(),
  });
});

// Start server
const server = app.listen(port, () => {
  console.log(`NextRush benchmark server running on port ${port}`);
  console.log(
    `Plugin mode: PERFORMANCE (${
      app.getLoadedPlugins?.()?.length || 4
    } plugins)`
  );
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('NextRush server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  server.close(() => {
    console.log('NextRush server closed');
    process.exit(0);
  });
});

export default app;
