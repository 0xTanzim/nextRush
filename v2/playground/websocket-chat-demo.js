#!/usr/bin/env node

/**
 * NextRush v2 WebSocket Chat Room Demo
 *
 * A comprehensive WebSocket example demonstrating:
 * - Room-based chat functionality
 * - Real-time messaging
 * - Connection management
 * - Message broadcasting
 *
 * Usage:
 *   node websocket-chat-demo.js
 *
 * Test with curl:
 *   # Connect to general room
 *   curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" -H "Sec-WebSocket-Version: 13" http://localhost:3000/chat/general
 *
 * Test with browser WebSocket:
 *   const ws = new WebSocket('ws://localhost:3000/chat/general');
 *   ws.onopen = () => console.log('Connected to general room');
 *   ws.onmessage = (event) => console.log('Received:', event.data);
 *   ws.send('Hello everyone!');
 */

const { createApp } = require('../dist/index.js');
const { WebSocketPlugin } = require('../dist/index.js');

// Create NextRush v2 application
const app = createApp();

// Configure WebSocket plugin for chat rooms with wildcard paths
const wsPlugin = new WebSocketPlugin({
  path: '/chat/*',
  heartbeatMs: 30000,
  pongTimeoutMs: 60000,
  maxConnections: 100,
  maxMessageSize: 1024,
});

// Install WebSocket plugin
wsPlugin.install(app);

// Statistics tracking
const stats = {
  totalConnections: 0,
  activeConnections: 0,
  messagesSent: 0,
  rooms: new Map(),
};

// WebSocket handler for chat rooms
app.ws('/chat/*', (socket, req) => {
  // Extract room name from URL path
  const urlParts = req.url.split('/');
  const roomName = urlParts[urlParts.length - 1] || 'general';

  // Update connection stats
  stats.totalConnections++;
  stats.activeConnections++;

  // Initialize room stats if new
  if (!stats.rooms.has(roomName)) {
    stats.rooms.set(roomName, { users: 0, messages: 0 });
  }

  const roomStats = stats.rooms.get(roomName);
  roomStats.users++;

  console.log(
    `📥 New connection to room: ${roomName} (Total: ${stats.activeConnections})`
  );
  console.log(`🏠 Room "${roomName}" now has ${roomStats.users} users`);

  // Join the user to the room
  socket.join(roomName);

  // Send welcome message to new user
  socket.send(
    JSON.stringify({
      type: 'welcome',
      room: roomName,
      message: `Welcome to room "${roomName}"! You are connected.`,
      timestamp: new Date().toISOString(),
      stats: {
        activeUsers: roomStats.users,
        totalMessages: roomStats.messages,
      },
    })
  );

  // Notify other users in the room about new user
  setTimeout(() => {
    app.wsBroadcast(
      JSON.stringify({
        type: 'user-joined',
        room: roomName,
        message: `A new user joined room "${roomName}"`,
        timestamp: new Date().toISOString(),
        activeUsers: roomStats.users,
      }),
      roomName
    );
  }, 100);

  // Handle incoming messages
  socket.onMessage(data => {
    let messageData;

    try {
      // Try to parse JSON message
      if (typeof data === 'string') {
        // Check if it's JSON
        if (data.startsWith('{') && data.endsWith('}')) {
          messageData = JSON.parse(data);
        } else {
          // Plain text message
          messageData = {
            type: 'message',
            content: data,
            timestamp: new Date().toISOString(),
          };
        }
      } else {
        // Binary data - convert to string
        messageData = {
          type: 'message',
          content: data.toString(),
          timestamp: new Date().toISOString(),
        };
      }
    } catch (error) {
      // Invalid JSON, treat as plain text
      messageData = {
        type: 'message',
        content: data.toString(),
        timestamp: new Date().toISOString(),
      };
    }

    // Update message stats
    stats.messagesSent++;
    roomStats.messages++;

    // Create broadcast message
    const broadcastMessage = {
      type: 'chat-message',
      room: roomName,
      content: messageData.content,
      timestamp: messageData.timestamp || new Date().toISOString(),
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      stats: {
        totalMessages: stats.messagesSent,
        roomMessages: roomStats.messages,
      },
    };

    console.log(
      `💬 Message in room "${roomName}": ${messageData.content.substring(0, 50)}...`
    );

    // Broadcast message to all users in the room
    app.wsBroadcast(JSON.stringify(broadcastMessage), roomName);
  });

  // Handle connection close
  socket.onClose((code, reason) => {
    stats.activeConnections--;
    roomStats.users--;

    console.log(
      `📤 Connection closed from room: ${roomName} (Code: ${code}, Reason: ${reason})`
    );
    console.log(`🏠 Room "${roomName}" now has ${roomStats.users} users`);

    // Clean up empty room stats
    if (roomStats.users === 0) {
      console.log(`🧹 Room "${roomName}" is now empty`);
    }

    // Notify other users in the room
    if (roomStats.users > 0) {
      app.wsBroadcast(
        JSON.stringify({
          type: 'user-left',
          room: roomName,
          message: `A user left room "${roomName}"`,
          timestamp: new Date().toISOString(),
          activeUsers: roomStats.users,
        }),
        roomName
      );
    }
  });
});

