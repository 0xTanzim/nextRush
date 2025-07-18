# 🚀 NextRush WebSocket Documentation

## **🔥 Zero-Dependency WebSocket Implementation**

NextRush provides a **production-ready, zero-dependency WebSocket implementation** built with raw Node.js that's **easier to use, fully type-safe, and more powerful** than existing solutions.

> 🎯 **Why NextRush WebSocket?** No external dependencies, full TypeScript support, built-in room management, and enterprise-grade security - all in one package!

---

## **📚 Table of Contents**

1. [🚀 Quick Start](#-quick-start)
2. [⭐ Core Features](#-core-features)
3. [📖 API Reference](#-api-reference)
4. [🎯 WebSocket Handlers](#-websocket-handlers)
5. [🏠 Room Management](#-room-management)
6. [🔧 Middleware System](#-middleware-system)
7. [🎭 Event Handling](#-event-handling)
8. [🔒 Security Features](#-security-features)
9. [📊 Performance & Monitoring](#-performance--monitoring)
10. [💡 Best Practices](#-best-practices)
11. [🎮 Real-World Examples](#-real-world-examples)
12. [🔧 Troubleshooting](#-troubleshooting)
13. [🎁 Advanced Features](#-advanced-features)

---

## **🚀 Quick Start**

### **⚡ Enable WebSocket Support**

Get started with NextRush WebSocket in just 3 lines of code!

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// 🔌 Enable WebSocket support (zero dependencies!)
app.enableWebSocket({
  maxConnections: 100, // 👥 Maximum concurrent connections
  pingInterval: 30000, // 💓 Heartbeat interval (30s)
  maxMessageSize: 1024 * 1024, // 📦 Max message size (1MB)
  debug: true, // 🐛 Enable debug logging
});

// 🎯 Simple WebSocket route
app.ws('/chat', (socket, req) => {
  console.log(`✨ New connection: ${socket.id}`);

  // 👋 Welcome message
  socket.send('🎉 Welcome to NextRush WebSocket!');

  // 📨 Handle incoming messages
  socket.on('message', (data) => {
    console.log('📩 Received:', data);
    socket.send(`🔄 Echo: ${data}`);
  });

  // 👋 Handle disconnection
  socket.on('close', () => {
    console.log(`👋 Connection closed: ${socket.id}`);
  });
});

app.listen(3000, () => {
  console.log('🚀 WebSocket server ready at ws://localhost:3000!');
});
```

### **🌐 Client-Side Connection**

```javascript
// 🔗 Connect from browser
const ws = new WebSocket('ws://localhost:3000/chat');

ws.onopen = () => {
  console.log('✅ Connected!');
  ws.send('👋 Hello from client!');
};

ws.onmessage = (event) => {
  console.log('📨 Received:', event.data);
};

ws.onclose = () => {
  console.log('🔌 Disconnected!');
};

ws.onerror = (error) => {
  console.log('❌ Error:', error);
};
```

### **🎮 Interactive Demo**

Try our live demo running at the background! Open your browser and visit:

- 🏠 **Main Demo**: `http://localhost:3001`
- 💬 **Chat Room**: `ws://localhost:3001/chat`
- 🔄 **Echo Test**: `ws://localhost:3001/echo`
- 📊 **Stats API**: `http://localhost:3001/api/websocket/stats`

---

## **⭐ Core Features**

### **🔥 Zero Dependencies**

- 🎯 Built with raw Node.js HTTP upgrade events
- 📦 No external packages required
- ✅ RFC 6455 compliant WebSocket implementation
- 🚀 Production-ready out of the box

### **🛡️ Type Safety**

- 💎 Full TypeScript support with intelligent IntelliSense
- 🔒 Strongly typed event handlers and message types
- ⚡ Auto-completion for all WebSocket methods
- 🎯 Zero `any` types in public APIs

### **🏠 Advanced Room Management**

- 🚪 Real-time room join/leave functionality
- 📢 Broadcasting to specific rooms or all connections
- 📊 Room metadata and live statistics
- 🧹 Automatic room cleanup when empty

### **⚡ High Performance**

- 🔧 Optimized frame parsing and sending
- 🏊 Built-in connection pooling
- 💓 Automatic ping/pong heartbeat
- 📈 Handles thousands of concurrent connections

### **🔒 Enterprise Security**

- 🌐 Origin validation and CORS support
- ⏰ Built-in rate limiting
- 🛡️ Secure frame handling and validation
- 🚫 Path traversal protection

### **🎯 Developer Experience**

- 🔄 Express-like familiar API
- 📚 Comprehensive documentation with examples
- 🐛 Detailed error messages and debugging
- 🎮 Interactive demo and playground

---

## **📖 API Reference**

### **🎛️ Application Methods**

#### **`app.enableWebSocket(options?: WebSocketOptions)` 🔌**

Enable WebSocket support on your application with customizable options.

```typescript
app.enableWebSocket({
  maxConnections: 100, // 👥 Maximum concurrent connections
  pingInterval: 30000, // 💓 Ping interval in milliseconds
  maxMessageSize: 1048576, // 📦 Maximum message size in bytes (1MB)
  protocols: [], // 🔗 Supported WebSocket protocols
  origins: ['*'], // 🌐 Allowed origins (use specific domains in production)
  debug: false, // 🐛 Enable debug logging
  maxRooms: 1000, // 🏠 Maximum number of rooms
  roomCleanupInterval: 60000, // 🧹 Room cleanup interval (1 minute)
});
```

#### **`app.ws(path: string, handler: WebSocketHandler)` 🎯**

Register a WebSocket route handler with Express-like path matching.

```typescript
// 📍 Exact path matching
app.ws('/chat', (socket, req) => {
  // Handle WebSocket connection
});

// 🌟 Wildcard path matching
app.ws('/api/*', (socket, req) => {
  console.log(`📍 Connected to: ${req.url}`);
});

// 🔧 Parameter extraction
app.ws('/room/:roomId', (socket, req) => {
  const roomId = req.params.roomId;
  console.log(`🏠 Joining room: ${roomId}`);
});
```

#### **`app.wsUse(middleware: WebSocketMiddleware)` 🔧**

Add WebSocket middleware for authentication, logging, rate limiting, etc.

```typescript
// 🔐 Authentication middleware
app.wsUse((socket, req, next) => {
  console.log(`🔍 Connection from: ${socket.ip}`);
  socket.metadata.connectedAt = new Date();
  next();
});

// ⚠️ Error handling middleware
app.wsUse((socket, req, next) => {
  socket.on('error', (error) => {
    console.error(`❌ Socket error for ${socket.id}:`, error);
  });
  next();
});
```

### **🔌 WebSocket Connection Methods**

#### **📤 Core Communication Methods**

```typescript
// 📨 Send message (multiple formats supported)
socket.send(data: string | Buffer | object): void
socket.send('👋 Hello World!');                    // Text message
socket.send({ type: 'message', content: 'Hello' }); // JSON object (auto-stringified)
socket.send(Buffer.from('binary data'));           // Binary data

// 🔌 Close connection gracefully
socket.close(code?: number, reason?: string): void
socket.close(1000, 'Normal closure');              // Standard close
socket.close(1008, 'Authentication failed');       // Custom close with reason

// 💓 Ping/Pong for connection health
socket.ping(data?: Buffer): void
socket.pong(data?: Buffer): void
```

#### **🏠 Room Management Methods**

```typescript
// 🚪 Join rooms (async for proper error handling)
socket.join(room: string): Promise<void>
await socket.join('general');
await socket.join('vip-users');

// 🚪 Leave rooms
socket.leave(room: string): Promise<void>
await socket.leave('general');

// 📢 Broadcasting methods
socket.broadcast(data: any, room?: string): void
socket.broadcast('📢 Hello everyone!');                    // Broadcast to all
socket.broadcast('🏠 Room message', 'general');            // Broadcast to specific room

// 🎯 Targeted messaging
socket.to('room-name').send('💌 Message to room');
socket.to('admin').emit('notification', { alert: '🚨 New user' });

// 🎭 Event emitting
socket.emit(event: string, ...args: any[]): void
socket.emit('notification', {
  type: 'info',
  message: '🎉 Welcome!',
  icon: '👋'
});
```

#### **👂 Event Handling Methods**

```typescript
// 📡 Listen for events
socket.on(event: string, handler: Function): void
socket.on('message', (data) => {
  console.log('📩 Received:', data);
});

socket.on('join-room', async (roomName) => {
  await socket.join(roomName);
  socket.to(roomName).send(`🎉 User ${socket.id} joined!`);
});

// 🔂 One-time events
socket.once('auth', (token) => {
  console.log('🔐 Authentication received once');
});

// 🗑️ Remove event listeners
socket.off('message', handler);  // Remove specific handler
socket.off('message');           // Remove all handlers for event
```

#### **ℹ️ Connection Information**

```typescript
// 📊 Access connection details
console.log({
  id: socket.id, // 🆔 Unique socket identifier
  ip: socket.ip, // 🌐 Client IP address
  userAgent: socket.userAgent, // 💻 Client user agent
  origin: socket.origin, // 🔗 Request origin
  rooms: Array.from(socket.rooms), // 🏠 Current room memberships
  connectedAt: socket.connectedAt, // ⏰ Connection timestamp
  isAlive: socket.isAlive, // 💓 Connection health status
  metadata: socket.metadata, // 📝 Custom metadata object
});
```

---

## **🎯 WebSocket Handlers**

### **🎭 Handler Signature**

```typescript
type WebSocketHandler = (
  socket: NextRushWebSocket, // 🔌 WebSocket connection instance
  req: NextRushRequest // 📨 Original HTTP request
) => void | Promise<void>;
```

### **📊 Connection Information**

Access rich connection details for logging, analytics, and personalization:

```typescript
app.ws('/info', (socket, req) => {
  console.log({
    id: socket.id, // 🆔 'ws_abc123' - Unique identifier
    ip: socket.ip, // 🌐 '192.168.1.100' - Client IP
    userAgent: socket.userAgent, // 💻 'Mozilla/5.0...' - Browser info
    origin: socket.origin, // 🔗 'https://myapp.com' - Request origin
    rooms: Array.from(socket.rooms), // 🏠 ['general', 'vip'] - Room list
    connectedAt: socket.connectedAt, // ⏰ Date object - Connection time
    isAlive: socket.isAlive, // 💓 true/false - Health status
    metadata: socket.metadata, // 📝 {} - Custom data storage
  });

  // 🎉 Send welcome message with personalized info
  socket.send({
    type: 'welcome',
    message: `👋 Hello! Your ID is ${socket.id}`,
    timestamp: Date.now(),
    serverInfo: {
      version: '1.0.0',
      uptime: process.uptime(),
    },
  });
});
```

### **📨 Message Handling Patterns**

Implement robust message handling with proper error handling and validation:

```typescript
app.ws('/api', (socket, req) => {
  socket.on('message', async (rawData) => {
    try {
      // 📝 Parse and validate message
      const message = JSON.parse(rawData);

      // 🛡️ Input validation
      if (!message.type || typeof message.type !== 'string') {
        socket.send({
          type: 'error',
          message: '❌ Invalid message format. Type required.',
        });
        return;
      }

      // 🎯 Route message based on type
      switch (message.type) {
        case 'join':
          await handleJoinRoom(socket, message);
          break;

        case 'chat':
          await handleChatMessage(socket, message);
          break;

        case 'ping':
          socket.send({
            type: 'pong',
            timestamp: Date.now(),
            latency: Date.now() - message.timestamp,
          });
          break;

        case 'typing':
          await handleTypingIndicator(socket, message);
          break;

        case 'file-upload':
          await handleFileUpload(socket, message);
          break;

        default:
          socket.send({
            type: 'error',
            message: `❓ Unknown message type: ${message.type}`,
          });
      }
    } catch (error) {
      console.error(`🚨 Message processing error for ${socket.id}:`, error);
      socket.send({
        type: 'error',
        message: '🔧 Invalid JSON format',
      });
    }
  });
});

// 🏠 Handle room joining
async function handleJoinRoom(socket, message) {
  if (!message.room || typeof message.room !== 'string') {
    socket.send({ type: 'error', message: '🏠 Room name required' });
    return;
  }

  await socket.join(message.room);

  // 📢 Notify room members
  socket.to(message.room).send({
    type: 'user-joined',
    user: socket.id,
    room: message.room,
    timestamp: Date.now(),
  });

  // ✅ Confirm join to user
  socket.send({
    type: 'joined',
    room: message.room,
    message: `🎉 Successfully joined ${message.room}!`,
  });
}

// 💬 Handle chat messages
async function handleChatMessage(socket, message) {
  if (!message.text || !message.room) {
    socket.send({ type: 'error', message: '💬 Text and room required' });
    return;
  }

  // 🔍 Validate user is in room
  if (!socket.rooms.has(message.room)) {
    socket.send({
      type: 'error',
      message: `🚫 You are not in room: ${message.room}`,
    });
    return;
  }

  // 📢 Broadcast to room (excluding sender)
  socket.to(message.room).send({
    type: 'message',
    user: socket.id,
    text: message.text,
    room: message.room,
    timestamp: Date.now(),
    userInfo: socket.metadata.user || { name: 'Anonymous' },
  });
}

// ⌨️ Handle typing indicators
async function handleTypingIndicator(socket, message) {
  if (!message.room || typeof message.isTyping !== 'boolean') {
    return;
  }

  socket.to(message.room).send({
    type: 'typing',
    user: socket.id,
    room: message.room,
    isTyping: message.isTyping,
    timestamp: Date.now(),
  });
}
```

---

## **🏠 Room Management**

### **🚪 Joining and Leaving Rooms**

NextRush provides powerful room management for organizing connections into logical groups:

```typescript
app.ws('/chat', async (socket, req) => {
  // 🎯 Join default room on connection
  await socket.join('general');
  console.log(`🎉 ${socket.id} joined general room`);

  // 🏠 Join multiple rooms simultaneously
  await Promise.all([
    socket.join('users'),
    socket.join('notifications'),
    socket.join(`user-${socket.metadata.userId}`), // Private user room
  ]);

  socket.on('message', async (data) => {
    const msg = JSON.parse(data);

    if (msg.action === 'join-room') {
      // 🔐 Validate room access (optional)
      if (await validateRoomAccess(socket, msg.room)) {
        await socket.join(msg.room);

        // 📢 Announce to room members
        socket.to(msg.room).send({
          type: 'user-joined',
          user: socket.id,
          room: msg.room,
          username: socket.metadata.username || 'Anonymous',
          timestamp: Date.now(),
        });

        // ✅ Confirm to user
        socket.send({
          type: 'joined',
          room: msg.room,
          message: `🎉 Welcome to ${msg.room}!`,
          memberCount: await getRoomMemberCount(msg.room),
        });
      } else {
        socket.send({
          type: 'error',
          message: `🚫 Access denied to room: ${msg.room}`,
        });
      }
    }

    if (msg.action === 'leave-room') {
      await socket.leave(msg.room);

      // 👋 Announce departure
      socket.to(msg.room).send({
        type: 'user-left',
        user: socket.id,
        room: msg.room,
        username: socket.metadata.username || 'Anonymous',
        timestamp: Date.now(),
      });

      // ✅ Confirm to user
      socket.send({
        type: 'left',
        room: msg.room,
        message: `👋 You left ${msg.room}`,
      });
    }
  });

  // 🧹 Auto-cleanup on disconnect
  socket.socket.on('close', () => {
    console.log(`🧹 Cleaning up rooms for ${socket.id}`);
    // Rooms are automatically cleaned up
  });
});

// 🔐 Room access validation helper
async function validateRoomAccess(socket, roomName) {
  // Implement your access control logic
  const user = socket.metadata.user;
  if (!user) return false;

  // Example: Check if user has permission for this room
  return (
    user.permissions.includes('room:' + roomName) ||
    roomName.startsWith('public-')
  );
}
```

### **📢 Broadcasting to Rooms**

Multiple ways to send messages to room members:

```typescript
// 🌍 Global broadcasting (to all connected clients)
app.wsBroadcast({
  type: 'announcement',
  title: '📢 Server Announcement',
  message: 'Server maintenance in 5 minutes',
  priority: 'high',
  timestamp: Date.now(),
});

// 🏠 Room-specific broadcasting
app.wsBroadcast(
  {
    type: 'room-event',
    data: eventData,
    message: '🎉 Special event in premium room!',
  },
  'premium-users'
);

// 📤 From socket connection (excludes sender)
socket.broadcast('👋 Hello everyone in all rooms!');
socket.broadcast('🏠 Important room announcement', 'general');

// 🎯 Targeted room messaging (excludes sender)
socket.to('general').send({
  type: 'notification',
  message: '💡 Someone is sharing a file!',
  icon: '📁',
});

// 📊 Multi-room broadcasting
['general', 'announcements', 'vip'].forEach((room) => {
  socket.to(room).send({
    type: 'multi-room-update',
    rooms: ['general', 'announcements', 'vip'],
    message: '🔄 System update completed',
    timestamp: Date.now(),
  });
});

// 🎮 Conditional room broadcasting
socket.rooms.forEach((room) => {
  if (room.startsWith('game-')) {
    socket.to(room).send({
      type: 'game-event',
      event: 'player-action',
      player: socket.id,
    });
  }
});
```

### **📊 Room Information & Statistics**

Monitor and manage room activity:

```typescript
// 📈 Get comprehensive room statistics
app.get('/api/websocket/rooms', (req, res) => {
  const stats = app.getWebSocketStats();

  if (!stats) {
    res.status(503).json({ error: 'WebSocket not enabled' });
    return;
  }

  const roomData = Array.from(stats.rooms || []).map((room) => ({
    name: room.name,
    members: room.clients.size,
    created: room.created,
    lastActivity: room.lastActivity,
    isActive: Date.now() - room.lastActivity < 300000, // Active if activity in last 5 min
    metadata: room.metadata || {},
  }));

  res.json({
    totalRooms: roomData.length,
    activeRooms: roomData.filter((r) => r.isActive).length,
    totalMembers: roomData.reduce((sum, room) => sum + room.members, 0),
    rooms: roomData.sort((a, b) => b.members - a.members), // Sort by member count
  });
});

// 🔍 Get specific room details
app.get('/api/websocket/rooms/:roomName', (req, res) => {
  const roomName = req.params.roomName;
  const stats = app.getWebSocketStats();

  const room = stats?.rooms?.find((r) => r.name === roomName);

  if (!room) {
    res.status(404).json({ error: `Room '${roomName}' not found` });
    return;
  }

  // 👥 Get member list (be careful with privacy)
  const members = Array.from(room.clients).map((socket) => ({
    id: socket.id,
    connectedAt: socket.connectedAt,
    ip: socket.ip, // Consider privacy implications
    userAgent: socket.userAgent,
    username: socket.metadata.username || 'Anonymous',
  }));

  res.json({
    name: room.name,
    memberCount: room.clients.size,
    created: room.created,
    lastActivity: room.lastActivity,
    members: members.slice(0, 100), // Limit for performance
    membershipHistory: room.membershipHistory || [],
  });
});

// 🎯 Room management endpoint
app.post('/api/websocket/rooms/:roomName/broadcast', (req, res) => {
  const roomName = req.params.roomName;
  const { message, type = 'announcement' } = req.body;

  if (!message) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  // 📢 Send admin broadcast
  const broadcastData = {
    type: type,
    message: message,
    from: 'admin',
    timestamp: Date.now(),
    room: roomName,
  };

  app.wsBroadcast(broadcastData, roomName);

  res.json({
    success: true,
    message: `Broadcast sent to room: ${roomName}`,
    data: broadcastData,
  });
});
```

---

## **🔧 Middleware System**

### **Authentication Middleware**

```typescript
app.wsUse(async (socket, req, next) => {
  const token = req.headers.authorization;

  if (!token) {
    socket.close(1008, 'Authentication required');
    return;
  }

  try {
    const user = await verifyToken(token);
    socket.metadata.user = user;
    socket.metadata.authenticated = true;
    next();
  } catch (error) {
    socket.close(1008, 'Invalid token');
  }
});
```

### **Rate Limiting Middleware**

```typescript
const rateLimiter = new Map();

app.wsUse((socket, req, next) => {
  const key = socket.ip;
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxRequests = 100;

  if (!rateLimiter.has(key)) {
    rateLimiter.set(key, { count: 1, resetTime: now + windowMs });
    next();
    return;
  }

  const limit = rateLimiter.get(key);

  if (now > limit.resetTime) {
    limit.count = 1;
    limit.resetTime = now + windowMs;
    next();
  } else if (limit.count < maxRequests) {
    limit.count++;
    next();
  } else {
    socket.close(1008, 'Rate limit exceeded');
  }
});
```

### **Logging Middleware**

```typescript
app.wsUse((socket, req, next) => {
  const startTime = Date.now();

  console.log(\`[WS] Connection: \${socket.id} from \${socket.ip}\`);

  socket.on('message', (data) => {
    console.log(\`[WS] Message from \${socket.id}: \${data.slice(0, 100)}\`);
  });

  socket.socket.on('close', () => {
    const duration = Date.now() - startTime;
    console.log(\`[WS] Disconnection: \${socket.id} (duration: \${duration}ms)\`);
  });

  next();
});
```

---

## **🎭 Event Handling**

### **Built-in Events**

```typescript
app.ws('/events', (socket, req) => {
  // Message events
  socket.on('message', (data) => {
    console.log('Text message:', data);
  });

  // Connection events
  socket.on('close', (code, reason) => {
    console.log(\`Connection closed: \${code} - \${reason}\`);
  });

  socket.on('error', (error) => {
    console.log('Socket error:', error);
  });

  // Ping/Pong events
  socket.on('ping', () => {
    console.log('Ping received');
  });

  socket.on('pong', () => {
    console.log('Pong received');
  });
});
```

### **Custom Events**

```typescript
app.ws('/custom', (socket, req) => {
  // Custom event handling
  socket.on('user-action', (action, data) => {
    switch (action) {
      case 'like':
        handleLike(socket, data);
        break;
      case 'comment':
        handleComment(socket, data);
        break;
      case 'share':
        handleShare(socket, data);
        break;
    }
  });

  // Event emitting
  socket.emit('notification', {
    type: 'welcome',
    message: 'Welcome to the platform!',
    timestamp: Date.now()
  });
});

function handleLike(socket, data) {
  // Process like action
  socket.to(\`post-\${data.postId}\`).emit('like-update', {
    postId: data.postId,
    likes: data.newLikeCount,
    userId: socket.metadata.user?.id
  });
}
```

---

## **🔒 Security Features**

### **Origin Validation**

```typescript
app.enableWebSocket({
  origins: [
    'https://myapp.com',
    'https://admin.myapp.com',
    'http://localhost:3000', // Development only
  ],
});
```

### **Input Validation**

```typescript
app.ws('/secure', (socket, req) => {
  socket.on('message', (rawData) => {
    // Validate message size
    if (rawData.length > 10000) {
      socket.close(1009, 'Message too large');
      return;
    }

    // Validate JSON
    try {
      const data = JSON.parse(rawData);

      // Validate message structure
      if (!data.type || typeof data.type !== 'string') {
        socket.send({ error: 'Invalid message format' });
        return;
      }

      // Sanitize input
      if (data.text) {
        data.text = data.text.replace(/<script[^>]*>.*?<\\/script>/gi, '');
      }

      processMessage(socket, data);
    } catch (error) {
      socket.send({ error: 'Invalid JSON' });
    }
  });
});
```

### **Connection Limits**

```typescript
const connectionsByIP = new Map();

app.wsUse((socket, req, next) => {
  const ip = socket.ip;
  const maxConnectionsPerIP = 10;

  const count = connectionsByIP.get(ip) || 0;

  if (count >= maxConnectionsPerIP) {
    socket.close(1008, 'Too many connections from this IP');
    return;
  }

  connectionsByIP.set(ip, count + 1);

  socket.socket.on('close', () => {
    connectionsByIP.set(ip, Math.max(0, connectionsByIP.get(ip) - 1));
  });

  next();
});
```

---

## **📊 Performance & Monitoring**

### **WebSocket Statistics**

```typescript
app.get('/api/websocket/stats', (req, res) => {
  const stats = app.getWebSocketStats();

  res.json({
    connections: stats.connections,
    rooms: stats.rooms,
    messagesReceived: stats.messagesReceived,
    messagesSent: stats.messagesSent,
    bytesReceived: stats.bytesReceived,
    bytesSent: stats.bytesSent,
    uptime: stats.uptime,
    averageLatency: stats.averageLatency,
  });
});
```

### **Health Monitoring**

```typescript
app.get('/api/websocket/health', (req, res) => {
  const connections = app.getWebSocketConnections();
  const healthyConnections = connections.filter((socket) => socket.isAlive);

  res.json({
    status: 'healthy',
    totalConnections: connections.length,
    healthyConnections: healthyConnections.length,
    unhealthyConnections: connections.length - healthyConnections.length,
    timestamp: new Date().toISOString(),
  });
});
```

### **Performance Optimization**

```typescript
app.enableWebSocket({
  // Optimize for high throughput
  maxConnections: 10000,
  pingInterval: 60000, // Less frequent pings
  maxMessageSize: 64 * 1024, // Smaller messages

  // Room optimization
  maxRooms: 5000,
  roomCleanupInterval: 300000, // 5 minutes

  // Performance monitoring
  debug: false, // Disable in production
});
```

---

## **🎯 Best Practices**

## **💡 Best Practices**

### **1. 📋 Message Structure Standards**

Always use consistent, well-structured message formats for maintainability:

```typescript
// ✅ Good: Structured messages with clear typing
interface ChatMessage {
  type: 'chat' | 'join' | 'leave' | 'error' | 'notification';
  data: any;
  timestamp: number;
  userId?: string;
  room?: string;
  metadata?: Record<string, any>;
}

// 🎯 Send properly structured messages
socket.send({
  type: 'chat',
  data: {
    text: '👋 Hello everyone!',
    room: 'general',
    mentions: ['@user123'],
  },
  timestamp: Date.now(),
  userId: socket.metadata.user?.id,
  metadata: {
    messageId: generateId(),
    edited: false,
    priority: 'normal',
  },
});

// ❌ Bad: Unstructured messages
socket.send('Hello!'); // No context or structure
socket.send({ msg: 'hi' }); // Inconsistent format
```

### **2. 🛡️ Comprehensive Error Handling**

Implement robust error handling at every level:

```typescript
app.ws('/chat', (socket, req) => {
  // 🎯 Message level error handling
  socket.on('message', async (data) => {
    try {
      // 📝 Parse with validation
      const message = JSON.parse(data);

      // 🔍 Validate message structure
      if (!isValidMessage(message)) {
        socket.send({
          type: 'error',
          code: 'INVALID_MESSAGE',
          message: '❌ Invalid message format',
          timestamp: Date.now()
        });
        return;
      }

      await processMessage(socket, message);

    } catch (parseError) {
      console.error(`🚨 JSON parse error for ${socket.id}:`, parseError);
      socket.send({
        type: 'error',
        code: 'PARSE_ERROR',
        message: '🔧 Invalid JSON format',
        timestamp: Date.now()
      });
    } catch (processError) {
      console.error(`🚨 Processing error for ${socket.id}:`, processError);
      socket.send({
        type: 'error',
        code: 'PROCESS_ERROR',
        message: '⚠️ Failed to process message',
        timestamp: Date.now()
      });
    }
  });

  // 🔌 Connection level error handling
  socket.socket.on('error', (error) => {
    console.error(`🚨 Socket error for ${socket.id}:`, error);
    // Log for monitoring but don't close connection immediately
  });

  // 📊 Unexpected close handling
  socket.socket.on('close', (code, reason) => {
    if (code !== 1000) { // Not normal closure
      console.warn(`⚠️ Unexpected close for ${socket.id}: ${code} - ${reason}`);
    }
  });
});

// 🔍 Message validation helper
function isValidMessage(message: any): message is ChatMessage {
  return message &&
         typeof message === 'object' &&
         typeof message.type === 'string' &&
         typeof message.timestamp === 'number' &&
         message.timestamp > 0;
}
```

### **3. 🧹 Resource Management**

Properly manage memory and connections:

```typescript
app.ws('/resource-aware', (socket, req) => {
  // 📊 Track resource usage
  const connectionStartTime = Date.now();
  const messageBuffer = new Map(); // Store recent messages
  let messageCount = 0;
  let lastActivity = Date.now();

  // 🔄 Periodic cleanup
  const cleanupInterval = setInterval(() => {
    // 🧹 Clean old messages from buffer
    const cutoffTime = Date.now() - 5 * 60 * 1000; // 5 minutes
    for (const [id, timestamp] of messageBuffer.entries()) {
      if (timestamp < cutoffTime) {
        messageBuffer.delete(id);
      }
    }
  }, 60000); // Every minute

  // 📨 Message handling with limits
  socket.on('message', async (data) => {
    lastActivity = Date.now();
    messageCount++;

    // 🚦 Rate limiting per connection
    if (messageCount > 1000) {
      // Reset hourly
      socket.send({
        type: 'warning',
        message: '⚠️ Message rate limit approaching',
        limit: 1000,
        current: messageCount,
      });
    }

    // 💾 Store message in buffer
    const messageId = generateId();
    messageBuffer.set(messageId, Date.now());

    try {
      await processMessage(socket, JSON.parse(data));
    } catch (error) {
      console.error('Message processing failed:', error);
    }
  });

  // 🏠 Limit room memberships
  socket.on('join-room', async (roomName) => {
    if (socket.rooms.size >= 10) {
      socket.send({
        type: 'error',
        code: 'ROOM_LIMIT',
        message: '🏠 Maximum room limit reached (10)',
        currentRooms: Array.from(socket.rooms),
      });
      return;
    }

    await socket.join(roomName);
  });

  // 🧹 Cleanup on disconnect
  socket.socket.on('close', () => {
    clearInterval(cleanupInterval);

    // 📊 Log connection stats
    const duration = Date.now() - connectionStartTime;
    console.log(`📊 Connection stats for ${socket.id}:`, {
      duration: `${Math.round(duration / 1000)}s`,
      messageCount,
      averageMessagesPerMinute: Math.round((messageCount / duration) * 60000),
      roomsJoined: socket.rooms.size,
      lastActivity: new Date(lastActivity).toISOString(),
    });

    // 🧹 Clean up user sessions
    cleanupUserSession(socket.metadata.user?.id);

    // 🗑️ Clean up message buffer
    messageBuffer.clear();
  });
});

// 🧹 User session cleanup
function cleanupUserSession(userId: string) {
  if (!userId) return;

  // Clean up user-specific data
  // Remove from active users list
  // Clean up temporary files
  // Cancel pending operations
}
```

### **4. 🔒 Graceful Shutdown**

Handle server shutdown gracefully:

```typescript
// 🛑 Graceful shutdown handler
process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');

  // 📢 Notify all connected clients
  app.wsBroadcast({
    type: 'server-shutdown',
    message: '🔄 Server is shutting down for maintenance',
    countdown: 30000,
    reconnectAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    timestamp: Date.now(),
  });

  // ⏳ Give clients time to receive message
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // 📊 Get final stats
  const stats = app.getWebSocketStats();
  console.log('📊 Final WebSocket stats:', {
    totalConnections: stats?.totalConnections || 0,
    currentConnections: stats?.connections || 0,
    totalMessages: stats?.messagesReceived || 0,
    uptime: stats?.uptime || '0s',
  });

  // 🔌 Close all connections gracefully
  const connections = app.getWebSocketConnections() || [];
  console.log(`🔌 Closing ${connections.length} active connections...`);

  // 👋 Close connections with proper close code
  connections.forEach((socket) => {
    socket.close(1001, 'Server shutdown');
  });

  // ⏳ Wait for connections to close
  setTimeout(async () => {
    console.log('✅ WebSocket server shutdown complete');
    await app.close();
    process.exit(0);
  }, 5000);
});

// 📡 Handle client reconnection
app.ws('/reconnect', (socket, req) => {
  // 🔄 Handle reconnection logic
  const clientId = req.headers['x-client-id'];

  if (clientId) {
    // 📝 Restore session if available
    const savedSession = restoreClientSession(clientId);

    if (savedSession) {
      socket.metadata = { ...savedSession };

      // 🏠 Rejoin previous rooms
      savedSession.rooms?.forEach(async (room) => {
        await socket.join(room);
      });

      socket.send({
        type: 'session-restored',
        message: '🔄 Session restored successfully',
        rooms: savedSession.rooms || [],
        lastSeen: savedSession.lastSeen,
      });
    }
  }
});
```

### **5. 📊 Performance Optimization**

Optimize for production workloads:

```typescript
// 🚀 Production configuration
app.enableWebSocket({
  // 🔧 Connection limits
  maxConnections: 10000,
  pingInterval: 60000, // Less frequent pings for performance
  maxMessageSize: 64 * 1024, // Reasonable message size limit

  // 🏠 Room optimization
  maxRooms: 5000,
  roomCleanupInterval: 300000, // 5 minutes

  // 🔇 Disable debug in production
  debug: false,

  // 🌐 Strict origin checking
  origins: ['https://yourdomain.com', 'https://app.yourdomain.com'],
});

// 📊 Performance monitoring
const performanceMetrics = {
  messagesPerSecond: 0,
  connectionsPerMinute: 0,
  averageLatency: 0,
  errorRate: 0,
};

// 📈 Track performance metrics
setInterval(() => {
  const stats = app.getWebSocketStats();
  if (stats) {
    performanceMetrics.messagesPerSecond =
      stats.messagesReceived / (stats.uptime / 1000);

    // 🚨 Alert on performance issues
    if (performanceMetrics.messagesPerSecond > 10000) {
      console.warn(
        '⚠️ High message rate detected:',
        performanceMetrics.messagesPerSecond
      );
    }

    if (stats.connections > 8000) {
      console.warn('⚠️ High connection count:', stats.connections);
    }
  }
}, 30000);

// 🎯 Efficient message broadcasting
function efficientBroadcast(message: any, roomName?: string) {
  // 📦 Pre-stringify message for better performance
  const serializedMessage = JSON.stringify(message);

  if (roomName) {
    app.wsBroadcast(serializedMessage, roomName);
  } else {
    app.wsBroadcast(serializedMessage);
  }
}
```

### **2. Error Handling**

```typescript
app.ws('/chat', (socket, req) => {
  socket.on('message', async (data) => {
    try {
      const message = JSON.parse(data);
      await processMessage(socket, message);
    } catch (error) {
      console.error('Message processing error:', error);
      socket.send({
        type: 'error',
        message: 'Failed to process message',
        timestamp: Date.now()
      });
    }
  });

  socket.socket.on('error', (error) => {
    console.error(\`Socket error for \${socket.id}:\`, error);
  });
});
```

### **3. Resource Management**

```typescript
app.ws('/resource-aware', (socket, req) => {
  // Clean up resources on disconnect
  socket.socket.on('close', () => {
    // Clean up user sessions
    cleanupUserSession(socket.metadata.user?.id);

    // Remove from active connections
    removeFromActiveUsers(socket.id);

    // Clean up room subscriptions (automatic)
  });

  // Limit room memberships
  socket.on('join-room', async (roomName) => {
    if (socket.rooms.size >= 10) {
      socket.send({ error: 'Too many room memberships' });
      return;
    }

    await socket.join(roomName);
  });
});
```

### **4. Graceful Shutdown**

```typescript
process.on('SIGTERM', async () => {
  console.log('Shutting down WebSocket server...');

  // Notify all connected clients
  app.wsBroadcast({
    type: 'server-shutdown',
    message: 'Server is shutting down',
    countdown: 30000,
  });

  // Wait for clients to disconnect gracefully
  setTimeout(async () => {
    await app.close();
    process.exit(0);
  }, 30000);
});
```

---

## **🎮 Real-World Examples**

### **💬 Real-time Chat Application**

Build a production-ready chat app with NextRush WebSocket:

```typescript
interface ChatUser {
  id: string;
  username: string;
  room: string;
  avatar?: string;
  joinedAt: Date;
  isOnline: boolean;
}

interface ChatMessage {
  id: string;
  type: 'message' | 'image' | 'file';
  text: string;
  username: string;
  room: string;
  timestamp: Date;
  mentions?: string[];
  reactions?: { emoji: string; users: string[] }[];
}

const chatUsers = new Map<string, ChatUser>();
const messageHistory = new Map<string, ChatMessage[]>();

app.ws('/chat', async (socket, req) => {
  let user: ChatUser | null = null;

  socket.on('message', async (data) => {
    const message = JSON.parse(data);

    switch (message.type) {
      case 'join':
        // 👤 User joins chat
        user = {
          id: socket.id,
          username: message.username || `User_${socket.id.slice(-4)}`,
          room: message.room || 'general',
          avatar: message.avatar,
          joinedAt: new Date(),
          isOnline: true,
        };

        chatUsers.set(socket.id, user);
        await socket.join(user.room);

        // 📨 Send chat history
        const history = messageHistory.get(user.room) || [];
        socket.send({
          type: 'chat-history',
          messages: history.slice(-50), // Last 50 messages
          room: user.room,
        });

        // 👥 Send current users
        const roomUsers = Array.from(chatUsers.values()).filter(
          (u) => u.room === user.room && u.isOnline
        );

        socket.send({
          type: 'room-users',
          users: roomUsers.map((u) => ({
            id: u.id,
            username: u.username,
            avatar: u.avatar,
            joinedAt: u.joinedAt,
          })),
          room: user.room,
        });

        // 📢 Notify room about new user
        socket.to(user.room).send({
          type: 'user-joined',
          user: {
            id: user.id,
            username: user.username,
            avatar: user.avatar,
          },
          room: user.room,
          timestamp: new Date(),
        });
        break;

      case 'message':
        if (user) {
          const chatMessage: ChatMessage = {
            id: generateMessageId(),
            type: 'message',
            text: message.text,
            username: user.username,
            room: user.room,
            timestamp: new Date(),
            mentions: extractMentions(message.text),
            reactions: [],
          };

          // 💾 Store message
          if (!messageHistory.has(user.room)) {
            messageHistory.set(user.room, []);
          }
          messageHistory.get(user.room)!.push(chatMessage);

          // 📢 Broadcast to room
          socket.to(user.room).send({
            type: 'new-message',
            message: chatMessage,
            room: user.room,
          });

          // ✅ Confirm to sender
          socket.send({
            type: 'message-sent',
            messageId: chatMessage.id,
            timestamp: chatMessage.timestamp,
          });
        }
        break;

      case 'typing':
        if (user) {
          socket.to(user.room).send({
            type: 'typing-indicator',
            username: user.username,
            isTyping: message.isTyping,
            room: user.room,
          });
        }
        break;

      case 'reaction':
        if (user && message.messageId) {
          // 💝 Add reaction to message
          const room = messageHistory.get(user.room);
          const targetMessage = room?.find((m) => m.id === message.messageId);

          if (targetMessage) {
            const reaction = targetMessage.reactions?.find(
              (r) => r.emoji === message.emoji
            );
            if (reaction) {
              if (!reaction.users.includes(user.username)) {
                reaction.users.push(user.username);
              }
            } else {
              targetMessage.reactions = targetMessage.reactions || [];
              targetMessage.reactions.push({
                emoji: message.emoji,
                users: [user.username],
              });
            }

            // 📢 Broadcast reaction update
            socket.to(user.room).send({
              type: 'message-reaction',
              messageId: message.messageId,
              emoji: message.emoji,
              username: user.username,
              room: user.room,
            });
          }
        }
        break;
    }
  });

  // 🧹 Cleanup on disconnect
  socket.socket.on('close', () => {
    if (user) {
      user.isOnline = false;
      chatUsers.delete(socket.id);

      socket.to(user.room).send({
        type: 'user-left',
        user: {
          id: user.id,
          username: user.username,
        },
        room: user.room,
        timestamp: new Date(),
      });
    }
  });
});

// 🔧 Helper functions
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function extractMentions(text: string): string[] {
  const mentions = text.match(/@(\w+)/g);
  return mentions ? mentions.map((m) => m.substring(1)) : [];
}
```

### **🎯 Real-time Gaming Server**

Create a multiplayer game server with synchronized game state:

```typescript
interface GamePlayer {
  id: string;
  username: string;
  x: number;
  y: number;
  health: number;
  score: number;
  room: string;
  isAlive: boolean;
  powerUps: string[];
  lastAction: Date;
}

interface GameRoom {
  id: string;
  name: string;
  players: Map<string, GamePlayer>;
  gameState: 'waiting' | 'playing' | 'finished';
  startTime?: Date;
  maxPlayers: number;
  config: GameConfig;
}

interface GameConfig {
  mapSize: { width: number; height: number };
  powerUpSpawnRate: number;
  gameMode: 'deathmatch' | 'team' | 'survival';
  timeLimit: number; // minutes
}

const gameRooms = new Map<string, GameRoom>();

app.ws('/game', async (socket, req) => {
  let player: GamePlayer | null = null;
  let gameRoom: GameRoom | null = null;

  socket.on('message', async (data) => {
    const message = JSON.parse(data);

    switch (message.type) {
      case 'join-game':
        // 🎮 Player joins game
        const roomId = message.roomId || 'default';

        if (!gameRooms.has(roomId)) {
          // 🏗️ Create new game room
          gameRooms.set(roomId, {
            id: roomId,
            name: message.roomName || `Game Room ${roomId}`,
            players: new Map(),
            gameState: 'waiting',
            maxPlayers: 8,
            config: {
              mapSize: { width: 1000, height: 800 },
              powerUpSpawnRate: 0.02,
              gameMode: 'deathmatch',
              timeLimit: 10,
            },
          });
        }

        gameRoom = gameRooms.get(roomId)!;

        if (gameRoom.players.size >= gameRoom.maxPlayers) {
          socket.send({
            type: 'error',
            message: '🚫 Game room is full',
            maxPlayers: gameRoom.maxPlayers,
          });
          break;
        }

        player = {
          id: socket.id,
          username: message.username || `Player_${socket.id.slice(-4)}`,
          x: Math.random() * gameRoom.config.mapSize.width,
          y: Math.random() * gameRoom.config.mapSize.height,
          health: 100,
          score: 0,
          room: roomId,
          isAlive: true,
          powerUps: [],
          lastAction: new Date(),
        };

        gameRoom.players.set(socket.id, player);
        await socket.join(roomId);

        // 📊 Send initial game state
        socket.send({
          type: 'game-joined',
          player: player,
          room: gameRoom,
          players: Array.from(gameRoom.players.values()),
          gameState: gameRoom.gameState,
        });

        // 📢 Notify other players
        socket.to(roomId).send({
          type: 'player-joined',
          player: player,
          totalPlayers: gameRoom.players.size,
        });

        // 🎯 Start game if enough players
        if (gameRoom.players.size >= 2 && gameRoom.gameState === 'waiting') {
          startGame(roomId);
        }
        break;

      case 'player-action':
        if (player && gameRoom && gameRoom.gameState === 'playing') {
          player.lastAction = new Date();

          switch (message.action) {
            case 'move':
              // 🏃 Update player position
              player.x = Math.max(
                0,
                Math.min(gameRoom.config.mapSize.width, message.x)
              );
              player.y = Math.max(
                0,
                Math.min(gameRoom.config.mapSize.height, message.y)
              );

              socket.to(player.room).send({
                type: 'player-moved',
                playerId: socket.id,
                x: player.x,
                y: player.y,
                timestamp: Date.now(),
              });
              break;

            case 'attack':
              // ⚔️ Handle attack action
              const target = findNearbyPlayers(player, gameRoom, 50);
              if (target) {
                target.health -= 25;

                if (target.health <= 0) {
                  target.isAlive = false;
                  player.score += 100;

                  socket.to(player.room).send({
                    type: 'player-eliminated',
                    killer: player.id,
                    victim: target.id,
                    killerScore: player.score,
                  });

                  // 🏆 Check for game end
                  checkGameEnd(gameRoom);
                }
              }
              break;

            case 'use-powerup':
              // ⚡ Use power-up
              const powerUpIndex = player.powerUps.indexOf(message.powerUp);
              if (powerUpIndex !== -1) {
                player.powerUps.splice(powerUpIndex, 1);
                applyPowerUp(player, message.powerUp);

                socket.to(player.room).send({
                  type: 'powerup-used',
                  playerId: socket.id,
                  powerUp: message.powerUp,
                });
              }
              break;
          }
        }
        break;

      case 'chat':
        if (player) {
          // 💬 In-game chat
          socket.to(player.room).send({
            type: 'game-chat',
            username: player.username,
            message: message.text,
            timestamp: new Date(),
          });
        }
        break;
    }
  });

  // 🔄 Game loop for real-time updates
  const gameInterval = setInterval(() => {
    if (player && gameRoom && gameRoom.gameState === 'playing') {
      // 🎯 Send periodic game state update
      socket.to(player.room).send({
        type: 'game-state-update',
        players: Array.from(gameRoom.players.values()).map((p) => ({
          id: p.id,
          username: p.username,
          x: p.x,
          y: p.y,
          health: p.health,
          score: p.score,
          isAlive: p.isAlive,
          powerUps: p.powerUps,
        })),
        timestamp: Date.now(),
      });

      // ⚡ Spawn power-ups randomly
      if (Math.random() < gameRoom.config.powerUpSpawnRate) {
        spawnPowerUp(gameRoom);
      }
    }
  }, 1000 / 30); // 30 FPS

  // 🧹 Cleanup on disconnect
  socket.socket.on('close', () => {
    clearInterval(gameInterval);

    if (player && gameRoom) {
      gameRoom.players.delete(socket.id);

      socket.to(player.room).send({
        type: 'player-left',
        playerId: socket.id,
        remainingPlayers: gameRoom.players.size,
      });

      // 🏁 End game if not enough players
      if (gameRoom.players.size < 2 && gameRoom.gameState === 'playing') {
        endGame(gameRoom, 'insufficient_players');
      }

      // 🗑️ Remove empty rooms
      if (gameRoom.players.size === 0) {
        gameRooms.delete(player.room);
      }
    }
  });
});

// 🎮 Game management functions
function startGame(roomId: string) {
  const room = gameRooms.get(roomId);
  if (!room) return;

  room.gameState = 'playing';
  room.startTime = new Date();

  // 📢 Notify all players
  Array.from(room.players.keys()).forEach((playerId) => {
    app.wsBroadcast(
      {
        type: 'game-started',
        room: roomId,
        startTime: room.startTime,
        config: room.config,
      },
      roomId
    );
  });

  // ⏰ Set game timer
  setTimeout(() => {
    endGame(room, 'time_limit');
  }, room.config.timeLimit * 60 * 1000);
}

function findNearbyPlayers(
  attacker: GamePlayer,
  room: GameRoom,
  range: number
): GamePlayer | null {
  for (const [id, player] of room.players) {
    if (id !== attacker.id && player.isAlive) {
      const distance = Math.sqrt(
        Math.pow(player.x - attacker.x, 2) + Math.pow(player.y - attacker.y, 2)
      );
      if (distance <= range) {
        return player;
      }
    }
  }
  return null;
}

function spawnPowerUp(room: GameRoom) {
  const powerUps = ['health', 'speed', 'damage', 'shield'];
  const powerUp = {
    type: powerUps[Math.floor(Math.random() * powerUps.length)],
    x: Math.random() * room.config.mapSize.width,
    y: Math.random() * room.config.mapSize.height,
    id: `powerup_${Date.now()}`,
  };

  // 📢 Broadcast power-up spawn
  app.wsBroadcast(
    {
      type: 'powerup-spawned',
      powerUp: powerUp,
    },
    room.id
  );
}

function checkGameEnd(room: GameRoom) {
  const alivePlayers = Array.from(room.players.values()).filter(
    (p) => p.isAlive
  );

  if (alivePlayers.length <= 1) {
    endGame(room, 'last_player_standing');
  }
}

function endGame(room: GameRoom, reason: string) {
  room.gameState = 'finished';

  const finalScores = Array.from(room.players.values()).sort(
    (a, b) => b.score - a.score
  );

  // 🏆 Announce winner
  app.wsBroadcast(
    {
      type: 'game-ended',
      reason: reason,
      winner: finalScores[0],
      finalScores: finalScores,
      duration: room.startTime ? Date.now() - room.startTime.getTime() : 0,
    },
    room.id
  );
}
```

### **📊 Live Analytics Dashboard**

Create a real-time dashboard for monitoring application metrics:

```typescript
interface MetricData {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
}

interface DashboardClient {
  id: string;
  subscribedMetrics: Set<string>;
  filters: Record<string, any>;
  lastActivity: Date;
}

const dashboardClients = new Map<string, DashboardClient>();
const metricsHistory = new Map<string, MetricData[]>();

app.ws('/dashboard', (socket, req) => {
  const client: DashboardClient = {
    id: socket.id,
    subscribedMetrics: new Set(),
    filters: {},
    lastActivity: new Date(),
  };

  dashboardClients.set(socket.id, client);

  // 📊 Send initial dashboard data
  socket.send({
    type: 'dashboard-init',
    data: getCurrentDashboardData(),
    availableMetrics: getAvailableMetrics(),
    timestamp: new Date(),
  });

  socket.on('message', (data) => {
    const message = JSON.parse(data);
    client.lastActivity = new Date();

    switch (message.type) {
      case 'subscribe-metrics':
        // 📈 Subscribe to specific metrics
        message.metrics.forEach((metric: string) => {
          client.subscribedMetrics.add(metric);
          socket.join(`metric-${metric}`);
        });

        socket.send({
          type: 'subscription-confirmed',
          metrics: Array.from(client.subscribedMetrics),
          message: `📊 Subscribed to ${message.metrics.length} metrics`,
        });
        break;

      case 'unsubscribe-metrics':
        // 📉 Unsubscribe from metrics
        message.metrics.forEach((metric: string) => {
          client.subscribedMetrics.delete(metric);
          socket.leave(`metric-${metric}`);
        });
        break;

      case 'set-filters':
        // 🔍 Set data filters
        client.filters = message.filters;

        // Send filtered historical data
        const filteredData = getFilteredMetrics(client.filters);
        socket.send({
          type: 'filtered-data',
          data: filteredData,
          filters: client.filters,
        });
        break;

      case 'request-history':
        // 📜 Request historical data
        const historyData = getMetricHistory(
          message.metric,
          message.timeRange || '1h'
        );

        socket.send({
          type: 'metric-history',
          metric: message.metric,
          data: historyData,
          timeRange: message.timeRange,
        });
        break;

      case 'export-data':
        // 📤 Export metrics data
        const exportData = prepareExportData(
          Array.from(client.subscribedMetrics),
          message.format || 'json'
        );

        socket.send({
          type: 'export-ready',
          format: message.format,
          data: exportData,
          filename: `metrics-export-${Date.now()}.${message.format}`,
        });
        break;
    }
  });

  // 🧹 Cleanup on disconnect
  socket.socket.on('close', () => {
    dashboardClients.delete(socket.id);
    console.log(`📊 Dashboard client disconnected: ${socket.id}`);
  });
});

// 📊 Background metric collection and broadcasting
setInterval(() => {
  const metrics = collectSystemMetrics();

  // 📈 Process and store each metric
  Object.entries(metrics).forEach(([metricName, data]) => {
    const metricData: MetricData = {
      name: metricName,
      value: data.value,
      timestamp: new Date(),
      tags: data.tags,
    };

    // 💾 Store in history
    if (!metricsHistory.has(metricName)) {
      metricsHistory.set(metricName, []);
    }

    const history = metricsHistory.get(metricName)!;
    history.push(metricData);

    // 🧹 Keep only last 1000 entries
    if (history.length > 1000) {
      history.shift();
    }

    // 📢 Broadcast to subscribed clients
    app.wsBroadcast(
      {
        type: 'metric-update',
        metric: metricName,
        data: metricData,
        trend: calculateTrend(history),
        threshold: checkThresholds(metricData),
      },
      `metric-${metricName}`
    );
  });

  // 🚨 Check for alerts
  checkMetricAlerts(metrics);
}, 5000); // Every 5 seconds

// 📊 Helper functions
function getCurrentDashboardData() {
  return {
    systemHealth: getSystemHealth(),
    activeConnections: dashboardClients.size,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
  };
}

function collectSystemMetrics() {
  const wsStats = app.getWebSocketStats();

  return {
    'websocket.connections': {
      value: wsStats?.connections || 0,
      tags: { type: 'realtime' },
    },
    'websocket.messages_per_second': {
      value: calculateMessageRate(),
      tags: { type: 'throughput' },
    },
    'system.memory_usage': {
      value: process.memoryUsage().heapUsed / 1024 / 1024, // MB
      tags: { type: 'system' },
    },
    'system.cpu_usage': {
      value: process.cpuUsage().user / 1000000, // Convert to seconds
      tags: { type: 'system' },
    },
    'application.response_time': {
      value: getAverageResponseTime(),
      tags: { type: 'performance' },
    },
  };
}

function calculateTrend(history: MetricData[]) {
  if (history.length < 2) return 'stable';

  const recent = history.slice(-10);
  const values = recent.map((m) => m.value);
  const trend = values[values.length - 1] - values[0];

  if (trend > 0.1) return 'increasing';
  if (trend < -0.1) return 'decreasing';
  return 'stable';
}
```

---

## **🔧 Troubleshooting**

### **Common Issues**

#### **Connection Fails**

```typescript
// Check if WebSocket is enabled
if (!app.getWebSocketStats()) {
  console.error('WebSocket not enabled. Call app.enableWebSocket() first.');
}

// Check server is listening
app.listen(3000, () => {
  console.log('✅ Server listening on port 3000');
  console.log('✅ WebSocket ready at ws://localhost:3000');
});
```

#### **Messages Not Received**

```typescript
app.ws('/debug', (socket, req) => {
  socket.on('message', (data) => {
    console.log('📨 Message received:', {
      socketId: socket.id,
      data: data,
      length: data.length,
      type: typeof data
    });

    // Echo back to confirm
    socket.send(\`Received: \${data}\`);
  });
});
```

#### **Room Broadcasting Issues**

```typescript
app.ws('/room-debug', async (socket, req) => {
  await socket.join('test-room');

  socket.on('message', (data) => {
    console.log('📊 Room info:', {
      socketRooms: Array.from(socket.rooms),
      messageData: data,
    });

    // Test broadcast
    socket.to('test-room').send('Broadcast test');
  });
});
```

### **Performance Issues**

#### **High Memory Usage**

```typescript
// Monitor connection count
setInterval(() => {
  const stats = app.getWebSocketStats();
  if (stats && stats.connections > 1000) {
    console.warn(\`⚠️ High connection count: \${stats.connections}\`);
  }
}, 30000);

// Implement connection limits
app.enableWebSocket({
  maxConnections: 5000, // Adjust based on server capacity
  pingInterval: 30000,  // Reduce ping frequency
  maxMessageSize: 1024 * 64 // Limit message size
});
```

#### **Message Queue Buildup**

```typescript
app.wsUse((socket, req, next) => {
  let messageCount = 0;
  const maxMessagesPerSecond = 10;

  socket.on('message', () => {
    messageCount++;

    setTimeout(() => {
      messageCount--;
    }, 1000);

    if (messageCount > maxMessagesPerSecond) {
      socket.close(1008, 'Message rate limit exceeded');
    }
  });

  next();
});
```

### **Debug Mode**

```typescript
app.enableWebSocket({
  debug: true, // Enable detailed logging
});

// Custom debug logging
app.wsUse((socket, req, next) => {
  console.log('🔍 Debug info:', {
    socketId: socket.id,
    ip: socket.ip,
    userAgent: socket.userAgent,
    origin: socket.origin,
    timestamp: new Date().toISOString(),
  });

  next();
});
```

---

## **� Advanced Features**

### **🔄 Automatic Reconnection**

Implement smart reconnection logic for resilient connections:

```typescript
// 🔌 Client-side reconnection helper
class NextRushWebSocketClient {
  private socket: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private messageQueue: any[] = [];
  private isConnected = false;

  constructor(url: string) {
    this.url = url;
    this.connect();
  }

  private connect() {
    try {
      this.socket = new WebSocket(this.url);

      this.socket.onopen = () => {
        console.log('🎉 Connected to NextRush WebSocket');
        this.isConnected = true;
        this.reconnectAttempts = 0;

        // 📤 Send queued messages
        while (this.messageQueue.length > 0) {
          const message = this.messageQueue.shift();
          this.send(message);
        }
      };

      this.socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      };

      this.socket.onclose = () => {
        console.log('🔌 Connection closed');
        this.isConnected = false;
        this.attemptReconnect();
      };

      this.socket.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
      };
    } catch (error) {
      console.error('🚨 Connection failed:', error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('🚫 Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

    console.log(
      `🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`
    );

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  public send(data: any) {
    if (this.isConnected && this.socket) {
      this.socket.send(JSON.stringify(data));
    } else {
      // 📝 Queue message for later
      this.messageQueue.push(data);
      console.log('📝 Message queued (not connected)');
    }
  }

  private handleMessage(data: any) {
    // 🎯 Handle different message types
    switch (data.type) {
      case 'welcome':
        console.log('👋 Server welcome:', data.message);
        break;
      case 'error':
        console.error('❌ Server error:', data.message);
        break;
      // ... handle other message types
    }
  }
}

// 🖥️ Server-side reconnection support
app.ws('/reconnect-demo', (socket, req) => {
  const clientId = req.headers['x-client-id'] as string;

  if (clientId) {
    // 🔄 Restore previous session
    const session = getStoredSession(clientId);
    if (session) {
      socket.metadata = session.metadata;

      // 🏠 Rejoin previous rooms
      session.rooms?.forEach(async (room) => {
        await socket.join(room);
      });

      socket.send({
        type: 'session-restored',
        message: '🔄 Welcome back! Session restored.',
        previousRooms: session.rooms,
        lastSeen: session.lastSeen,
      });
    }
  }

  // 💾 Store session on activity
  socket.on('message', () => {
    if (clientId) {
      storeSession(clientId, {
        metadata: socket.metadata,
        rooms: Array.from(socket.rooms),
        lastSeen: new Date(),
      });
    }
  });
});
```

### **🔐 Advanced Authentication & Authorization**

Implement JWT-based authentication with role-based access:

```typescript
import jwt from 'jsonwebtoken';

interface AuthenticatedUser {
  id: string;
  username: string;
  roles: string[];
  permissions: string[];
}

// 🔐 Authentication middleware
app.wsUse(async (socket, req, next) => {
  try {
    const token =
      req.headers.authorization?.replace('Bearer ', '') ||
      req.url?.split('token=')[1];

    if (!token) {
      socket.close(1008, '🔒 Authentication required');
      return;
    }

    // 🔍 Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const user: AuthenticatedUser = await getUserById(decoded.userId);

    if (!user) {
      socket.close(1008, '👤 User not found');
      return;
    }

    // 💾 Store user info
    socket.metadata.user = user;
    socket.metadata.authenticated = true;

    console.log(
      `🔐 Authenticated user: ${user.username} (${user.roles.join(', ')})`
    );
    next();
  } catch (error) {
    console.error('🚨 Authentication failed:', error);
    socket.close(1008, '🔒 Invalid token');
  }
});

// 🛡️ Role-based route protection
function requireRole(requiredRoles: string[]) {
  return (socket: any, req: any, next: any) => {
    const user = socket.metadata.user;

    if (!user) {
      socket.close(1008, '🔒 Authentication required');
      return;
    }

    const hasRole = requiredRoles.some((role) => user.roles.includes(role));

    if (!hasRole) {
      socket.close(
        1008,
        `🚫 Access denied. Required roles: ${requiredRoles.join(', ')}`
      );
      return;
    }

    next();
  };
}

// 🔒 Protected admin route
app.wsUse('/admin/*', requireRole(['admin', 'moderator']));

app.ws('/admin/monitor', (socket, req) => {
  const user = socket.metadata.user;

  socket.send({
    type: 'admin-welcome',
    message: `👨‍💼 Welcome to admin panel, ${user.username}!`,
    permissions: user.permissions,
  });

  // 📊 Send admin-only data
  socket.send({
    type: 'admin-stats',
    data: getAdminStatistics(),
  });
});

// 📝 Permission-based message filtering
app.ws('/secure-chat', async (socket, req) => {
  socket.on('message', async (data) => {
    const message = JSON.parse(data);
    const user = socket.metadata.user;

    switch (message.type) {
      case 'admin-broadcast':
        if (!user.permissions.includes('broadcast')) {
          socket.send({
            type: 'error',
            message: '🚫 Insufficient permissions for broadcasting',
          });
          return;
        }

        // 📢 Admin broadcast
        app.wsBroadcast({
          type: 'admin-announcement',
          message: message.text,
          from: user.username,
          timestamp: new Date(),
        });
        break;

      case 'moderate':
        if (!user.permissions.includes('moderate')) {
          socket.send({
            type: 'error',
            message: '🚫 Moderation permissions required',
          });
          return;
        }

        // 🔨 Moderate user/message
        await moderateContent(message.targetId, message.action);
        break;
    }
  });
});
```

### **📊 Advanced Analytics & Monitoring**

Comprehensive monitoring and analytics system:

```typescript
interface AnalyticsEvent {
  type: string;
  userId?: string;
  sessionId: string;
  timestamp: Date;
  data: Record<string, any>;
  metadata: {
    ip: string;
    userAgent: string;
    room?: string;
  };
}

class WebSocketAnalytics {
  private events: AnalyticsEvent[] = [];
  private sessionMetrics = new Map<string, any>();

  // 📊 Track events
  trackEvent(socket: any, eventType: string, data: any = {}) {
    const event: AnalyticsEvent = {
      type: eventType,
      userId: socket.metadata.user?.id,
      sessionId: socket.id,
      timestamp: new Date(),
      data: data,
      metadata: {
        ip: socket.ip,
        userAgent: socket.userAgent,
        room: data.room,
      },
    };

    this.events.push(event);
    this.updateSessionMetrics(socket, eventType);

    // 📤 Real-time analytics dashboard update
    app.wsBroadcast(
      {
        type: 'analytics-event',
        event: event,
      },
      'analytics-dashboard'
    );
  }

  private updateSessionMetrics(socket: any, eventType: string) {
    const sessionId = socket.id;

    if (!this.sessionMetrics.has(sessionId)) {
      this.sessionMetrics.set(sessionId, {
        startTime: new Date(),
        eventCount: 0,
        eventTypes: new Set(),
        messageCount: 0,
        roomsVisited: new Set(),
      });
    }

    const metrics = this.sessionMetrics.get(sessionId);
    metrics.eventCount++;
    metrics.eventTypes.add(eventType);

    if (eventType === 'message') {
      metrics.messageCount++;
    }
  }

  // 📈 Generate analytics report
  generateReport(timeRange: string = '24h') {
    const cutoff = new Date(Date.now() - this.parseTimeRange(timeRange));
    const recentEvents = this.events.filter((e) => e.timestamp > cutoff);

    return {
      summary: {
        totalEvents: recentEvents.length,
        uniqueUsers: new Set(recentEvents.map((e) => e.userId).filter(Boolean))
          .size,
        uniqueSessions: new Set(recentEvents.map((e) => e.sessionId)).size,
        timeRange: timeRange,
      },
      eventBreakdown: this.getEventBreakdown(recentEvents),
      userActivity: this.getUserActivity(recentEvents),
      roomActivity: this.getRoomActivity(recentEvents),
      peakHours: this.getPeakHours(recentEvents),
    };
  }

  private parseTimeRange(range: string): number {
    const value = parseInt(range);
    const unit = range.slice(-1);

    switch (unit) {
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      case 'm':
        return value * 60 * 1000;
      default:
        return 24 * 60 * 60 * 1000; // Default to 24h
    }
  }

  private getEventBreakdown(events: AnalyticsEvent[]) {
    const breakdown = new Map<string, number>();

    events.forEach((event) => {
      breakdown.set(event.type, (breakdown.get(event.type) || 0) + 1);
    });

    return Object.fromEntries(breakdown);
  }

  private getUserActivity(events: AnalyticsEvent[]) {
    const userActivity = new Map<string, any>();

    events.forEach((event) => {
      if (event.userId) {
        if (!userActivity.has(event.userId)) {
          userActivity.set(event.userId, {
            eventCount: 0,
            firstSeen: event.timestamp,
            lastSeen: event.timestamp,
            eventTypes: new Set(),
          });
        }

        const activity = userActivity.get(event.userId);
        activity.eventCount++;
        activity.lastSeen = event.timestamp;
        activity.eventTypes.add(event.type);
      }
    });

    // Convert to array and sort by activity
    return Array.from(userActivity.entries())
      .map(([userId, activity]) => ({
        userId,
        ...activity,
        eventTypes: Array.from(activity.eventTypes),
        sessionDuration:
          activity.lastSeen.getTime() - activity.firstSeen.getTime(),
      }))
      .sort((a, b) => b.eventCount - a.eventCount);
  }
}

const analytics = new WebSocketAnalytics();

// 📊 Analytics integration
app.ws('/chat-with-analytics', async (socket, req) => {
  analytics.trackEvent(socket, 'connection_established');

  socket.on('message', async (data) => {
    const message = JSON.parse(data);

    // 📊 Track message events
    analytics.trackEvent(socket, 'message', {
      messageType: message.type,
      room: message.room,
      textLength: message.text?.length || 0,
    });

    // Process message normally...
    // ... existing message handling code ...
  });

  socket.socket.on('close', () => {
    analytics.trackEvent(socket, 'connection_closed');
  });
});

// 📈 Analytics API endpoints
app.get('/api/analytics/report', (req, res) => {
  const timeRange = (req.query.range as string) || '24h';
  const report = analytics.generateReport(timeRange);
  res.json(report);
});

app.ws('/analytics-dashboard', (socket, req) => {
  // 📊 Real-time analytics dashboard
  socket.join('analytics-dashboard');

  socket.send({
    type: 'analytics-init',
    report: analytics.generateReport(),
    message: '📊 Analytics dashboard connected',
  });
});
```

### **🚀 Load Balancing & Clustering**

Scale WebSocket across multiple processes:

```typescript
import cluster from 'cluster';
import { Redis } from 'ioredis';

// 🔄 Redis adapter for multi-process scaling
class RedisWebSocketAdapter {
  private redis: Redis;
  private subscriber: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
    this.subscriber = new Redis(redisUrl);

    this.subscriber.on('message', (channel, message) => {
      this.handleRedisMessage(channel, message);
    });
  }

  // 📢 Broadcast across all processes
  async broadcastToCluster(data: any, room?: string) {
    const message = {
      type: 'broadcast',
      data: data,
      room: room,
      from: process.pid,
      timestamp: Date.now(),
    };

    await this.redis.publish('websocket:broadcast', JSON.stringify(message));
  }

  // 🏠 Sync room membership across processes
  async syncRoomJoin(socketId: string, room: string) {
    await this.redis.sadd(`room:${room}`, socketId);
    await this.redis.publish(
      'websocket:room_join',
      JSON.stringify({
        socketId,
        room,
        process: process.pid,
      })
    );
  }

  async syncRoomLeave(socketId: string, room: string) {
    await this.redis.srem(`room:${room}`, socketId);
    await this.redis.publish(
      'websocket:room_leave',
      JSON.stringify({
        socketId,
        room,
        process: process.pid,
      })
    );
  }

  private handleRedisMessage(channel: string, message: string) {
    const data = JSON.parse(message);

    switch (channel) {
      case 'websocket:broadcast':
        if (data.from !== process.pid) {
          // 📢 Broadcast to local connections only
          this.localBroadcast(data.data, data.room);
        }
        break;

      case 'websocket:room_join':
        // 📊 Update local room tracking
        break;

      case 'websocket:room_leave':
        // 📊 Update local room tracking
        break;
    }
  }

  private localBroadcast(data: any, room?: string) {
    if (room) {
      app.wsBroadcast(data, room);
    } else {
      app.wsBroadcast(data);
    }
  }
}

// 🏭 Cluster setup
if (cluster.isPrimary) {
  console.log(`🏭 Master process ${process.pid} is running`);

  // 🚀 Fork workers
  const numCPUs = require('os').cpus().length;
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`💀 Worker ${worker.process.pid} died`);
    cluster.fork(); // Restart worker
  });
} else {
  // 👷 Worker process
  const redisAdapter = new RedisWebSocketAdapter(process.env.REDIS_URL!);

  app.enableWebSocket({
    maxConnections: 1000, // Per process
    adapter: redisAdapter,
  });

  // 🔄 Override broadcast to use Redis
  const originalBroadcast = app.wsBroadcast;
  app.wsBroadcast = async (data: any, room?: string) => {
    // 📢 Broadcast to local connections
    originalBroadcast.call(app, data, room);

    // 📢 Broadcast to other processes via Redis
    await redisAdapter.broadcastToCluster(data, room);
  };

  app.listen(3000, () => {
    console.log(`🚀 Worker ${process.pid} listening on port 3000`);
  });
}
```

---

## **🎯 Conclusion**

NextRush WebSocket provides a **comprehensive, production-ready solution** that combines:

- 🔥 **Zero Dependencies** - Pure Node.js implementation
- ⚡ **High Performance** - Handles thousands of concurrent connections
- 🛡️ **Type Safety** - Full TypeScript support with intelligent IntelliSense
- 🏠 **Advanced Features** - Room management, broadcasting, middleware
- 🔒 **Enterprise Security** - Authentication, authorization, rate limiting
- 📊 **Rich Analytics** - Real-time monitoring and insights
- 🚀 **Scalability** - Clustering and load balancing support

### **✨ Key Benefits:**

| Feature                  | NextRush WebSocket       | Traditional Solutions       |
| ------------------------ | ------------------------ | --------------------------- |
| **Dependencies**         | ✅ Zero                  | ❌ Many external packages   |
| **Type Safety**          | ✅ Full TypeScript       | ⚠️ Limited or manual typing |
| **Room Management**      | ✅ Built-in advanced     | ⚠️ Basic or external        |
| **Performance**          | ✅ Optimized for Node.js | ⚠️ Variable                 |
| **Security**             | ✅ Enterprise-grade      | ⚠️ Manual implementation    |
| **Developer Experience** | ✅ Express-like API      | ⚠️ Learning curve           |

### **🎮 Ready to Build Amazing Real-time Apps!**

Whether you're building:

- 💬 **Chat Applications** - Real-time messaging with rooms and presence
- 🎮 **Multiplayer Games** - Low-latency gaming with synchronized state
- 📊 **Live Dashboards** - Real-time analytics and monitoring
- 🔔 **Notification Systems** - Instant alerts and updates
- 🎭 **Collaborative Tools** - Real-time editing and collaboration

NextRush WebSocket has you covered with a **powerful, type-safe, zero-dependency solution**! 🚀

---

## **📚 Additional Resources**

### **🔗 Documentation Links**

- 📖 [NextRush Main Documentation](./README.md)
- 🛠️ [Complete API Reference](./API-REFERENCE.md)
- 💡 [Interactive Examples](../examples/)
- 📘 [User Manual](./USER-MANUAL.md)
- 🎯 [Middleware Guide](./MIDDLEWARE.md)

### **🌐 External Resources**

- 🔍 [WebSocket RFC 6455 Specification](https://tools.ietf.org/html/rfc6455)
- 📊 [WebSocket Performance Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
- 🔒 [WebSocket Security Guidelines](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html#websockets)

### **🛠️ Development Tools**

- 🧪 **Testing**: Use `wscat` or browser dev tools for WebSocket testing
- 📊 **Monitoring**: Built-in stats API at `/api/websocket/stats`
- 🐛 **Debugging**: Enable debug mode with `debug: true` in options
- 📈 **Performance**: Use Node.js profiler and `--inspect` flag

### **🎯 Quick Start Commands**

```bash
# 📦 Install NextRush
npm install nextrush

# 🚀 Run the demo
npm run demo:websocket

# 🧪 Test WebSocket connection
npx wscat -c ws://localhost:3001/echo

# 📊 Check stats
curl http://localhost:3001/api/websocket/stats
```

### **💪 Community & Support**

- 🐙 **GitHub**: [NextRush Repository](https://github.com/0xTanzim/nextRush)
- 📧 **Issues**: Report bugs and feature requests
- 💬 **Discussions**: Share ideas and get help
- 📝 **Contributing**: See CONTRIBUTING.md for guidelines

---

_Built with ❤️ by the NextRush team - Making real-time web development simple, powerful, and fun!_ 🚀✨
