# WebSocket Plugin Documentation

## Overview

The NextRush v2 WebSocket Plugin provides a complete, RFC 6455-compliant WebSocket server implementation using only Node.js built-in modules. It offers high-performance real-time communication capabilities with support for rooms, middleware, and connection management.

## Features

### Core Features

- **RFC 6455 Compliance**: Full WebSocket protocol implementation with proper handshake validation
- **Pure Node.js**: No external dependencies, uses only Node.js built-in modules (`http`, `net`, `crypto`)
- **Room Management**: Built-in room system for broadcasting to groups of connections
- **Middleware Support**: WebSocket-specific middleware for authentication and processing
- **Connection Management**: Automatic connection lifecycle management with heartbeats
- **Path Routing**: Support for multiple WebSocket endpoints with exact and wildcard matching
- **Security Features**: Origin validation and client verification
- **Performance Optimized**: Efficient frame parsing and message handling

### Performance Features

- **Heartbeat System**: Configurable ping/pong to detect dead connections
- **Message Size Limits**: Protection against oversized messages
- **Connection Limits**: Configurable maximum concurrent connections
- **Memory Management**: Efficient connection tracking and cleanup

## Installation

```typescript
import { createApp } from '@/index';
import { WebSocketPlugin } from '@/plugins/websocket/websocket.plugin';

const app = createApp();

// Install the WebSocket plugin
const wsPlugin = new WebSocketPlugin({
  heartbeatMs: 30000,
  maxConnections: 1000,
  maxMessageSize: 1024 * 1024, // 1MB
});

wsPlugin.install(app);
```

## Basic Usage

### Simple Echo Server

```typescript
import { createApp } from '@/index';
import { WebSocketPlugin } from '@/plugins/websocket/websocket.plugin';

const app = createApp();
const wsPlugin = new WebSocketPlugin();
wsPlugin.install(app);

// Define a WebSocket route
app.ws('/echo', (socket, req) => {
  console.log('Client connected:', req.url);

  // Send welcome message
  socket.send('Welcome to echo server!');

  // Handle incoming messages
  socket.onMessage(data => {
    console.log('Received:', data);
    socket.send(`Echo: ${data}`);
  });

  // Handle connection close
  socket.onClose((code, reason) => {
    console.log('Client disconnected:', code, reason);
  });
});

app.listen(3000, () => {
  console.log('WebSocket server running on ws://localhost:3000/echo');
});
```

### Chat Server with Rooms

```typescript
import { createApp } from '@/index';
import { WebSocketPlugin } from '@/plugins/websocket/websocket.plugin';

const app = createApp();
const wsPlugin = new WebSocketPlugin();
wsPlugin.install(app);

app.ws('/chat/:room', (socket, req) => {
  const room = req.url?.split('/').pop() || 'general';

  // Join the room
  socket.join(room);

  // Notify room about new user
  app.wsBroadcast(`User joined room: ${room}`, room);

  socket.onMessage(data => {
    try {
      const message = JSON.parse(data.toString());

      // Broadcast message to room
      app.wsBroadcast(
        JSON.stringify({
          type: 'message',
          room,
          user: message.user,
          content: message.content,
          timestamp: Date.now(),
        }),
        room
      );
    } catch (error) {
      socket.send(JSON.stringify({ error: 'Invalid message format' }));
    }
  });

  socket.onClose(() => {
    socket.leave(room);
    app.wsBroadcast(`User left room: ${room}`, room);
  });
});
```

## Configuration Options

### WebSocketPluginOptions

```typescript
interface WebSocketPluginOptions {
  path?: string | string[]; // Accepted paths (exact or wildcard)
  heartbeatMs?: number; // Ping interval (default: 30000)
  pongTimeoutMs?: number; // Close if no pong (default: 45000)
  maxConnections?: number; // Maximum concurrent connections (default: 10000)
  maxMessageSize?: number; // Maximum message size in bytes (default: 1MB)
  allowOrigins?: (string | RegExp)[]; // Allowed origins for CORS
  verifyClient?: (req: IncomingMessage) => Promise<boolean> | boolean;
  debug?: boolean; // Enable debug logging (default: false)
}
```

### Default Configuration

```typescript
const DEFAULT_OPTIONS = {
  path: '/ws',
  heartbeatMs: 30000,
  pongTimeoutMs: 45000,
  maxConnections: 10000,
  maxMessageSize: 1 << 20, // 1MB
  allowOrigins: [],
  verifyClient: () => true,
  debug: false,
};
```

## API Reference

### Application Extensions

The WebSocket plugin extends the Application object with the following methods:

#### `app.ws(path: string, handler: WSHandler)`

Registers a WebSocket route handler.

```typescript
app.ws('/api/websocket', (socket, req) => {
  // Handle WebSocket connection
});
```

#### `app.wsUse(middleware: WSMiddleware)`

Adds middleware that runs for all WebSocket connections.

