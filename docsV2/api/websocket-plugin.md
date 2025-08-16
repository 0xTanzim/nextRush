# WebSocket Plugin API Reference

The WebSocket Plugin adds real-time bidirectional communication to NextRush v2 applications with room-based messaging, connection management, and middleware support.

## What it is

A production-ready WebSocket server that provides:

- **Context-enhanced WebSocket support** integrated with NextRush requests
- **Room-based messaging** for group communications
- **Connection lifecycle management** with automatic cleanup
- **Middleware system** for WebSocket-specific logic
- **Origin verification** and client authentication
- **Heartbeat/ping-pong** for connection health monitoring
- **Message size limits** and connection limits
- **Event-driven architecture** for extensibility

## When to use

Use the WebSocket Plugin when you need:

- Real-time chat applications
- Live notifications and updates
- Collaborative editing features
- Live data streaming (stock prices, sports scores)
- Gaming applications
- IoT device communication
- Real-time dashboards

## Quick start

```typescript
import { createApp, WebSocketPlugin } from 'nextrush';

const app = createApp();

// Basic WebSocket plugin
const wsPlugin = new WebSocketPlugin({
  path: '/ws',
});

wsPlugin.install(app);

// Define WebSocket handlers
app.ws('/chat', (socket, req) => {
  console.log('New WebSocket connection:', socket.id);

  // Join a room
  socket.join('general');

  // Listen for messages
  socket.onMessage(data => {
    const message = JSON.parse(data.toString());

    // Broadcast to all clients in room
    socket.broadcast(
      'general',
      JSON.stringify({
        user: message.user,
        text: message.text,
        timestamp: Date.now(),
      })
    );
  });

  // Handle disconnection
  socket.onClose((code, reason) => {
    console.log('Client disconnected:', socket.id, code, reason);
  });
});

app.listen(3000);
```

---

# WebSocketPlugin Class

## Constructor

```typescript
constructor(options?: WebSocketPluginOptions)
```

**Parameters:**

- `options` (WebSocketPluginOptions, optional): WebSocket server configuration

**Example:**

```typescript
const wsPlugin = new WebSocketPlugin({
  path: ['/ws', '/chat/*'],
  maxConnections: 1000,
  maxMessageSize: 64 * 1024, // 64KB
  heartbeatMs: 30000,
  allowOrigins: ['http://localhost:3000', 'https://myapp.com'],
});
```

---

# Configuration Options

```typescript
interface WebSocketPluginOptions {
  path?: string | string[]; // WebSocket paths
  heartbeatMs?: number; // Ping interval
  pongTimeoutMs?: number; // Pong timeout
  maxConnections?: number; // Connection limit
  maxMessageSize?: number; // Message size limit
  allowOrigins?: (string | RegExp)[]; // CORS origins
  verifyClient?: (req: IncomingMessage) => Promise<boolean> | boolean;
  debug?: boolean; // Debug logging
}
```

## Configuration Details

### `path` (optional)

**What:** WebSocket endpoint paths (exact match or wildcard)
**Default:** `'/ws'`

```typescript
// Single path
{
  path: '/websocket';
}

// Multiple paths
{
  path: ['/ws', '/chat', '/notifications'];
}

// Wildcard paths
{
  path: ['/api/ws/*', '/rooms/*'];
}
// Matches: /api/ws/chat, /rooms/game1, etc.
```

### `heartbeatMs` (optional)

**What:** Ping interval for connection health checks
**Default:** `30000` (30 seconds)

```typescript
// Ping every 15 seconds
{
  heartbeatMs: 15000;
}

// Disable heartbeat (not recommended)
{
  heartbeatMs: 0;
}
```

### `pongTimeoutMs` (optional)

**What:** Timeout for pong responses before closing connection
**Default:** `45000` (45 seconds)

```typescript
// Close connection if no pong within 20 seconds
{
  pongTimeoutMs: 20000;
}
```

### `maxConnections` (optional)

**What:** Maximum concurrent WebSocket connections
**Default:** `10000`

