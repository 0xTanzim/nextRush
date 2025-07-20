#!/usr/bin/env node

/**
 * 🚀 Express.js Adapter for Professional Benchmarking
 *
 * Standard Express.js server for performance comparison
 */

import express from 'express';

const port = process.argv[2] || 3001;

// Create Express app
const app = express();

// Middleware for JSON parsing
app.use(express.json());

// Basic route for simple performance testing
app.get('/', (req, res) => {
  res.json({
    message: 'Hello from Express!',
    timestamp: Date.now(),
    framework: 'express',
    version: '4.19.2',
  });
});

// JSON response test
app.get('/json', (req, res) => {
  res.json({
    framework: 'express',
    version: '4.19.2',
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

// Static file serving test
app.use('/public', express.static('../public'));

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

// Start server
const server = app.listen(port, () => {
  console.log(`Express benchmark server running on port ${port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('Express server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  server.close(() => {
    console.log('Express server closed');
    process.exit(0);
  });
});

export default app;
