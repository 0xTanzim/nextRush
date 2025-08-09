#!/usr/bin/env node

/* eslint-env node */

/**
 * WebSocket Plugin Playground
 *
 * This playground demonstrates the NextRush v2 WebSocket plugin with various features:
 * - Basic echo server
 * - Chat rooms
 * - Authentication middleware
 * - Broadcasting
 *
 * Test with curl or any WebSocket client
 */

import { createApp } from '../src/index.js';
import { WebSocketPlugin } from '../src/plugins/websocket/websocket.plugin.js';

const app = createApp();

// Configure WebSocket plugin
const wsPlugin = new WebSocketPlugin({
  heartbeatMs: 10000, // 10 second heartbeat for demo
  maxConnections: 100,
  maxMessageSize: 1024 * 10, // 10KB limit
  debug: false,
});

wsPlugin.install(app);

// Simple echo endpoint
app.ws('/echo', (socket, req) => {
  console.log('📡 Echo client connected from:', req.socket.remoteAddress);

  socket.send('Welcome to echo server! Send me a message.');

  socket.onMessage(data => {
    console.log('📩 Echo received:', data.toString());
    socket.send(`Echo: ${data}`);
  });

  socket.onClose((code, reason) => {
    console.log('📡 Echo client disconnected:', code, reason);
  });
});

// Chat room endpoint
const chatRooms = new Map();

app.ws('/chat', (socket, req) => {
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const clientId = Math.random().toString(36).substring(7);

  console.log(`💬 Chat client ${clientId} connected (${userAgent})`);

  // Default room
  const defaultRoom = 'general';
  socket.join(defaultRoom);

  // Track room membership
  if (!chatRooms.has(defaultRoom)) {
    chatRooms.set(defaultRoom, new Set());
  }
  chatRooms.get(defaultRoom).add(clientId);

  // Welcome message
  socket.send(
    JSON.stringify({
      type: 'system',
      message: `Welcome to chat! You're in room: ${defaultRoom}`,
      clientId,
      room: defaultRoom,
    })
  );

  // Notify others
  app.wsBroadcast(
    JSON.stringify({
      type: 'join',
      message: `User ${clientId} joined the room`,
      clientId,
      room: defaultRoom,
    }),
    defaultRoom
  );

  socket.onMessage(data => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'chat': {
          console.log(`💬 [${defaultRoom}] ${clientId}: ${message.content}`);
          app.wsBroadcast(
            JSON.stringify({
              type: 'chat',
              content: message.content,
              clientId,
              room: defaultRoom,
              timestamp: new Date().toISOString(),
            }),
            defaultRoom
          );
          break;
        }

        case 'join_room': {
          // Leave current room
          socket.leave(defaultRoom);
          if (chatRooms.has(defaultRoom)) {
            chatRooms.get(defaultRoom).delete(clientId);
          }

          // Join new room
          const newRoom = message.room || 'general';
          socket.join(newRoom);
          if (!chatRooms.has(newRoom)) {
            chatRooms.set(newRoom, new Set());
          }
          chatRooms.get(newRoom).add(clientId);

          socket.send(
            JSON.stringify({
              type: 'room_changed',
              room: newRoom,
              message: `You joined room: ${newRoom}`,
            })
          );
          break;
        }

        default:
          socket.send(
            JSON.stringify({
              type: 'error',
              message: 'Unknown message type. Use: chat, join_room',
            })
          );
      }
    } catch (error) {
      console.error('💬 Chat message error:', error.message);
      socket.send(
        JSON.stringify({
          type: 'error',
          message: 'Invalid JSON message',
        })
      );
    }
  });

  socket.onClose((code, reason) => {
    console.log(`💬 Chat client ${clientId} disconnected:`, code, reason);

    // Clean up room membership
    for (const [room, members] of chatRooms.entries()) {
      if (members.has(clientId)) {
        members.delete(clientId);
        app.wsBroadcast(
          JSON.stringify({
            type: 'leave',
            message: `User ${clientId} left the room`,
            clientId,
            room,
          }),
          room
        );
      }
    }
  });
});

// Authenticated endpoint with simple token validation
app.ws('/private', (socket, req) => {
  const token = req.headers.authorization;

  if (!token || !token.startsWith('Bearer ')) {
    socket.close(1008, 'Authentication required');
    return;
  }

  const tokenValue = token.substring(7);

  // Simple token validation (in real apps, use proper JWT validation)
  if (tokenValue !== 'secret123') {
    socket.close(1008, 'Invalid token');
    return;
  }

  console.log('🔐 Authenticated client connected');

  socket.send('Welcome to private WebSocket! You are authenticated.');

  socket.onMessage(data => {
    console.log('🔐 Private message:', data.toString());
    socket.send(`Private echo: ${data}`);
  });

  socket.onClose((code, reason) => {
    console.log('🔐 Private client disconnected:', code, reason);
  });
});