```typescript
// Limit to 500 connections
{
  maxConnections: 500;
}

// Unlimited connections (be careful!)
{
  maxConnections: Infinity;
}
```

### `maxMessageSize` (optional)

**What:** Maximum message size in bytes
**Default:** `1048576` (1MB)

```typescript
// 64KB message limit
{
  maxMessageSize: 64 * 1024;
}

// 10MB for large data transfers
{
  maxMessageSize: 10 * 1024 * 1024;
}
```

### `allowOrigins` (optional)

**What:** Allowed origins for CORS verification
**Default:** `[]` (allow all)

```typescript
// Specific origins
{
  allowOrigins: [
    'http://localhost:3000',
    'https://myapp.com',
    'https://app.mycompany.com',
  ];
}

// Pattern matching
{
  allowOrigins: [/^https:\/\/.*\.mycompany\.com$/, 'http://localhost:*'];
}
```

### `verifyClient` (optional)

**What:** Custom client verification function
**Default:** `() => true` (allow all)

```typescript
// Custom authentication
{
  verifyClient: async req => {
    const token = new URL(req.url || '', 'http://localhost').searchParams.get(
      'token'
    );

    if (!token) return false;

    try {
      const user = await verifyJWT(token);
      return !!user;
    } catch {
      return false;
    }
  };
}

// IP-based filtering
{
  verifyClient: req => {
    const clientIP = req.socket.remoteAddress;
    const allowedIPs = ['127.0.0.1', '10.0.0.0/8'];
    return allowedIPs.some(ip => clientIP?.startsWith(ip));
  };
}
```

---

# Application Methods

When the plugin is installed, it adds WebSocket methods to the application:

## app.ws(path, handler)

Register a WebSocket route handler.

```typescript
app.ws(path: string, handler: WSHandler): Application
```

**Parameters:**

- `path` (string): WebSocket endpoint path
- `handler` (WSHandler): WebSocket connection handler

**Example:**

```typescript
// Chat room handler
app.ws('/chat/:room', (socket, req) => {
  const url = new URL(req.url || '', 'http://localhost');
  const room = url.pathname.split('/')[2];

  socket.join(`chat:${room}`);

  socket.onMessage(data => {
    const message = JSON.parse(data.toString());
    socket.broadcast(
      `chat:${room}`,
      JSON.stringify({
        ...message,
        timestamp: Date.now(),
      })
    );
  });
});

// Notification handler
app.ws('/notifications', (socket, req) => {
  const userId = getUserIdFromRequest(req);
  socket.join(`user:${userId}`);

  // Send pending notifications
  sendPendingNotifications(socket, userId);
});
```

## app.wsUse(middleware)

Add WebSocket middleware that runs before handlers.

```typescript
app.wsUse(middleware: WSMiddleware): Application
```

**Parameters:**

- `middleware` (WSMiddleware): WebSocket middleware function

**Example:**

```typescript
// Authentication middleware
app.wsUse(async (socket, req, next) => {
  const url = new URL(req.url || '', 'http://localhost');
  const token = url.searchParams.get('token');

  if (!token) {
    socket.close(1008, 'Authentication required');
    return;
  }

  try {
    const user = await verifyJWT(token);
    (socket as any).user = user; // Attach user to socket
    next();
  } catch {
    socket.close(1008, 'Invalid token');
  }
});

// Logging middleware
app.wsUse((socket, req, next) => {
  console.log(
    `WebSocket connection: ${socket.id} from ${req.socket.remoteAddress}`
  );
  next();
});

// Rate limiting middleware
const rateLimits = new Map();
app.wsUse((socket, req, next) => {
  const clientIP = req.socket.remoteAddress;
  const now = Date.now();
  const minute = Math.floor(now / 60000);
  const key = `${clientIP}:${minute}`;

  const count = rateLimits.get(key) || 0;
  if (count >= 60) {
    // 60 connections per minute
    socket.close(1008, 'Rate limit exceeded');
    return;
  }

  rateLimits.set(key, count + 1);
  next();
});
```

## app.wsBroadcast(message, room?)

Broadcast message to all connections or specific room.

