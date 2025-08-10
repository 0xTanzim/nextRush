#!/usr/bin/env node

/**
 * Simple WebSocket playground for testing with curl
 */

import process from 'node:process';
import { createApp, WebSocketPlugin } from '../dist/index.mjs';

// Create app and install WebSocket plugin
const app = createApp();
const wsPlugin = new WebSocketPlugin();
wsPlugin.install(app);

// Simple echo endpoint - now with proper typing!
app.ws('/echo', socket => {
  process.stdout.write('📡 Echo client connected\n');
  socket.send('Welcome to echo server!');

  socket.onMessage(data => {
    process.stdout.write(`📩 Echo: ${data.toString()}\n`);
    socket.send(`Echo: ${data}`);
  });

  socket.onClose(() => {
    process.stdout.write('📡 Echo client disconnected\n');
  });
});

// Health check
app.get('/health', ctx => {
  ctx.res.json({ status: 'ok', websockets: 'active' });
});

// Start server
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  process.stdout.write(`🚀 WebSocket Demo Server running on port ${PORT}\n`);
  process.stdout.write(`📡 WebSocket endpoint: ws://localhost:${PORT}/echo\n`);
  process.stdout.write(`🌐 Health check: http://localhost:${PORT}/health\n`);
  process.stdout.write('\n🧪 Test with curl:\n');
  process.stdout.write(`curl --include --no-buffer \\
  --header "Connection: Upgrade" \\
  --header "Upgrade: websocket" \\
  --header "Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==" \\
  --header "Sec-WebSocket-Version: 13" \\
  http://localhost:${PORT}/echo\n\n`);
});

process.on('SIGTERM', () => {
  process.stdout.write('🛑 Shutting down...\n');
  process.exit(0);
});

process.on('SIGINT', () => {
  process.stdout.write('🛑 Shutting down...\n');
  process.exit(0);
});