// Broadcast endpoint for testing
app.ws('/broadcast', (socket, req) => {
  console.log('📢 Broadcast client connected');

  socket.send(
    'Welcome to broadcast server! Send messages to broadcast to all connected clients.'
  );

  socket.onMessage(data => {
    const message = data.toString();
    console.log('📢 Broadcasting:', message);

    // Broadcast to all WebSocket connections
    app.wsBroadcast(`Broadcast: ${message}`);

    // Confirm to sender
    socket.send(`Broadcasted: ${message}`);
  });

  socket.onClose((code, reason) => {
    console.log('📢 Broadcast client disconnected:', code, reason);
  });
});

// Health check endpoint for HTTP
app.get('/health', ctx => {
  ctx.res.json({
    status: 'ok',
    websockets: 'active',
    endpoints: ['/echo', '/chat', '/private', '/broadcast'],
    timestamp: new Date().toISOString(),
  });
});

// WebSocket endpoints info
app.get('/ws-info', ctx => {
  ctx.res.json({
    endpoints: {
      '/echo': {
        description: 'Simple echo server',
        usage: 'Connect and send any message, server will echo it back',
      },
      '/chat': {
        description: 'Chat room server',
        usage:
          'Send JSON messages: {"type":"chat","content":"Hello"} or {"type":"join_room","room":"roomname"}',
      },
      '/private': {
        description: 'Authenticated WebSocket',
        usage: 'Requires Authorization header: Bearer secret123',
      },
      '/broadcast': {
        description: 'Broadcast server',
        usage: 'Messages sent here are broadcast to all connected clients',
      },
    },
    testing: {
      curl_websocket:
        'curl --include --no-buffer --header "Connection: Upgrade" --header "Upgrade: websocket" --header "Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==" --header "Sec-WebSocket-Version: 13" http://localhost:3001/echo',
      websocat: 'websocat ws://localhost:3001/echo',
      nodejs:
        'const ws = new WebSocket("ws://localhost:3001/echo"); ws.onmessage = e => console.log(e.data);',
    },
  });
});

// Start server
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log('🚀 NextRush v2 WebSocket Playground Server Started!');
  console.log(`📍 Server running on http://localhost:${PORT}`);
  console.log('');
  console.log('📡 WebSocket Endpoints:');
  console.log(`   ws://localhost:${PORT}/echo - Echo server`);
  console.log(`   ws://localhost:${PORT}/chat - Chat rooms`);
  console.log(
    `   ws://localhost:${PORT}/private - Authenticated (Bearer secret123)`
  );
  console.log(`   ws://localhost:${PORT}/broadcast - Broadcast to all`);
  console.log('');
  console.log('🌐 HTTP Endpoints:');
  console.log(`   http://localhost:${PORT}/health - Health check`);
  console.log(
    `   http://localhost:${PORT}/ws-info - WebSocket info and testing commands`
  );
  console.log('');
  console.log('🧪 Test Commands:');
  console.log('');
  console.log('1. Health Check:');
  console.log(`   curl http://localhost:${PORT}/health`);
  console.log('');
  console.log('2. WebSocket with curl (basic handshake test):');
  console.log(`   curl --include --no-buffer \\`);
  console.log('     --header "Connection: Upgrade" \\');
  console.log('     --header "Upgrade: websocket" \\');
  console.log('     --header "Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==" \\');
  console.log('     --header "Sec-WebSocket-Version: 13" \\');
  console.log(`     http://localhost:${PORT}/echo`);
  console.log('');
  console.log('3. Authentication test (should fail):');
  console.log(`   curl --include --no-buffer \\`);
  console.log('     --header "Connection: Upgrade" \\');
  console.log('     --header "Upgrade: websocket" \\');
  console.log('     --header "Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==" \\');
  console.log('     --header "Sec-WebSocket-Version: 13" \\');
  console.log(`     http://localhost:${PORT}/private`);
  console.log('');
  console.log('4. Authentication test (should succeed):');
  console.log(`   curl --include --no-buffer \\`);
  console.log('     --header "Connection: Upgrade" \\');
  console.log('     --header "Upgrade: websocket" \\');
  console.log('     --header "Authorization: Bearer secret123" \\');
  console.log('     --header "Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==" \\');
  console.log('     --header "Sec-WebSocket-Version: 13" \\');
  console.log(`     http://localhost:${PORT}/private`);
  console.log('');
  console.log(
    '📝 Note: curl can only test WebSocket handshakes, not send/receive messages.'
  );
  console.log(
    '   For full testing, use websocat, wscat, or a WebSocket client.'
  );
  console.log('   Install websocat: https://github.com/vi/websocat');
  console.log(`   Example: websocat ws://localhost:${PORT}/echo`);
  console.log('');
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});