```typescript
app.wsBroadcast(message: string, room?: string): Application
```

**Parameters:**

- `message` (string): Message to broadcast
- `room` (string, optional): Target room (if omitted, broadcasts to all)

**Example:**

```typescript
// Broadcast to all connections
app.wsBroadcast(
  JSON.stringify({
    type: 'announcement',
    message: 'Server maintenance in 5 minutes',
  })
);

// Broadcast to specific room
app.wsBroadcast(
  JSON.stringify({
    type: 'update',
    data: { score: '3-2' },
  }),
  'game:123'
);

// Use in routes
app.post('/admin/broadcast', async ctx => {
  const { message, room } = ctx.body as any;

  app.wsBroadcast(
    JSON.stringify({
      type: 'admin',
      message,
      timestamp: Date.now(),
    }),
    room
  );

  ctx.res.json({ success: true });
});
```

---

# WSConnection Interface

WebSocket connections provide these methods and properties:

```typescript
interface WSConnection {
  id: string; // Unique connection ID
  url: string; // Request URL
  isAlive: boolean; // Connection status
  lastPong: number; // Last pong timestamp
  send(data: string | Buffer): void; // Send message
  close(code?: number, reason?: string): void; // Close connection
  join(room: string): void; // Join room
  leave(room: string): void; // Leave room
  broadcast(room: string, data: string | Buffer): void; // Broadcast to room
  onMessage(listener: (data: string | Buffer) => void): void; // Message handler
  onClose(listener: (code: number, reason: string) => void): void; // Close handler
}
```

## Connection Methods

### send(data)

Send message to the client:

```typescript
// Text message
socket.send('Hello client!');

// JSON message
socket.send(
  JSON.stringify({
    type: 'notification',
    title: 'New Message',
    body: 'You have a new message from John',
  })
);

// Binary data
const buffer = Buffer.from('binary data');
socket.send(buffer);
```

### close(code?, reason?)

Close the connection:

```typescript
// Normal closure
socket.close();

// With close code and reason
socket.close(1000, 'Session ended');

// Policy violation
socket.close(1008, 'Authentication expired');
```

### join(room) / leave(room)

Manage room membership:

```typescript
// Join rooms
socket.join('general');
socket.join('game:123');
socket.join(`user:${userId}`);

// Leave rooms
socket.leave('general');
socket.leave('game:123');

// Auto-leave all rooms on disconnect
socket.onClose(() => {
  // Rooms are automatically cleaned up
});
```

### broadcast(room, data)

Send message to all connections in a room:

```typescript
// Broadcast to room (excluding sender)
socket.broadcast(
  'general',
  JSON.stringify({
    type: 'message',
    user: 'John',
    text: 'Hello everyone!',
  })
);

// Include sender in broadcast
socket.send(message); // Send to self
socket.broadcast('general', message); // Send to others
```

### onMessage(listener)

Handle incoming messages:

```typescript
socket.onMessage(data => {
  try {
    const message = JSON.parse(data.toString());

    switch (message.type) {
      case 'chat':
        handleChatMessage(socket, message);
        break;
      case 'game_move':
        handleGameMove(socket, message);
        break;
      default:
        socket.send(JSON.stringify({ error: 'Unknown message type' }));
    }
  } catch (error) {
    socket.send(JSON.stringify({ error: 'Invalid JSON' }));
  }
});
```

### onClose(listener)

Handle connection closure:

```typescript
socket.onClose((code, reason) => {
  console.log(`Connection ${socket.id} closed: ${code} - ${reason}`);

  // Cleanup user session
  removeUserSession(socket.id);

  // Notify other users
  socket.broadcast(
    'general',
    JSON.stringify({
      type: 'user_left',
      userId: socket.id,
    })
  );
});
```

---

# Context Enhancement

The plugin enhances the request context with WebSocket functionality:

