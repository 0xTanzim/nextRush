#!/usr/bin/env node

/**
 * Simple WebSocket Test - NextRush v2
 *
 * A minimal WebSocket example for testing basic functionality
 * Uses require() for Node.js compatibility
 */

const { createApp, WebSocketPlugin } = require('../dist/index.js');

// Create app
const app = createApp();

// Install WebSocket plugin
const wsPlugin = new WebSocketPlugin({ path: '/ws' });
wsPlugin.install(app);

// Simple WebSocket handler
app.ws('/ws', socket => {
  // Connection opened
  socket.send('Hello! You are connected to NextRush v2 WebSocket.');

  // Handle messages
  socket.onMessage(data => {
    const message = `Echo: ${data}`;
    socket.send(message);
  });

  // Handle close
  socket.onClose(() => {
    // Connection closed
  });
});

// Health endpoint
app.get('/health', ctx => {
  ctx.json({ status: 'ok', websocket: 'ready' });
});

// Start server
app.listen(3001, () => {
  // Server started
});
