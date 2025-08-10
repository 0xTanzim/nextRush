#!/usr/bin/env node

/**
 * Working WebSocket Test - NextRush v2
 */

/* global console */

const { createApp, WebSocketPlugin } = require('../dist/index.js');

// Create app
const app = createApp();

// Install WebSocket plugin
const wsPlugin = new WebSocketPlugin({
  path: '/ws',
  heartbeatMs: 30000,
});
wsPlugin.install(app);

let connectionCount = 0;

// WebSocket handler
app.ws('/ws', socket => {
  connectionCount++;
  console.log(`New WebSocket connection ${connectionCount}`);

  // Send welcome message
  socket.send('Hello from NextRush v2 WebSocket!');

  // Handle messages
  socket.onMessage(data => {
    console.log(`Received: ${data}`);
    socket.send(`Echo: ${data}`);
  });

  // Handle close
  socket.onClose((code, reason) => {
    connectionCount--;
    console.log(`Connection closed: ${code} ${reason}`);
  });
});

// Health endpoint
app.get('/health', ctx => {
  ctx.res.json({
    status: 'ok',
    websocket: 'ready',
    connections: connectionCount,
  });
});

// Root endpoint
app.get('/', ctx => {
  ctx.res.end('NextRush v2 WebSocket Test Server Running');
});

// Start server
const server = app.listen(3001, () => {
  console.log('🚀 NextRush v2 WebSocket Test Server');
  console.log('📍 http://localhost:3001');
  console.log('🔌 ws://localhost:3001/ws');
  console.log('');
  console.log('Test WebSocket with:');
  console.log('curl -i -N \\');
  console.log('  -H "Connection: Upgrade" \\');
  console.log('  -H "Upgrade: websocket" \\');
  console.log('  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \\');
  console.log('  -H "Sec-WebSocket-Version: 13" \\');
  console.log('  http://localhost:3001/ws');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  server.close(() => {
    process.exit(0);
  });
});