```typescript
// Enhanced context when plugin is installed
interface WSContext extends Context {
  isWebSocket: boolean; // True if WebSocket upgrade request
  ws?: WSConnection; // WebSocket connection (after upgrade)
  wsRooms: WSRoomManager; // Room manager instance
}

// Use in regular HTTP middleware
app.use(async (ctx, next) => {
  const wsCtx = ctx as WSContext;

  if (wsCtx.isWebSocket) {
    console.log('WebSocket upgrade request detected');
    // WebSocket upgrade will be handled automatically
  }

  // Access room manager for broadcasting from HTTP routes
  wsCtx.wsRooms.broadcast(
    'notifications',
    JSON.stringify({
      type: 'http_event',
      path: ctx.path,
      timestamp: Date.now(),
    })
  );

  await next();
});
```

---

# Complete Examples

## Real-time Chat Application

```typescript
import { createApp, WebSocketPlugin } from 'nextrush';

const app = createApp();

// Configure WebSocket plugin
const wsPlugin = new WebSocketPlugin({
  path: '/chat',
  maxConnections: 1000,
  verifyClient: async req => {
    // Verify JWT token from query string
    const url = new URL(req.url || '', 'http://localhost');
    const token = url.searchParams.get('token');
    return token && (await verifyJWT(token));
  },
});

wsPlugin.install(app);

// Store active users
const activeUsers = new Map();

// Authentication middleware
app.wsUse(async (socket, req, next) => {
  const url = new URL(req.url || '', 'http://localhost');
  const token = url.searchParams.get('token');

  try {
    const user = await verifyJWT(token);
    (socket as any).user = user;
    activeUsers.set(socket.id, user);
    next();
  } catch {
    socket.close(1008, 'Invalid authentication');
  }
});

// Chat handler
app.ws('/chat', (socket, req) => {
  const user = (socket as any).user;

  // Join general room
  socket.join('general');

  // Announce user joined
  socket.broadcast(
    'general',
    JSON.stringify({
      type: 'user_joined',
      user: { id: user.id, name: user.name },
      timestamp: Date.now(),
    })
  );

  // Send user list
  socket.send(
    JSON.stringify({
      type: 'user_list',
      users: Array.from(activeUsers.values()),
    })
  );

  // Handle messages
  socket.onMessage(data => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'chat_message':
          // Broadcast to all users in general room
          socket.broadcast(
            'general',
            JSON.stringify({
              type: 'message',
              id: generateMessageId(),
              user: { id: user.id, name: user.name },
              text: message.text,
              timestamp: Date.now(),
            })
          );
          break;

        case 'private_message':
          // Send to specific user
          const targetSocket = findSocketByUserId(message.targetUserId);
          if (targetSocket) {
            targetSocket.send(
              JSON.stringify({
                type: 'private_message',
                from: { id: user.id, name: user.name },
                text: message.text,
                timestamp: Date.now(),
              })
            );
          }
          break;

        case 'typing':
          // Broadcast typing indicator
          socket.broadcast(
            'general',
            JSON.stringify({
              type: 'typing',
              user: { id: user.id, name: user.name },
              isTyping: message.isTyping,
            })
          );
          break;
      }
    } catch (error) {
      socket.send(
        JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
        })
      );
    }
  });

  // Handle disconnection
  socket.onClose(() => {
    activeUsers.delete(socket.id);

    // Announce user left
    socket.broadcast(
      'general',
      JSON.stringify({
        type: 'user_left',
        user: { id: user.id, name: user.name },
        timestamp: Date.now(),
      })
    );
  });
});

// HTTP API for sending system messages
app.post('/api/admin/broadcast', async ctx => {
  const { message, room = 'general' } = ctx.body as any;

  app.wsBroadcast(
    JSON.stringify({
      type: 'system_message',
      message,
      timestamp: Date.now(),
    }),
    room
  );

  ctx.res.json({ success: true });
});

app.listen(3000);
```

## Live Dashboard with Metrics