// Health check endpoint
app.get('/health', ctx => {
  ctx.json({
    status: 'healthy',
    websocket: {
      totalConnections: stats.totalConnections,
      activeConnections: stats.activeConnections,
      messagesSent: stats.messagesSent,
      rooms: Object.fromEntries(stats.rooms),
      pluginStats: wsPlugin.getStats(),
    },
    timestamp: new Date().toISOString(),
  });
});

// Room list endpoint
app.get('/rooms', ctx => {
  const roomList = Array.from(stats.rooms.entries()).map(([name, data]) => ({
    name,
    activeUsers: data.users,
    totalMessages: data.messages,
    isEmpty: data.users === 0,
  }));

  ctx.json({
    rooms: roomList,
    totalRooms: roomList.length,
    totalActiveUsers: stats.activeConnections,
    timestamp: new Date().toISOString(),
  });
});

// Simple chat client HTML endpoint
app.get('/', ctx => {
  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>NextRush v2 WebSocket Chat Demo</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; color: #2c5282; margin-bottom: 30px; }
        .room-input { margin-bottom: 20px; }
        .room-input input { padding: 10px; margin: 5px; border: 1px solid #ccc; border-radius: 4px; }
        .room-input button { padding: 10px 20px; background: #2c5282; color: white; border: none; border-radius: 4px; cursor: pointer; }
        .room-input button:hover { background: #2a4d7a; }
        .chat-area { height: 300px; border: 1px solid #ccc; padding: 10px; overflow-y: scroll; background: #f9f9f9; margin-bottom: 10px; border-radius: 4px; }
        .message { margin-bottom: 5px; padding: 5px; border-radius: 3px; }
        .message.system { background: #e6ffed; color: #2d7d32; }
        .message.user { background: #e3f2fd; color: #1976d2; }
        .message.error { background: #ffebee; color: #c62828; }
        .input-area { display: flex; gap: 10px; }
        .input-area input { flex: 1; padding: 10px; border: 1px solid #ccc; border-radius: 4px; }
        .input-area button { padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; }
        .input-area button:hover { background: #218838; }
        .input-area button:disabled { background: #6c757d; cursor: not-allowed; }
        .status { margin: 10px 0; padding: 10px; border-radius: 4px; }
        .status.connected { background: #d4edda; color: #155724; }
        .status.disconnected { background: #f8d7da; color: #721c24; }
        .stats { margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 NextRush v2 WebSocket Chat Demo</h1>
            <p>Real-time chat with room support using Node.js built-in modules only</p>
        </div>

        <div class="room-input">
            <input type="text" id="roomName" placeholder="Enter room name (e.g., general, dev, random)" value="general">
            <button onclick="connect()">Connect to Room</button>
            <button onclick="disconnect()">Disconnect</button>
        </div>

        <div id="status" class="status disconnected">❌ Disconnected</div>

        <div id="chatArea" class="chat-area"></div>

        <div class="input-area">
            <input type="text" id="messageInput" placeholder="Type your message..." disabled onkeypress="handleKeyPress(event)">
            <button id="sendBtn" onclick="sendMessage()" disabled>Send</button>
        </div>

        <div class="stats">
            <h3>📊 Connection Stats</h3>
            <div id="statsDisplay">Not connected</div>
        </div>
    </div>

    <script>
        let ws = null;
        let currentRoom = '';

        function addMessage(content, type = 'user') {
            const chatArea = document.getElementById('chatArea');
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message ' + type;
            messageDiv.innerHTML = '<strong>' + new Date().toLocaleTimeString() + '</strong> ' + content;
            chatArea.appendChild(messageDiv);
            chatArea.scrollTop = chatArea.scrollHeight;
        }

        function updateStatus(connected, room = '') {
            const status = document.getElementById('status');
            const messageInput = document.getElementById('messageInput');
            const sendBtn = document.getElementById('sendBtn');

            if (connected) {
                status.className = 'status connected';
                status.innerHTML = '✅ Connected to room: ' + room;
                messageInput.disabled = false;
                sendBtn.disabled = false;
            } else {
                status.className = 'status disconnected';
                status.innerHTML = '❌ Disconnected';
                messageInput.disabled = true;
                sendBtn.disabled = true;
            }
        }

        function connect() {
            const roomName = document.getElementById('roomName').value.trim() || 'general';

            if (ws) {
                ws.close();
            }

            currentRoom = roomName;
            ws = new WebSocket('ws://localhost:3000/chat/' + roomName);

            ws.onopen = function() {
                updateStatus(true, roomName);
                addMessage('Connected to room "' + roomName + '"', 'system');
                document.getElementById('chatArea').innerHTML = '';
            };

            ws.onmessage = function(event) {
                try {
                    const data = JSON.parse(event.data);
                    let message = '';

                    switch(data.type) {
                        case 'welcome':
                            message = data.message + ' (Users: ' + data.stats.activeUsers + ', Messages: ' + data.stats.totalMessages + ')';
                            addMessage(message, 'system');
                            break;
                        case 'user-joined':
                            message = data.message + ' (Now ' + data.activeUsers + ' users)';
                            addMessage(message, 'system');
                            break;
                        case 'user-left':
                            message = data.message + ' (Now ' + data.activeUsers + ' users)';
                            addMessage(message, 'system');
                            break;
                        case 'chat-message':
                            message = data.content;
                            addMessage('💬 ' + message, 'user');
                            updateStats(data.stats);
                            break;
                        default:
                            addMessage(data.message || event.data, 'user');
                    }
                } catch (e) {
                    addMessage(event.data, 'user');
                }
            };

            ws.onclose = function(event) {
                updateStatus(false);
                addMessage('Connection closed (Code: ' + event.code + ')', 'error');
            };

            ws.onerror = function() {
                addMessage('Connection error occurred', 'error');
            };
        }

        function disconnect() {
            if (ws) {
                ws.close();
                ws = null;
            }
        }

        function sendMessage() {
            const input = document.getElementById('messageInput');
            const message = input.value.trim();

            if (message && ws && ws.readyState === WebSocket.OPEN) {
                ws.send(message);
                input.value = '';
            }
        }

        function handleKeyPress(event) {
            if (event.key === 'Enter') {
                sendMessage();
            }
        }

        function updateStats(stats) {
            const display = document.getElementById('statsDisplay');
            if (stats) {
                display.innerHTML = 'Total Messages: ' + stats.totalMessages + ', Room Messages: ' + stats.roomMessages;
            }
        }

        // Auto-connect to general room on page load
        window.onload = function() {
            connect();
        };
    </script>
</body>
</html>`;

  ctx.html(html);
});

// Start server
const server = app.listen(3000, () => {
  console.log('🚀 NextRush v2 WebSocket Chat Demo Server Started!');
  console.log('');
  console.log('📍 Server running on: http://localhost:3000');
  console.log('');
  console.log('🌐 Available endpoints:');
  console.log('  • GET  /           - Chat client interface');
  console.log('  • GET  /health     - Health check with WebSocket stats');
  console.log('  • GET  /rooms      - List active rooms');
  console.log('  • WS   /chat/*     - WebSocket chat rooms (wildcard paths)');
  console.log('');
  console.log('🧪 Test with curl WebSocket handshake:');
  console.log('  curl -i -N \\');
  console.log('    -H "Connection: Upgrade" \\');
  console.log('    -H "Upgrade: websocket" \\');
  console.log('    -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \\');
  console.log('    -H "Sec-WebSocket-Version: 13" \\');
  console.log('    http://localhost:3000/chat/general');
  console.log('');
  console.log('💻 Test with browser console:');
  console.log(
    '  const ws = new WebSocket("ws://localhost:3000/chat/general");'
  );
  console.log('  ws.onopen = () => console.log("Connected!");');
  console.log('  ws.onmessage = (e) => console.log("Received:", e.data);');
  console.log('  ws.send("Hello everyone!");');
  console.log('');
  console.log('🏠 Try different rooms:');
  console.log('  • ws://localhost:3000/chat/general');
  console.log('  • ws://localhost:3000/chat/dev');
  console.log('  • ws://localhost:3000/chat/random');
  console.log('  • ws://localhost:3000/chat/yourroom');
  console.log('');
  console.log('Press Ctrl+C to stop the server');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down WebSocket Chat Demo...');
  console.log(`📊 Final Stats:`);
  console.log(`   Total Connections: ${stats.totalConnections}`);
  console.log(`   Messages Sent: ${stats.messagesSent}`);
  console.log(`   Active Rooms: ${stats.rooms.size}`);

  if (wsPlugin) {
    wsPlugin.cleanup();
  }

  server.close(() => {
    console.log('✅ Server closed gracefully');
    process.exit(0);
  });
});
