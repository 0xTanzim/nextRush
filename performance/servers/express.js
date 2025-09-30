/**
 * Express Performance Test Server
 *
 * Configuration:
 * - Production mode
 * - express.json() for body parsing
 * - No logging middleware
 */

const express = require('express');

const app = express();

// Body parser for POST routes
app.use(express.json({ limit: '1mb' }));

// Test Routes

// 1. Hello World - Baseline performance
app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

// 2. Route Parameters - Router performance
app.get('/users/:id', (req, res) => {
  const { id } = req.params;
  res.json({
    id,
    name: `User ${id}`,
    email: `user${id}@example.com`,
  });
});

// 3. Query Strings - Query parsing
app.get('/search', (req, res) => {
  const { q = '', limit = '10' } = req.query;
  res.json({
    query: q,
    limit: parseInt(limit),
    results: Array.from({ length: Math.min(parseInt(limit), 10) }, (_, i) => ({
      id: i + 1,
      title: `Result ${i + 1} for "${q}"`,
    })),
  });
});

// 4. POST JSON - Body parser performance
app.post('/users', (req, res) => {
  const data = req.body;
  res.json({
    success: true,
    user: {
      id: Math.floor(Math.random() * 10000),
      ...data,
      createdAt: new Date().toISOString(),
    },
  });
});

// Start server
const server = app.listen(3000, () => {
  console.log('Express server running on http://localhost:3000');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Express server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Express server closed');
    process.exit(0);
  });
});

module.exports = { app, server };