```typescript
import { createApp, WebSocketPlugin } from 'nextrush';

const app = createApp();

const wsPlugin = new WebSocketPlugin({
  path: '/dashboard',
  heartbeatMs: 10000, // More frequent for real-time data
});

wsPlugin.install(app);

// Dashboard WebSocket handler
app.ws('/dashboard', (socket, req) => {
  // Join dashboard room
  socket.join('dashboard');

  // Send initial metrics
  sendMetrics(socket);

  socket.onMessage(data => {
    const message = JSON.parse(data.toString());

    if (message.type === 'subscribe') {
      // Subscribe to specific metric updates
      socket.join(`metrics:${message.metric}`);
    } else if (message.type === 'unsubscribe') {
      socket.leave(`metrics:${message.metric}`);
    }
  });
});

// Send metrics to all dashboard clients
setInterval(() => {
  const metrics = collectSystemMetrics();

  app.wsBroadcast(
    JSON.stringify({
      type: 'metrics_update',
      data: metrics,
      timestamp: Date.now(),
    }),
    'dashboard'
  );
}, 1000);

// HTTP endpoints that trigger WebSocket updates
app.post('/api/orders', async ctx => {
  const order = await createOrder(ctx.body);

  // Notify dashboard of new order
  app.wsBroadcast(
    JSON.stringify({
      type: 'new_order',
      order: order,
      timestamp: Date.now(),
    }),
    'dashboard'
  );

  ctx.res.json(order);
});

function collectSystemMetrics() {
  return {
    cpu: process.cpuUsage(),
    memory: process.memoryUsage(),
    connections: wsPlugin.getStats().totalConnections,
    uptime: process.uptime(),
  };
}

function sendMetrics(socket: WSConnection) {
  socket.send(
    JSON.stringify({
      type: 'initial_metrics',
      data: collectSystemMetrics(),
      timestamp: Date.now(),
    })
  );
}
```

## Gaming Application with Rooms

```typescript
import { createApp, WebSocketPlugin } from 'nextrush';

const app = createApp();

const wsPlugin = new WebSocketPlugin({
  path: '/game/*',
  maxConnections: 5000,
});

wsPlugin.install(app);

// Game state storage
const games = new Map();

// Game WebSocket handler
app.ws('/game/:gameId', (socket, req) => {
  const url = new URL(req.url || '', 'http://localhost');
  const gameId = url.pathname.split('/')[2];
  const playerId = url.searchParams.get('playerId');

  if (!playerId) {
    socket.close(1008, 'Player ID required');
    return;
  }

  // Join game room
  socket.join(`game:${gameId}`);

  // Initialize game if needed
  if (!games.has(gameId)) {
    games.set(gameId, {
      players: new Set(),
      state: 'waiting',
      board: initializeBoard(),
    });
  }

  const game = games.get(gameId);
  game.players.add(playerId);

  // Send game state to player
  socket.send(
    JSON.stringify({
      type: 'game_state',
      state: game.state,
      board: game.board,
      players: Array.from(game.players),
    })
  );

  // Notify other players
  socket.broadcast(
    `game:${gameId}`,
    JSON.stringify({
      type: 'player_joined',
      playerId,
      playerCount: game.players.size,
    })
  );

  // Handle game moves
  socket.onMessage(data => {
    const message = JSON.parse(data.toString());

    switch (message.type) {
      case 'move':
        if (validateMove(game, playerId, message.move)) {
          applyMove(game, message.move);

          // Broadcast move to all players
          socket.broadcast(
            `game:${gameId}`,
            JSON.stringify({
              type: 'move_made',
              playerId,
              move: message.move,
              board: game.board,
            })
          );

          // Check for game over
          const winner = checkWinner(game);
          if (winner) {
            app.wsBroadcast(
              JSON.stringify({
                type: 'game_over',
                winner,
                finalBoard: game.board,
              }),
              `game:${gameId}`
            );
          }
        } else {
          socket.send(
            JSON.stringify({
              type: 'invalid_move',
              reason: 'Move not allowed',
            })
          );
        }
        break;

      case 'chat':
        // Game chat
        socket.broadcast(
          `game:${gameId}`,
          JSON.stringify({
            type: 'chat_message',
            playerId,
            message: message.text,
            timestamp: Date.now(),
          })
        );
        break;
    }
  });

  // Handle player disconnect
  socket.onClose(() => {
    game.players.delete(playerId);

    // Notify remaining players
    socket.broadcast(
      `game:${gameId}`,
      JSON.stringify({
        type: 'player_left',
        playerId,
        playerCount: game.players.size,
      })
    );

    // Cleanup empty games
    if (game.players.size === 0) {
      games.delete(gameId);
    }
  });
});
```

