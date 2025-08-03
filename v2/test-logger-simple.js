#!/usr/bin/env node

/**
 * Simple Logger Test
 * Demonstrates the NextRush v2 Advanced Logger Plugin in action
 */

const { createApp } = require('./dist/index.js');
const {
  createLogger,
  createDevLogger,
  createProdLogger,
} = require('./dist/index.js');

console.log('🚀 NextRush v2 Logger Test');
console.log('==========================');

// Create application
const app = createApp({
  port: 3002,
  host: 'localhost',
  debug: true,
});

// Create and install logger
const logger = createDevLogger();
logger.install(app);

// Add some routes to test logging
app.get('/test', ctx => {
  app.logger.info('Test route accessed', { userId: '123', action: 'test' });
  ctx.res.json({
    message: 'Test successful',
    timestamp: new Date().toISOString(),
  });
});

app.get('/error', ctx => {
  app.logger.error('Error route accessed', { error: 'Test error', code: 500 });
  ctx.res.status(500).json({ error: 'Test error' });
});

app.get('/slow', async ctx => {
  app.logger.warn('Slow route accessed', {
    warning: 'This is a slow operation',
  });
  // Simulate slow operation
  await new Promise(resolve => setTimeout(resolve, 200));
  ctx.res.json({ message: 'Slow operation completed' });
});

// Start the server
app.listen(3002, () => {
  console.log('✅ Server started on http://localhost:3002');
  console.log('📝 Test endpoints:');
  console.log('   GET /test  - Normal logging');
  console.log('   GET /error - Error logging');
  console.log('   GET /slow  - Slow operation logging');
  console.log('');
  console.log('🔍 Check the console output for logger messages!');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await app.shutdown();
  process.exit(0);
});