```typescript
app.wsUse((socket, req, next) => {
  // Authenticate user
  const token = req.headers.authorization;
  if (!isValidToken(token)) {
    socket.close(1008, 'Unauthorized');
    return;
  }
  next();
});
```

#### `app.wsBroadcast(data: string | Buffer, room?: string)`

Broadcasts a message to all connections or a specific room.

```typescript
// Broadcast to all connections
app.wsBroadcast('Server announcement');

// Broadcast to specific room
app.wsBroadcast('Room message', 'room1');
```

### WebSocket Connection API

#### Connection Properties

- `id: string` - Unique connection identifier
- `url: string` - Request URL
- `isAlive: boolean` - Connection status
- `lastPong: number` - Last pong timestamp

#### Connection Methods

##### `send(data: string | Buffer): void`

Sends data to the client.

```typescript
socket.send('Hello client');
socket.send(Buffer.from('Binary data'));
```

##### `close(code?: number, reason?: string): void`

Closes the connection with optional code and reason.

```typescript
socket.close();
socket.close(1000, 'Normal closure');
socket.close(1008, 'Policy violation');
```

##### `join(room: string): void`

Joins a room for broadcasting.

```typescript
socket.join('lobby');
socket.join('game-' + gameId);
```

##### `leave(room: string): void`

Leaves a room.

```typescript
socket.leave('lobby');
```

##### `onMessage(listener: (data: string | Buffer) => void): void`

Registers a message event listener.

```typescript
socket.onMessage(data => {
  console.log('Received:', data);
});
```

##### `onClose(listener: (code: number, reason: string) => void): void`

Registers a close event listener.

```typescript
socket.onClose((code, reason) => {
  console.log('Connection closed:', code, reason);
});
```

## Advanced Usage

### Authentication Middleware

```typescript
// JWT authentication middleware
app.wsUse(async (socket, req, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = await verifyJWT(token);

    // Attach user to request
    (req as any).user = user;
    next();
  } catch (error) {
    socket.close(1008, 'Invalid token');
  }
});

app.ws('/private', (socket, req) => {
  const user = (req as any).user;
  socket.send(`Welcome ${user.name}!`);
});
```

### Rate Limiting

```typescript
const connections = new Map();

app.wsUse((socket, req, next) => {
  const clientIp = req.socket.remoteAddress;
  const now = Date.now();

  if (!connections.has(clientIp)) {
    connections.set(clientIp, { count: 1, lastReset: now });
  } else {
    const client = connections.get(clientIp);

    // Reset counter every minute
    if (now - client.lastReset > 60000) {
      client.count = 1;
      client.lastReset = now;
    } else {
      client.count++;
    }

    // Limit to 10 connections per minute per IP
    if (client.count > 10) {
      socket.close(1008, 'Rate limit exceeded');
      return;
    }
  }

  next();
});
```

### Custom Protocol Implementation

```typescript
app.ws('/game', (socket, req) => {
  socket.onMessage(data => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'join_game':
          socket.join(`game-${message.gameId}`);
          socket.send(
            JSON.stringify({ type: 'joined', gameId: message.gameId })
          );
          break;

        case 'player_move':
          app.wsBroadcast(
            JSON.stringify({
              type: 'move_update',
              playerId: message.playerId,
              position: message.position,
            }),
            `game-${message.gameId}`
          );
          break;

        case 'chat_message':
          app.wsBroadcast(
            JSON.stringify({
              type: 'chat',
              player: message.player,
              message: message.message,
              timestamp: Date.now(),
            }),
            `game-${message.gameId}`
          );
          break;

        default:
          socket.send(JSON.stringify({ error: 'Unknown message type' }));
      }
    } catch (error) {
      socket.send(JSON.stringify({ error: 'Invalid JSON' }));
    }
  });
});
```

## Client Usage

### Browser WebSocket Client

```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:3000/echo');

ws.onopen = event => {
  console.log('Connected to WebSocket server');
  ws.send('Hello server!');
};

ws.onmessage = event => {
  console.log('Received:', event.data);
};

ws.onclose = event => {
  console.log('Connection closed:', event.code, event.reason);
};

ws.onerror = error => {
  console.error('WebSocket error:', error);
};
```

### Node.js WebSocket Client (v21+)

```javascript
// Node.js v21+ has built-in WebSocket client
const ws = new WebSocket('ws://localhost:3000/echo');

ws.addEventListener('open', event => {
  console.log('Connected to WebSocket server');
  ws.send('Hello from Node.js!');
});

ws.addEventListener('message', event => {
  console.log('Received:', event.data);
});

ws.addEventListener('close', event => {
  console.log('Connection closed:', event.code, event.reason);
});
```

## Error Handling

### WebSocket Close Codes

The plugin uses standard WebSocket close codes:

- `1000` - Normal Closure
- `1001` - Going Away (ping timeout)
- `1008` - Policy Violation (auth/rate limiting)
- `1009` - Message Too Big
- `1011` - Internal Error (middleware/handler errors)