---

# TypeScript Support

Full TypeScript support with proper type definitions:

```typescript
import type {
  WebSocketPlugin,
  WebSocketPluginOptions,
  WSConnection,
  WSHandler,
  WSMiddleware,
} from 'nextrush';

// Type-safe configuration
const options: WebSocketPluginOptions = {
  path: '/ws',
  maxConnections: 1000,
  verifyClient: async (req): Promise<boolean> => {
    // TypeScript knows req is IncomingMessage
    const auth = req.headers.authorization;
    return !!auth && (await validateToken(auth));
  },
};

// Type-safe handlers
const chatHandler: WSHandler = (socket, req) => {
  // TypeScript knows socket is WSConnection
  socket.onMessage(data => {
    // data is string | Buffer
    const message = data.toString();
    socket.send(`Echo: ${message}`);
  });
};

// Type-safe middleware
const authMiddleware: WSMiddleware = (socket, req, next) => {
  // Full type safety
  const token = new URL(req.url || '', 'http://localhost').searchParams.get(
    'token'
  );

  if (token) {
    next();
  } else {
    socket.close(1008, 'Authentication required');
  }
};
```

---

# Performance Considerations

## Connection Management

```typescript
// Monitor connection counts
const wsPlugin = new WebSocketPlugin({
  maxConnections: 1000,
  heartbeatMs: 30000,
  pongTimeoutMs: 45000,
});

// Get connection statistics
setInterval(() => {
  const stats = wsPlugin.getStats();
  console.log(`Active connections: ${stats.totalConnections}`);
  console.log(`Active rooms: ${stats.rooms.length}`);
}, 60000);
```

## Message Optimization

```typescript
// Efficient message handling
socket.onMessage(data => {
  // Parse once, use multiple times
  let message;
  try {
    message = JSON.parse(data.toString());
  } catch {
    return; // Invalid JSON, ignore
  }

  // Batch operations where possible
  if (message.type === 'bulk_update') {
    processBulkUpdate(message.items);
  }
});

// Use binary data for large payloads
const binaryData = new Uint8Array(largeDataSet);
socket.send(Buffer.from(binaryData));
```

## Room Management

```typescript
// Efficient room broadcasting
app.ws('/notifications', (socket, req) => {
  const userId = extractUserId(req);

  // Use specific room names
  socket.join(`user:${userId}`);
  socket.join(`role:${userRole}`);

  // Avoid large rooms when possible
  // Better: multiple small rooms
  // Worse: one giant room with all users
});
```

---

# Security Features

## Origin Verification

```typescript
const wsPlugin = new WebSocketPlugin({
  allowOrigins: [
    'https://myapp.com',
    'https://app.mydomain.com',
    /^https:\/\/.*\.trusted\.com$/,
  ],
});
```

## Client Authentication

```typescript
const wsPlugin = new WebSocketPlugin({
  verifyClient: async req => {
    const url = new URL(req.url || '', 'http://localhost');
    const token = url.searchParams.get('token');

    if (!token) return false;

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      return !!payload;
    } catch {
      return false;
    }
  },
});
```

## Message Validation

```typescript
import { z } from 'zod';

const MessageSchema = z.object({
  type: z.enum(['chat', 'move', 'subscribe']),
  data: z.record(z.unknown()),
});

socket.onMessage(data => {
  try {
    const message = MessageSchema.parse(JSON.parse(data.toString()));
    handleMessage(socket, message);
  } catch {
    socket.send(JSON.stringify({ error: 'Invalid message format' }));
  }
});
```

---

# See also

- [Context API](./context.md) - Enhanced request context
- [Application API](./application.md) - App-level configuration
- [Event System](./event-system.md) - Event-driven architecture
- [Plugin Architecture](../architecture/plugin-system.md) - How plugins work

---

_Added in v2.0.0-alpha.1_
