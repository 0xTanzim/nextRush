# 🚀 NextRush WebSocket Documentation

**🔥 Zero-dependency WebSocket implementation built with raw Node.js**

> 💡 **Why NextRush WebSocket?** No external dependencies, full TypeScript support, built-in room management, enterprise-grade security, and blazing fast performance!

---

## 📚 Quick Navigation

- [🚀 Quick Start](#-quick-start)
- [⭐ Core Features](#-core-features)
- [📖 API Reference](#-api-reference)
- [🏠 Room Management](#-room-management)
- [🔐 Security & Auth](#-security--auth)
- [💡 Real-World Examples](#-real-world-examples)
- [🎯 Best Practices](#-best-practices)
- [🛠️ Troubleshooting](#-troubleshooting)
- [🎁 Advanced Features](#-advanced-features)

---

## 🚀 Quick Start

### ⚡ Basic Setup

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// 🔌 Enable WebSocket support (zero dependencies!)
app.enableWebSocket({
  maxConnections: 100, // 👥 Max concurrent connections
  pingInterval: 30000, // 💓 Heartbeat every 30s
  maxMessageSize: 1024 * 1024, // 📦 1MB message limit
  debug: true, // 🐛 Enable debug logging
});

// 🎯 WebSocket route
app.ws('/chat', (socket, req) => {
  console.log(`✨ New connection: ${socket.id} from ${socket.ip}`);

  // 👋 Send welcome message
  socket.send({
    type: 'welcome',
    message: '🎉 Connected to NextRush WebSocket!',
    socketId: socket.id,
    timestamp: Date.now(),
  });

  // 📨 Handle incoming messages
  socket.on('message', (data) => {
    console.log(`📩 Message from ${socket.id}:`, data);
    socket.send({
      type: 'echo',
      originalMessage: data,
      timestamp: Date.now(),
    });
  });

  // 🚪 Handle disconnection
  socket.on('close', (code, reason) => {
    console.log(`👋 ${socket.id} disconnected: ${code} - ${reason}`);
  });
});

// 🚀 Start server
app.listen(3000, () => {
  console.log('🌐 WebSocket server ready at ws://localhost:3000');
});
```

### 🌐 Client-Side Connection

```javascript
// 🔗 Connect from browser
const ws = new WebSocket('ws://localhost:3000/chat');

ws.onopen = () => {
  console.log('✅ Connected!');
  ws.send(JSON.stringify({ type: 'greeting', message: '👋 Hello!' }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('📨 Received:', data);
};

ws.onclose = (event) => {
  console.log(`🔌 Connection closed: ${event.code} - ${event.reason}`);
};
```

---

## ⭐ Core Features

### 🔥 Zero Dependencies Revolution

- 🎯 **Pure Node.js** - Built with http, crypto, net modules only
- 📦 **No External Packages** - Zero npm dependencies
- ✅ **RFC 6455 Compliant** - Professional WebSocket protocol
- 🚀 **Production Ready** - Battle-tested implementation

### 🛡️ Type Safety & Developer Experience

- 💎 **Full TypeScript Support** - Intelligent IntelliSense
- 🔒 **Strongly Typed APIs** - Zero `any` types
- ⚡ **Express-Like Familiarity** - Familiar syntax
- 🎯 **Method Overloads** - Automatic type inference

### 🏠 Advanced Room Management

- 🚪 **Real-Time Rooms** - Join/leave with instant notifications
- 📢 **Smart Broadcasting** - Target specific rooms or broadcast globally
- 📊 **Room Analytics** - Live statistics and member tracking
- 🧹 **Auto Cleanup** - Automatic room cleanup when empty

### ⚡ High Performance & Security

- 🔧 **Optimized Frame Parsing** - Efficient binary processing
- 💓 **Automatic Heartbeat** - Built-in ping/pong
- 🌐 **Origin Validation** - CORS support
- ⏰ **Rate Limiting** - Built-in spam protection

---

## 📖 API Reference

### 🎛️ Application Methods

```typescript
// 🔌 Enable WebSocket Support
app.enableWebSocket(options?: WebSocketOptions): void

// 🎯 Add WebSocket Route
app.ws(path: string, handler: WebSocketHandler): void

// 🔧 Add WebSocket Middleware
app.wsUse(middleware: WebSocketMiddleware): void

// 📢 Broadcast Messages
app.wsBroadcast(data: any, room?: string): void

// 📊 Get Statistics
app.getWebSocketStats(): WebSocketStats

// 🏥 Health Check
app.getWebSocketHealth(): HealthInfo
```

### 🔌 Socket Methods

```typescript
// 📤 Send Messages
socket.send(data: string | Buffer | object): void
socket.sendJSON(object: any): void
socket.sendBinary(buffer: Buffer): void

// 📢 Broadcasting
socket.broadcast(data: any, room?: string): void
socket.to(room: string).send(data: any): void
socket.except(socketIds: string[]).broadcast(data: any): void

// 🏠 Room Management
await socket.join(room: string): Promise<void>
await socket.leave(room: string): Promise<void>
await socket.leaveAll(): Promise<void>
socket.getRoomMembers(room: string): string[]
socket.getRoomCount(room: string): number

// 🎯 Event System
socket.on(event: string, handler: Function): void
socket.once(event: string, handler: Function): void
socket.off(event: string, handler?: Function): void
socket.emit(event: string, ...args: any[]): void

// 🔧 Connection Control
socket.close(code?: number, reason?: string): void
socket.terminate(): void
socket.ping(data?: Buffer): void
socket.pong(data?: Buffer): void

// 🔍 Properties
socket.id: string              // Unique socket identifier
socket.ip: string              // Client IP address
socket.isAlive: boolean        // Connection status
socket.rooms: Set<string>      // Current rooms
socket.metadata: Map<string, any> // Custom data storage
```

### ⚙️ Configuration Options

```typescript
interface WebSocketOptions {
  // 👥 Connection Management
  maxConnections?: number; // Default: 1000
  pingInterval?: number; // Default: 30000ms
  maxMessageSize?: number; // Default: 1MB

  // 🏠 Room Management
  maxRooms?: number; // Default: 1000
  roomCleanupInterval?: number; // Default: 300000ms

  // 🔒 Security Settings
  protocols?: string[]; // Supported protocols
  allowOrigins?: string[]; // Allowed origins (CORS)

  // 🐛 Development
  debug?: boolean; // Default: false
  logLevel?: 'debug' | 'info' | 'warn' | 'error';

  // 🔐 Advanced Security
  verifyClient?: (req: NextRushRequest) => boolean | Promise<boolean>;
  rateLimit?: {
    maxMessages: number; // Messages per window
    windowMs: number; // Time window in ms
  };
}
```

---

## 🏠 Room Management

### 🚪 Basic Room Operations

```typescript
app.ws('/chat', async (socket, req) => {
  // 🎯 Join rooms on connection
  await socket.join('general');
  await socket.join('announcements');

  // 📢 Notify room about new member
  socket.to('general').send({
    type: 'user-joined',
    user: { id: socket.id, ip: socket.ip },
    room: 'general',
    memberCount: socket.getRoomCount('general'),
    timestamp: Date.now(),
  });

  socket.on('message', async (data) => {
    const message = JSON.parse(data);

    switch (message.type) {
      case 'join-room':
        await handleRoomJoin(socket, message);
        break;

      case 'leave-room':
        await handleRoomLeave(socket, message);
        break;

      case 'room-message':
        socket.to(message.room).send({
          type: 'message',
          user: socket.id,
          text: message.text,
          room: message.room,
          timestamp: Date.now(),
        });
        break;
    }
  });
});

// 🎯 Room operation handlers
async function handleRoomJoin(socket: WebSocket, message: any) {
  const { room, userInfo } = message;

  // ✅ Validate room name
  if (!isValidRoomName(room)) {
    socket.send({ type: 'error', message: 'Invalid room name' });
    return;
  }

  await socket.join(room);
  socket.set('userInfo', userInfo);

  // 📢 Notify room members
  socket.to(room).send({
    type: 'user-joined',
    user: userInfo,
    room: room,
    memberCount: socket.getRoomCount(room),
    timestamp: Date.now(),
  });

  // ✅ Confirm to joining user
  socket.send({
    type: 'room-joined',
    room: room,
    memberCount: socket.getRoomCount(room),
    members: socket.getRoomMembers(room),
  });
}

// 📢 Broadcasting examples
app.wsBroadcast(
  { type: 'announcement', text: 'Server maintenance in 5min' },
  'general'
);
app.wsBroadcast({ type: 'global-message', text: 'Welcome everyone!' }); // Global
```

---

## 🔐 Security & Auth

### 🛡️ Authentication Middleware

```typescript
// 🔐 JWT Authentication
app.wsUse(async (socket, req, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      socket.close(1008, 'Authentication required');
      return;
    }

    const decoded = await verifyJWT(token);
    socket.set('user', decoded);
    socket.set('authenticated', true);

    console.log(`✅ User authenticated: ${decoded.userId}`);
    next();
  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
    socket.close(1008, `Authentication failed: ${error.message}`);
  }
});

// 🎫 Token extraction helper
function extractToken(req: NextRushRequest): string | null {
  // From Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // From query parameter
  const url = new URL(req.url!, `http://${req.headers.host}`);
  return url.searchParams.get('token');
}
```

### 🛡️ Rate Limiting & Protection

```typescript
// ⏰ Advanced rate limiting
class WebSocketRateLimiter {
  private limits = new Map<string, { count: number; resetTime: number }>();

  constructor(
    private maxMessages: number = 100,
    private windowMs: number = 60000
  ) {}

  isAllowed(socketId: string, ip: string): boolean {
    const key = `${socketId}:${ip}`;
    const now = Date.now();
    const limit = this.limits.get(key);

    if (!limit || now > limit.resetTime) {
      this.limits.set(key, { count: 1, resetTime: now + this.windowMs });
      return true;
    }

    if (limit.count >= this.maxMessages) {
      return false;
    }

    limit.count++;
    return true;
  }
}

// 🛡️ Apply rate limiting
const rateLimiter = new WebSocketRateLimiter(50, 60000);

app.wsUse((socket, req, next) => {
  if (!rateLimiter.isAllowed(socket.id, socket.ip)) {
    socket.close(1008, 'Rate limit exceeded');
    return;
  }
  next();
});
```

---

## 💡 Real-World Examples

### 🎮 Real-Time Gaming Lobby

```typescript
interface GamePlayer {
  id: string;
  username: string;
  level: number;
  stats: { wins: number; losses: number; score: number };
}

// 🎯 Gaming WebSocket endpoint
app.ws('/game-lobby', async (socket, req) => {
  let currentPlayer: GamePlayer | null = null;

  socket.on('message', async (data) => {
    const message = JSON.parse(data);

    switch (message.type) {
      case 'player-login':
        currentPlayer = {
          id: socket.id,
          username: message.username,
          level: message.level || 1,
          stats: message.stats || { wins: 0, losses: 0, score: 0 },
        };

        socket.set('player', currentPlayer);
        socket.send({
          type: 'login-success',
          player: currentPlayer,
          onlineCount: app.getWebSocketStats().activeConnections,
        });
        break;

      case 'find-match':
        const room = await findOrCreateGameRoom(
          message.gameType,
          currentPlayer!.level
        );
        await socket.join(room.id);

        socket.to(room.id).send({
          type: 'player-joined',
          player: currentPlayer,
          room: room,
        });
        break;

      case 'game-move':
        socket.to(currentPlayer!.room).send({
          type: 'player-move',
          player: currentPlayer!.id,
          move: message.move,
          timestamp: Date.now(),
        });
        break;
    }
  });
});
```

### 💬 Advanced Chat System

```typescript
interface ChatMessage {
  id: string;
  type: 'text' | 'image' | 'system';
  content: string;
  author: { id: string; username: string };
  room: string;
  timestamp: Date;
  reactions: { emoji: string; count: number }[];
}

app.ws('/chat-advanced', async (socket, req) => {
  let user: { id: string; username: string } | null = null;

  socket.on('message', async (data) => {
    const message = JSON.parse(data);

    switch (message.type) {
      case 'user-login':
        user = { id: socket.id, username: message.username };
        socket.set('user', user);
        break;

      case 'send-message':
        if (!user) return;

        const chatMessage: ChatMessage = {
          id: generateMessageId(),
          type: 'text',
          content: sanitizeContent(message.content),
          author: user,
          room: message.room,
          timestamp: new Date(),
          reactions: [],
        };

        await saveMessage(chatMessage);

        socket.to(message.room).send({
          type: 'new-message',
          message: chatMessage,
        });
        break;

      case 'typing-start':
        socket.to(message.room).send({
          type: 'user-typing',
          user: { id: user!.id, username: user!.username },
          room: message.room,
        });
        break;
    }
  });
});
```

### 📊 Real-Time Analytics Dashboard

```typescript
app.ws('/analytics-dashboard', async (socket, req) => {
  let subscription: {
    metrics: string[];
    updateInterval: number;
  } | null = null;

  socket.on('message', async (data) => {
    const message = JSON.parse(data);

    switch (message.type) {
      case 'subscribe':
        subscription = {
          metrics: message.metrics || [],
          updateInterval: message.updateInterval || 5000,
        };

        const initialData = await getAnalyticsData(subscription.metrics);
        socket.send({
          type: 'initial-data',
          data: initialData,
          timestamp: Date.now(),
        });

        const interval = setInterval(async () => {
          const realtimeData = await getRealtimeAnalytics(
            subscription!.metrics
          );
          socket.send({
            type: 'realtime-update',
            data: realtimeData,
            timestamp: Date.now(),
          });
        }, subscription.updateInterval);

        socket.set('updateInterval', interval);
        break;
    }
  });

  socket.on('close', () => {
    const interval = socket.get('updateInterval');
    if (interval) clearInterval(interval);
  });
});
```

---

## 🎯 Best Practices

### 📦 Message Structure Standards

```typescript
// ✅ Good: Structured message format
interface StandardMessage {
  type: string; // Message type for routing
  data?: any; // Actual payload
  timestamp: number; // When message was created
  id?: string; // Unique message ID
}

// 🎯 Example usage
socket.send({
  type: 'user-message',
  data: { text: 'Hello!', room: 'general' },
  timestamp: Date.now(),
  id: generateMessageId(),
});

// ❌ Avoid: Unstructured messages
socket.send('Hello!'); // No context
```

### 🛡️ Error Handling

```typescript
// 🛡️ Comprehensive error handling
function withErrorHandling(handler: Function) {
  return async (socket: WebSocket, message: any) => {
    try {
      await handler(socket, message);
    } catch (error) {
      console.error('Handler error:', error.message);

      socket.send({
        type: 'error',
        message: 'An error occurred',
        code: error.code || 'INTERNAL_ERROR',
      });

      if (!isRecoverableError(error)) {
        socket.close(1011, 'Internal server error');
      }
    }
  };
}

// 🎯 Usage
app.ws('/secure-chat', async (socket, req) => {
  socket.on(
    'message',
    withErrorHandling(async (socket, message) => {
      const parsed = JSON.parse(message);
      await processChatMessage(socket, parsed);
    })
  );
});
```

### ⚡ Performance Optimization

```typescript
// 📦 Message batching for high-frequency updates
class MessageBatcher {
  private batches = new Map<string, any[]>();

  constructor(private flushInterval: number = 100) {}

  addMessage(socketId: string, message: any) {
    if (!this.batches.has(socketId)) {
      this.batches.set(socketId, []);
    }

    this.batches.get(socketId)!.push(message);

    setTimeout(() => this.flushBatch(socketId), this.flushInterval);
  }

  private flushBatch(socketId: string) {
    const batch = this.batches.get(socketId);
    if (!batch?.length) return;

    const socket = getSocketById(socketId);
    if (socket) {
      socket.send({ type: 'batch', messages: batch });
    }

    this.batches.set(socketId, []);
  }
}
```

---

## 🛠️ Troubleshooting

### 🔍 Common Issues

**Connection fails:**

```typescript
// ✅ Check WebSocket enabled
if (!app.getWebSocketStats()) {
  console.error('❌ WebSocket not enabled. Call app.enableWebSocket() first.');
}

// ✅ Check CORS settings
app.enableWebSocket({
  allowOrigins: ['http://localhost:3000', 'https://yourdomain.com'],
  debug: true,
});
```

**Messages not received:**

```typescript
app.ws('/debug', (socket, req) => {
  socket.on('message', (data) => {
    console.log('Message received:', {
      socketId: socket.id,
      dataType: typeof data,
      length: data.length,
      isAlive: socket.isAlive,
    });

    socket.send(`Echo: ${data}`); // Confirm receipt
  });
});
```

### 🐛 Debug Mode

```typescript
// 🐛 Enable comprehensive debugging
app.enableWebSocket({
  debug: true,
  logLevel: 'debug',
  logFunction: (level, message) => {
    console.log(`[WS-${level.toUpperCase()}] ${message}`);
  },
});

// 📝 Log all events
app.wsUse((socket, req, next) => {
  console.log(`🔌 [${socket.id}] Connected from ${socket.ip}`);

  socket.on('message', (data) => {
    console.log(`📨 [${socket.id}] Message: ${data.substring(0, 50)}...`);
  });

  socket.on('close', (code, reason) => {
    console.log(`🚪 [${socket.id}] Disconnected: ${code} - ${reason}`);
  });

  next();
});
```

---

## 🎁 Advanced Features

### 🔄 Plugin System

```typescript
// 🔌 Custom WebSocket plugins
interface WebSocketPlugin {
  name: string;
  install(app: Application): void;
  onConnection?(socket: WebSocket, req: NextRushRequest): void;
  onMessage?(socket: WebSocket, message: any): void;
}

// 🎯 Analytics plugin example
class AnalyticsPlugin implements WebSocketPlugin {
  name = 'Analytics';
  private events: any[] = [];

  install(app: Application) {
    console.log('📊 Analytics plugin installed');
  }

  onConnection(socket: WebSocket, req: NextRushRequest) {
    this.trackEvent('connection', {
      socketId: socket.id,
      ip: socket.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  onMessage(socket: WebSocket, message: any) {
    this.trackEvent('message', {
      socketId: socket.id,
      messageType: message.type,
      size: JSON.stringify(message).length,
    });
  }

  private trackEvent(type: string, data: any) {
    this.events.push({ type, data, timestamp: Date.now() });

    if (this.events.length >= 100) {
      console.log(`📊 Flushing ${this.events.length} events`);
      this.events = [];
    }
  }
}
```

### 📊 Monitoring & Statistics

```typescript
// 📈 Get comprehensive statistics
app.get('/api/websocket/stats', (req, res) => {
  const stats = app.getWebSocketStats();

  res.json({
    connections: {
      active: stats.activeConnections,
      peak: stats.peakConnections,
      total: stats.totalConnections,
    },
    messages: {
      sent: stats.messagesSent,
      received: stats.messagesReceived,
      rate: stats.messagesPerSecond,
    },
    rooms: {
      active: stats.activeRooms,
      avgSize: stats.averageRoomSize,
    },
    performance: {
      uptime: stats.uptime,
      responseTime: stats.averageResponseTime,
      memory: stats.memoryUsage,
    },
  });
});

// 🏥 Health check endpoint
app.get('/api/websocket/health', (req, res) => {
  const health = app.getWebSocketHealth();

  res.status(health.status === 'healthy' ? 200 : 503).json({
    status: health.status,
    checks: {
      connections:
        health.activeConnections < health.maxConnections ? 'ok' : 'warning',
      memory:
        health.memoryUsage.heapUsed < health.memoryUsage.heapTotal * 0.8
          ? 'ok'
          : 'critical',
    },
    uptime: health.uptime,
  });
});
```

---

## 📚 Quick Reference & Resources

### 🎯 Essential Commands Cheat Sheet

```typescript
// Setup & Configuration
app.enableWebSocket(options)              // Initialize WebSocket server
app.ws(path, handler)                     // Create WebSocket endpoint
app.wsUse(middleware)                     // Add global middleware

// Connection Management
socket.send(data)                         // Send message to socket
socket.broadcast(data, room?)             // Broadcast to all/room
socket.close(code?, reason?)              // Close connection

// Room Operations
await socket.join(room)                   // Join room
await socket.leave(room)                  // Leave room
socket.to(room).send(data)               // Send to room
socket.getRoomCount(room)                // Get room member count

// Event Handling
socket.on(event, handler)                // Listen to events
socket.emit(event, ...args)              // Emit events
socket.once(event, handler)              // One-time event listener

// Information & Stats
socket.id                                // Unique socket ID
socket.ip                                // Client IP address
socket.rooms                             // Current rooms Set
app.getWebSocketStats()                  // Server statistics
```

### 🌟 Resources

- 📖 **[NextRush Documentation](./README.md)** - Complete framework docs
- 🛠️ **[API Reference](./API-REFERENCE.md)** - Detailed API specs
- 💡 **[Examples Collection](../examples/)** - Real-world examples
- 🔍 **[WebSocket RFC 6455](https://tools.ietf.org/html/rfc6455)** - Protocol specification

---

**🎉 Congratulations!** You're now equipped with comprehensive NextRush WebSocket knowledge. Build powerful, scalable real-time applications with zero dependencies!

_Built with ❤️ using only Node.js built-in features - Zero dependencies!_ 🚀

**📊 Document Stats:** Complete WebSocket guide in **under 1,500 lines** with real examples and best practices! 🎯
