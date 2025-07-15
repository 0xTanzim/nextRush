# 🚀 NextRush WebSocket Documentation

## **Zero-Dependency WebSocket Implementation**

NextRush provides a **production-ready, zero-dependency WebSocket implementation** built with raw Node.js that's **easier to use, fully type-safe, and more powerful** than existing solutions.

---

## **📚 Table of Contents**

1. [Quick Start](#quick-start)
2. [Core Features](#core-features)
3. [API Reference](#api-reference)
4. [WebSocket Handlers](#websocket-handlers)
5. [Room Management](#room-management)
6. [Middleware System](#middleware-system)
7. [Event Handling](#event-handling)
8. [Security Features](#security-features)
9. [Performance & Monitoring](#performance--monitoring)
10. [Best Practices](#best-practices)
11. [Examples](#examples)
12. [Troubleshooting](#troubleshooting)

---

## **🚀 Quick Start**

### **Enable WebSocket Support**

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// 🔌 Enable WebSocket support (zero dependencies!)
app.enableWebSocket({
  maxConnections: 100,
  pingInterval: 30000,
  maxMessageSize: 1024 * 1024, // 1MB
  debug: true
});

// 🎯 Simple WebSocket route
app.ws('/chat', (socket, req) => {
  console.log(\`New connection: \${socket.id}\`);

  socket.send('Welcome to NextRush WebSocket!');

  socket.on('message', (data) => {
    console.log('Received:', data);
    socket.send(\`Echo: \${data}\`);
  });
});

app.listen(3000, () => {
  console.log('🚀 WebSocket server ready!');
});
```

### **Client-Side Connection**

```javascript
// 🌐 Connect from browser
const ws = new WebSocket('ws://localhost:3000/chat');

ws.onopen = () => {
  console.log('Connected!');
  ws.send('Hello from client!');
};

ws.onmessage = (event) => {
  console.log('Received:', event.data);
};
```

---

## **⭐ Core Features**

### **🔥 Zero Dependencies**

- Built with raw Node.js HTTP upgrade events
- No external packages required
- RFC 6455 compliant WebSocket implementation

### **🛡️ Type Safety**

- Full TypeScript support with intelligent IntelliSense
- Strongly typed event handlers and message types
- Auto-completion for all WebSocket methods

### **🏠 Advanced Room Management**

- Real-time room join/leave functionality
- Broadcasting to specific rooms
- Room metadata and statistics

### **⚡ High Performance**

- Optimized frame parsing and sending
- Built-in connection pooling
- Automatic ping/pong heartbeat

### **🔒 Security**

- Origin validation
- Rate limiting support
- Secure frame handling
- Path traversal protection

---

## **📖 API Reference**

### **Application Methods**

#### **`app.enableWebSocket(options?: WebSocketOptions)`**

Enable WebSocket support on the application.

```typescript
app.enableWebSocket({
  maxConnections: 100, // Maximum concurrent connections
  pingInterval: 30000, // Ping interval in milliseconds
  maxMessageSize: 1048576, // Maximum message size in bytes
  protocols: [], // Supported WebSocket protocols
  origins: ['*'], // Allowed origins
  debug: false, // Enable debug logging
  maxRooms: 1000, // Maximum number of rooms
  roomCleanupInterval: 60000, // Room cleanup interval
});
```

#### **`app.ws(path: string, handler: WebSocketHandler)`**

Register a WebSocket route handler.

```typescript
app.ws('/chat', (socket, req) => {
  // Handle WebSocket connection
});

app.ws('/api/*', (socket, req) => {
  // Wildcard path matching
});
```

#### **`app.wsUse(middleware: WebSocketMiddleware)`**

Add WebSocket middleware.

```typescript
app.wsUse((socket, req, next) => {
  console.log(\`Connection from: \${socket.ip}\`);
  socket.metadata.connectedAt = new Date();
  next();
});
```

### **WebSocket Connection Methods**

#### **Core Methods**

```typescript
// Send message
socket.send(data: string | Buffer | object): void
socket.send('Hello World!');
socket.send({ type: 'message', content: 'Hello' });
socket.send(Buffer.from('binary data'));

// Close connection
socket.close(code?: number, reason?: string): void
socket.close(1000, 'Normal closure');

// Ping/Pong
socket.ping(data?: Buffer): void
socket.pong(data?: Buffer): void
```

#### **Enhanced Methods**

```typescript
// Room management
socket.join(room: string): Promise<void>
socket.leave(room: string): Promise<void>
await socket.join('general');

// Broadcasting
socket.broadcast(data: any, room?: string): void
socket.broadcast('Hello everyone!');
socket.broadcast('Room message', 'general');

// Room targeting
socket.to('room-name').send('Message to room');
socket.to('admin').emit('notification', { alert: 'New user' });

// Event emitting
socket.emit(event: string, ...args: any[]): void
socket.emit('notification', { type: 'info', message: 'Hello' });
```

#### **Event Handling**

```typescript
// Listen for events
socket.on(event: string, handler: Function): void
socket.on('message', (data) => {
  console.log('Received:', data);
});

socket.on('join-room', (roomName) => {
  socket.join(roomName);
  socket.to(roomName).send(\`User \${socket.id} joined\`);
});

// One-time events
socket.once('auth', (token) => {
  // Handle authentication once
});

// Remove event listeners
socket.off('message', handler);
socket.off('message'); // Remove all handlers
```

---

## **🎯 WebSocket Handlers**

### **Handler Signature**

```typescript
type WebSocketHandler = (
  socket: NextRushWebSocket,
  req: NextRushRequest
) => void | Promise<void>;
```

### **Connection Information**

```typescript
app.ws('/info', (socket, req) => {
  console.log({
    id: socket.id,
    ip: socket.ip,
    userAgent: socket.userAgent,
    origin: socket.origin,
    rooms: Array.from(socket.rooms),
    connectedAt: socket.connectedAt,
    isAlive: socket.isAlive,
  });
});
```

### **Message Handling Patterns**

```typescript
app.ws('/api', (socket, req) => {
  socket.on('message', async (rawData) => {
    try {
      const message = JSON.parse(rawData);

      switch (message.type) {
        case 'join':
          await socket.join(message.room);
          socket.send({ type: 'joined', room: message.room });
          break;

        case 'chat':
          socket.to(message.room).send({
            type: 'message',
            user: socket.id,
            text: message.text,
            timestamp: Date.now(),
          });
          break;

        case 'ping':
          socket.send({ type: 'pong', timestamp: Date.now() });
          break;

        default:
          socket.send({ type: 'error', message: 'Unknown message type' });
      }
    } catch (error) {
      socket.send({ type: 'error', message: 'Invalid JSON' });
    }
  });
});
```

---

## **🏠 Room Management**

### **Joining and Leaving Rooms**

```typescript
app.ws('/chat', async (socket, req) => {
  // Join default room
  await socket.join('general');

  // Join multiple rooms
  await Promise.all([socket.join('users'), socket.join('notifications')]);

  socket.on('message', async (data) => {
    const msg = JSON.parse(data);

    if (msg.action === 'join-room') {
      await socket.join(msg.room);
      socket.to(msg.room).send({
        type: 'user-joined',
        user: socket.id,
        room: msg.room,
      });
    }

    if (msg.action === 'leave-room') {
      await socket.leave(msg.room);
      socket.to(msg.room).send({
        type: 'user-left',
        user: socket.id,
        room: msg.room,
      });
    }
  });
});
```

### **Broadcasting to Rooms**

```typescript
// Broadcast to all connections
app.wsBroadcast({
  type: 'announcement',
  message: 'Server maintenance in 5 minutes',
});

// Broadcast to specific room
app.wsBroadcast({ type: 'event', data: eventData }, 'premium-users');

// From socket connection
socket.broadcast('Hello everyone!');
socket.broadcast('Room announcement', 'general');

// Exclude sender
socket.to('general').send('Message to room excluding sender');
```

### **Room Information**

```typescript
// Get room statistics
app.get('/api/websocket/rooms', (req, res) => {
  const stats = app.getWebSocketStats();
  const rooms = stats?.rooms || [];

  res.json({
    totalRooms: rooms.length,
    rooms: rooms.map((room) => ({
      name: room.name,
      clients: room.clients.size,
      created: room.created,
      lastActivity: room.lastActivity,
    })),
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

### **1. Message Structure**

```typescript
// ✅ Good: Structured messages
interface ChatMessage {
  type: 'chat' | 'join' | 'leave' | 'error';
  data: any;
  timestamp: number;
  userId?: string;
}

socket.send({
  type: 'chat',
  data: { text: 'Hello!', room: 'general' },
  timestamp: Date.now(),
  userId: socket.metadata.user?.id,
});

// ❌ Bad: Unstructured messages
socket.send('Hello!');
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

## **💡 Examples**

### **Real-time Chat Application**

```typescript
interface ChatUser {
  id: string;
  username: string;
  room: string;
}

const chatUsers = new Map<string, ChatUser>();

app.ws('/chat', async (socket, req) => {
  let user: ChatUser | null = null;

  socket.on('message', async (data) => {
    const message = JSON.parse(data);

    switch (message.type) {
      case 'join':
        user = {
          id: socket.id,
          username: message.username,
          room: message.room,
        };

        chatUsers.set(socket.id, user);
        await socket.join(user.room);

        // Notify room
        socket.to(user.room).send({
          type: 'user-joined',
          username: user.username,
          room: user.room,
          timestamp: Date.now(),
        });

        // Send room users
        const roomUsers = Array.from(chatUsers.values()).filter(
          (u) => u.room === user.room
        );

        socket.send({
          type: 'room-users',
          users: roomUsers.map((u) => u.username),
        });
        break;

      case 'message':
        if (user) {
          socket.to(user.room).send({
            type: 'message',
            username: user.username,
            text: message.text,
            room: user.room,
            timestamp: Date.now(),
          });
        }
        break;

      case 'typing':
        if (user) {
          socket.to(user.room).send({
            type: 'typing',
            username: user.username,
            isTyping: message.isTyping,
          });
        }
        break;
    }
  });

  socket.socket.on('close', () => {
    if (user) {
      chatUsers.delete(socket.id);
      socket.to(user.room).send({
        type: 'user-left',
        username: user.username,
        room: user.room,
        timestamp: Date.now(),
      });
    }
  });
});
```

### **Real-time Gaming**

```typescript
interface GamePlayer {
  id: string;
  x: number;
  y: number;
  score: number;
  room: string;
}

const gamePlayers = new Map<string, GamePlayer>();

app.ws('/game', async (socket, req) => {
  let player: GamePlayer | null = null;

  socket.on('message', async (data) => {
    const message = JSON.parse(data);

    switch (message.type) {
      case 'join-game':
        player = {
          id: socket.id,
          x: Math.random() * 800,
          y: Math.random() * 600,
          score: 0,
          room: message.gameRoom,
        };

        gamePlayers.set(socket.id, player);
        await socket.join(player.room);

        // Send game state
        const roomPlayers = Array.from(gamePlayers.values()).filter(
          (p) => p.room === player.room
        );

        socket.send({
          type: 'game-state',
          players: roomPlayers,
          yourId: socket.id,
        });

        // Notify other players
        socket.to(player.room).send({
          type: 'player-joined',
          player: player,
        });
        break;

      case 'move':
        if (player) {
          player.x = message.x;
          player.y = message.y;

          socket.to(player.room).send({
            type: 'player-moved',
            playerId: socket.id,
            x: player.x,
            y: player.y,
          });
        }
        break;

      case 'action':
        if (player) {
          // Process game action
          const result = processGameAction(player, message.action);

          socket.to(player.room).send({
            type: 'game-action',
            playerId: socket.id,
            action: message.action,
            result: result,
          });
        }
        break;
    }
  });

  // Game loop for this room
  const gameInterval = setInterval(() => {
    if (player) {
      const roomPlayers = Array.from(gamePlayers.values()).filter(
        (p) => p.room === player.room
      );

      if (roomPlayers.length > 0) {
        socket.to(player.room).send({
          type: 'game-update',
          players: roomPlayers,
          timestamp: Date.now(),
        });
      }
    }
  }, 1000 / 60); // 60 FPS

  socket.socket.on('close', () => {
    clearInterval(gameInterval);

    if (player) {
      gamePlayers.delete(socket.id);
      socket.to(player.room).send({
        type: 'player-left',
        playerId: socket.id,
      });
    }
  });
});
```

### **Live Dashboard**

```typescript
app.ws('/dashboard', (socket, req) => {
  // Send initial dashboard data
  socket.send({
    type: 'dashboard-data',
    data: getCurrentDashboardData()
  });

  // Join dashboard updates room
  socket.join('dashboard-updates');

  socket.on('message', (data) => {
    const message = JSON.parse(data);

    switch (message.type) {
      case 'subscribe':
        message.metrics.forEach(metric => {
          socket.join(\`metric-\${metric}\`);
        });
        break;

      case 'unsubscribe':
        message.metrics.forEach(metric => {
          socket.leave(\`metric-\${metric}\`);
        });
        break;
    }
  });
});

// Background process to send updates
setInterval(() => {
  const metrics = collectMetrics();

  Object.entries(metrics).forEach(([metricName, data]) => {
    app.wsBroadcast({
      type: 'metric-update',
      metric: metricName,
      data: data,
      timestamp: Date.now()
    }, \`metric-\${metricName}\`);
  });
}, 5000);
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

## **🎯 Conclusion**

NextRush WebSocket provides a **production-ready, zero-dependency solution** that's:

- ✅ **Easy to use** - Simple, intuitive API
- ✅ **Type-safe** - Full TypeScript support
- ✅ **Performant** - Optimized for high throughput
- ✅ **Secure** - Built-in security features
- ✅ **Scalable** - Room management and broadcasting
- ✅ **Zero dependencies** - Pure Node.js implementation

**Ready to build real-time applications with NextRush WebSocket!** 🚀

---

## **📚 Additional Resources**

- [NextRush Main Documentation](./README.md)
- [API Reference](./API-REFERENCE.md)
- [Examples Repository](../examples/)
- [WebSocket RFC 6455](https://tools.ietf.org/html/rfc6455)

---

_Built with ❤️ by the NextRush team_
