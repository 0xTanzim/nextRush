# @nextrush/websocket

WebSocket support for NextRush with rooms, broadcasting, and simple DX.

## Installation

```bash
npm install @nextrush/websocket ws
# or
pnpm add @nextrush/websocket ws
```

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { createWebSocket } from '@nextrush/websocket';

const app = createApp();

// Create WebSocket server
const wss = createWebSocket();

// Register WebSocket route
wss.on('/chat', (conn) => {
  console.log('Client connected:', conn.id);

  conn.on('message', (msg) => {
    conn.send(`Echo: ${msg}`);
  });

  conn.on('close', () => {
    console.log('Client disconnected');
  });
});

// Attach middleware
app.use(wss.upgrade());

// Start server and attach WebSocket
const server = app.listen(3000, () => {
  wss.attach(server);
  console.log('Server running on http://localhost:3000');
});
```

## Features

- **🏭 Factory Pattern** - Explicit, typed API with `createWebSocket()`
- **🚪 Room Support** - Join, leave, and broadcast to rooms
- **📡 Broadcasting** - Send to all connections or specific rooms
- **🔒 Authentication** - Custom client verification
- **💓 Heartbeat** - Automatic connection health checks
- **🔌 Middleware** - WebSocket-specific middleware support

## API

### createWebSocket(options?)

Create a WebSocket server instance.

```typescript
const wss = createWebSocket({
  // Maximum message size (default: 1MB)
  maxPayload: 1024 * 1024,

  // Heartbeat interval in ms (default: 30000, 0 to disable)
  heartbeatInterval: 30000,

  // Max connections (default: 0 = unlimited)
  maxConnections: 1000,

  // Allowed origins (default: [] = all)
  allowedOrigins: ['https://example.com'],

  // Custom authentication
  verifyClient: async (request) => {
    const token = request.headers.authorization;
    return validateToken(token);
  },

  // Connection lifecycle hooks
  onConnection: (conn) => console.log('Connected:', conn.id),
  onClose: (conn, code, reason) => console.log('Closed:', code),
  onError: (conn, error) => console.error('Error:', error),
});
```

### wss.on(path, handler)

Register a WebSocket route handler.

```typescript
wss.on('/chat', (conn, request) => {
  // conn: WSConnection instance
  // request: IncomingMessage from Node.js
});

// With path parameters (pattern matching)
wss.on('/room/:id', (conn, request) => {
  const url = new URL(request.url, 'http://localhost');
  console.log('Room:', url.pathname);
});
```

### wss.use(middleware)

Register WebSocket middleware.

```typescript
wss.use((conn, request, next) => {
  console.log('New connection from:', request.headers.origin);
  next();
});

// Authentication middleware
wss.use(async (conn, request, next) => {
  const token = request.headers['x-auth-token'];
  if (!token) {
    conn.close(1008, 'Unauthorized');
    return;
  }
  next();
});
```

### wss.upgrade()

Create NextRush middleware for WebSocket upgrade handling.

```typescript
app.use(wss.upgrade());
```

### wss.attach(server)

Attach to HTTP server to start handling WebSocket connections.

```typescript
const server = app.listen(3000);
await wss.attach(server);
```

### wss.broadcast(data, exclude?)

Broadcast to all connections.

```typescript
wss.broadcast('Hello everyone!');
wss.broadcast(JSON.stringify({ type: 'update', data: {} }));

// Exclude specific connection
wss.broadcast('Hello others!', currentConn);
```

### wss.broadcastToRoom(room, data, exclude?)

Broadcast to all connections in a room.

```typescript
wss.broadcastToRoom('chat', 'New message');
wss.broadcastJsonToRoom('chat', { type: 'message', text: 'Hello' });
```

## Connection API

### conn.send(data)

Send message to client.

```typescript
conn.send('Hello');
conn.send(Buffer.from([1, 2, 3]));
```

### conn.json(data)

Send JSON data (automatically stringified).

```typescript
conn.json({ type: 'message', text: 'Hello' });
```

### conn.close(code?, reason?)

Close the connection.

```typescript
conn.close(); // Normal closure
conn.close(1008, 'Policy violation');
```

### conn.join(room) / conn.leave(room)

Room management.

```typescript
conn.join('chat');
conn.join('notifications');
conn.leave('chat');
conn.leaveAll();
```

### conn.broadcast(room, data)

Broadcast to room (excluding self).

```typescript
conn.broadcast('chat', 'User joined!');
conn.broadcastJson('chat', { type: 'join', user: 'Alice' });
```

### conn.on(event, handler)

Listen for events.

```typescript
conn.on('message', (data) => {
  console.log('Received:', data);
});

conn.on('close', (code, reason) => {
  console.log('Closed:', code, reason);
});

conn.on('error', (error) => {
  console.error('Error:', error);
});
```

### conn.getRooms()

Get rooms this connection is in.

```typescript
const rooms = conn.getRooms();
// ['chat', 'notifications']
```

## Rooms Example

```typescript
wss.on('/chat/:room', (conn, request) => {
  const url = new URL(request.url!, 'http://localhost');
  const room = url.pathname.split('/').pop()!;

  conn.join(room);
  conn.broadcast(room, JSON.stringify({
    type: 'system',
    message: 'A user joined the room',
  }));

  conn.on('message', (msg) => {
    conn.broadcast(room, msg);
  });

  conn.on('close', () => {
    conn.broadcast(room, JSON.stringify({
      type: 'system',
      message: 'A user left the room',
    }));
  });
});
```

## Server Statistics

```typescript
// Get all connections
const connections = wss.getConnections();
console.log('Total connections:', wss.getConnectionCount());

// Get room info
const rooms = wss.getRooms();
const roomConnections = wss.getRoomConnections('chat');

// Close all connections
wss.closeAll(1001, 'Server shutdown');
```

## TypeScript

Full TypeScript support with exported types:

```typescript
import type {
  WSConnection,
  WSHandler,
  WSMiddleware,
  WebSocketOptions,
} from '@nextrush/websocket';
```

## License

MIT