### Error Handling Examples

```typescript
app.ws('/api', (socket, req) => {
  socket.onMessage(data => {
    try {
      // Process message
      const result = processMessage(data);
      socket.send(JSON.stringify({ success: true, data: result }));
    } catch (error) {
      console.error('Message processing error:', error);
      socket.send(
        JSON.stringify({
          error: 'Processing failed',
          message: error.message,
        })
      );
    }
  });

  socket.onClose((code, reason) => {
    console.log(`Connection closed: ${code} - ${reason}`);
    // Cleanup resources
    cleanup(socket.id);
  });
});
```

## Testing

### Unit Testing with Vitest

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '@/index';
import { WebSocketPlugin } from '@/plugins/websocket/websocket.plugin';

describe('WebSocket Plugin', () => {
  let app: any;
  let wsPlugin: WebSocketPlugin;

  beforeEach(() => {
    app = createApp();
    wsPlugin = new WebSocketPlugin();
    wsPlugin.install(app);
  });

  it('should register WebSocket routes', () => {
    let receivedMessage = '';

    app.ws('/test', (socket: any) => {
      socket.onMessage((data: string) => {
        receivedMessage = data;
      });
    });

    expect(typeof app.ws).toBe('function');
  });
});
```

### Integration Testing

```typescript
import { Socket } from 'node:net';
import { createHash } from 'node:crypto';

describe('WebSocket Integration', () => {
  it('should handle WebSocket handshake correctly', async () => {
    const app = createApp();
    const wsPlugin = new WebSocketPlugin();
    wsPlugin.install(app);

    app.ws('/test', (socket: any) => {
      socket.send('Hello from server!');
    });

    const server = app.listen(3000);

    return new Promise<void>((resolve, reject) => {
      const socket = new Socket();
      const websocketKey = Buffer.from(Math.random().toString(36)).toString(
        'base64'
      );

      socket.connect(3000, 'localhost', () => {
        const handshakeRequest = [
          'GET /test HTTP/1.1',
          'Host: localhost:3000',
          'Upgrade: websocket',
          'Connection: Upgrade',
          `Sec-WebSocket-Key: ${websocketKey}`,
          'Sec-WebSocket-Version: 13',
          '\r\n',
        ].join('\r\n');

        socket.write(handshakeRequest);
      });

      socket.on('data', data => {
        const response = data.toString();

        expect(response).toContain('HTTP/1.1 101 Switching Protocols');
        expect(response).toContain('Upgrade: websocket');
        expect(response).toContain('Connection: Upgrade');

        socket.destroy();
        server.close();
        resolve();
      });
    });
  });
});
```

## Performance Considerations

### Connection Management

- Use reasonable `maxConnections` limits based on server capacity
- Monitor connection counts and implement graceful degradation
- Configure appropriate `heartbeatMs` intervals (30-60 seconds typical)

### Memory Management

- Clean up event listeners when connections close
- Use rooms efficiently to avoid broadcasting to unnecessary connections
- Implement message size limits to prevent memory exhaustion

### Scalability

- Consider using a message broker (Redis) for multi-instance deployments
- Implement connection sticky sessions for load balancing
- Monitor and limit resource usage per connection

## Troubleshooting

### Common Issues

#### Connection Refused

- Verify the server is listening on the correct port
- Check firewall settings
- Ensure WebSocket routes are registered before `app.listen()`

#### Handshake Failures

- Verify client sends required WebSocket headers
- Check origin restrictions in plugin configuration
- Ensure `Sec-WebSocket-Key` header is present and valid

#### Connection Timeouts

- Adjust `heartbeatMs` and `pongTimeoutMs` settings
- Implement proper error handling for network issues
- Consider connection retry logic on client side

#### Memory Leaks

- Always remove event listeners when connections close
- Clean up room memberships properly
- Monitor connection counts and close idle connections

### Debug Mode

Enable debug logging to troubleshoot issues:

```typescript
const wsPlugin = new WebSocketPlugin({
  debug: true,
  // ... other options
});
```

## Migration from v1

The v2 WebSocket plugin has some differences from v1:

### Breaking Changes

- Constructor options have changed
- Connection API is slightly different
- Middleware system is new

### Migration Example

```typescript
// v1
const wsPlugin = new WebSocketPlugin('/ws');

// v2
const wsPlugin = new WebSocketPlugin({ path: '/ws' });
```

## License

The WebSocket plugin is part of NextRush v2 and follows the same license terms.

## Contributing

When contributing to the WebSocket plugin:

1. Follow the existing code style and patterns
2. Add comprehensive unit and integration tests
3. Update documentation for any API changes
4. Test with real WebSocket clients
5. Consider performance implications of changes

## Resources

- [RFC 6455 - The WebSocket Protocol](https://tools.ietf.org/html/rfc6455)
- [MDN WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Node.js WebSocket Support](https://nodejs.org/api/globals.html#websocket)
