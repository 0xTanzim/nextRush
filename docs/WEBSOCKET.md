# WebSocket Guide

NextRush provides built-in WebSocket support with zero dependencies, room management, and advanced features.

## Basic WebSocket Usage

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Basic WebSocket endpoint
app.ws('/chat', (socket) => {
  console.log('Client connected');

  // Send welcome message
  socket.send('Welcome to the chat!');

  // Handle incoming messages
  socket.on('message', (data) => {
    console.log('Received:', data);
    socket.send(`Echo: ${data}`);
  });

  // Handle client disconnect
  socket.on('close', () => {
    console.log('Client disconnected');
  });

  // Handle errors
  socket.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

app.listen(3000, () => {
  console.log('Server with WebSocket running on port 3000');
});
```

## WebSocket with Route Parameters

```typescript
// WebSocket with room parameter
app.ws('/rooms/:roomId', (socket, req) => {
  const roomId = req.params.roomId;
  console.log(`Client joined room: ${roomId}`);

  // Access request parameters
  const userId = req.query.userId;
  const token = req.headers.authorization;

  socket.send(`Welcome to room ${roomId}!`);

  socket.on('message', (data) => {
    // Broadcast to room (implement room logic)
    broadcastToRoom(roomId, data, socket);
  });
});

// WebSocket with multiple parameters
app.ws('/games/:gameId/players/:playerId', (socket, req) => {
  const { gameId, playerId } = req.params;

  socket.gameId = gameId;
  socket.playerId = playerId;

  socket.send(
    JSON.stringify({
      type: 'connected',
      gameId,
      playerId,
    })
  );
});
```

## Room Management

```typescript
// Room management system
class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  joinRoom(roomId, socket) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }

    this.rooms.get(roomId).add(socket);
    socket.roomId = roomId;

    // Notify others in the room
    this.broadcastToRoom(
      roomId,
      {
        type: 'user-joined',
        message: `User joined room ${roomId}`,
        userCount: this.rooms.get(roomId).size,
      },
      socket
    );

    console.log(
      `Socket joined room ${roomId}. Total: ${this.rooms.get(roomId).size}`
    );
  }

  leaveRoom(socket) {
    const roomId = socket.roomId;
    if (!roomId || !this.rooms.has(roomId)) return;

    this.rooms.get(roomId).delete(socket);

    // Clean up empty rooms
    if (this.rooms.get(roomId).size === 0) {
      this.rooms.delete(roomId);
    } else {
      // Notify others in the room
      this.broadcastToRoom(roomId, {
        type: 'user-left',
        message: `User left room ${roomId}`,
        userCount: this.rooms.get(roomId).size,
      });
    }

    delete socket.roomId;
  }

  broadcastToRoom(roomId, message, excludeSocket = null) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const messageStr =
      typeof message === 'string' ? message : JSON.stringify(message);

    room.forEach((socket) => {
      if (socket !== excludeSocket && socket.readyState === socket.OPEN) {
        socket.send(messageStr);
      }
    });
  }

  getRoomUsers(roomId) {
    const room = this.rooms.get(roomId);
    return room ? room.size : 0;
  }

  getAllRooms() {
    const roomData = {};
    this.rooms.forEach((sockets, roomId) => {
      roomData[roomId] = sockets.size;
    });
    return roomData;
  }
}

const roomManager = new RoomManager();

// WebSocket with room management
app.ws('/chat/:roomId', (socket, req) => {
  const roomId = req.params.roomId;

  // Join room
  roomManager.joinRoom(roomId, socket);

  // Send room info
  socket.send(
    JSON.stringify({
      type: 'room-info',
      roomId,
      userCount: roomManager.getRoomUsers(roomId),
    })
  );

  // Handle messages
  socket.on('message', (data) => {
    try {
      const message = JSON.parse(data);

      // Broadcast message to room
      roomManager.broadcastToRoom(roomId, {
        type: 'chat-message',
        message: message.text,
        timestamp: new Date().toISOString(),
        roomId,
      });
    } catch (error) {
      socket.send(
        JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
        })
      );
    }
  });

  // Handle disconnect
  socket.on('close', () => {
    roomManager.leaveRoom(socket);
  });
});
```

## Authentication & Authorization

```typescript
import jwt from 'jsonwebtoken';

// WebSocket authentication middleware
const authenticateWebSocket = (req, socket) => {
  const token =
    req.query.token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    socket.send(
      JSON.stringify({
        type: 'error',
        message: 'Authentication required',
      })
    );
    socket.close(1008, 'Authentication required');
    return false;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return true;
  } catch (error) {
    socket.send(
      JSON.stringify({
        type: 'error',
        message: 'Invalid token',
      })
    );
    socket.close(1008, 'Invalid token');
    return false;
  }
};

// Protected WebSocket endpoint
app.ws('/private-chat/:roomId', (socket, req) => {
  // Authenticate user
  if (!authenticateWebSocket(req, socket)) {
    return; // Authentication failed, connection closed
  }

  const { roomId } = req.params;
  const user = req.user;

  console.log(`Authenticated user ${user.email} joined room ${roomId}`);

  // Join room with user info
  socket.userId = user.id;
  socket.userEmail = user.email;
  roomManager.joinRoom(roomId, socket);

  // Send authenticated welcome
  socket.send(
    JSON.stringify({
      type: 'authenticated',
      user: { id: user.id, email: user.email },
      roomId,
    })
  );

  socket.on('message', (data) => {
    try {
      const message = JSON.parse(data);

      // Include user info in broadcast
      roomManager.broadcastToRoom(roomId, {
        type: 'chat-message',
        message: message.text,
        user: { id: user.id, email: user.email },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      socket.send(
        JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
        })
      );
    }
  });
});
```

## Real-time Features

### Live Chat Application

```typescript
// Complete chat application
class ChatServer {
  constructor() {
    this.rooms = new Map();
    this.users = new Map();
  }

  handleConnection(socket, req) {
    const { roomId } = req.params;
    const user = req.user;

    // Store user info
    this.users.set(socket, { ...user, roomId, joinedAt: new Date() });

    // Join room
    this.joinRoom(roomId, socket, user);

    // Handle different message types
    socket.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        this.handleMessage(socket, message);
      } catch (error) {
        this.sendError(socket, 'Invalid message format');
      }
    });

    socket.on('close', () => {
      this.handleDisconnect(socket);
    });
  }

  joinRoom(roomId, socket, user) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        users: new Map(),
        messages: [],
        createdAt: new Date(),
      });
    }

    const room = this.rooms.get(roomId);
    room.users.set(socket, user);

    // Send room history
    socket.send(
      JSON.stringify({
        type: 'room-history',
        messages: room.messages.slice(-50), // Last 50 messages
        users: Array.from(room.users.values()),
      })
    );

    // Notify others
    this.broadcastToRoom(
      roomId,
      {
        type: 'user-joined',
        user: { id: user.id, email: user.email },
        userCount: room.users.size,
      },
      socket
    );
  }

  handleMessage(socket, message) {
    const user = this.users.get(socket);
    if (!user) return;

    const roomId = user.roomId;
    const room = this.rooms.get(roomId);

    switch (message.type) {
      case 'chat':
        this.handleChatMessage(socket, message, user, room);
        break;
      case 'typing':
        this.handleTyping(socket, message, user, roomId);
        break;
      case 'private':
        this.handlePrivateMessage(socket, message, user);
        break;
      default:
        this.sendError(socket, 'Unknown message type');
    }
  }

  handleChatMessage(socket, message, user, room) {
    const chatMessage = {
      id: Date.now(),
      type: 'chat-message',
      text: message.text,
      user: { id: user.id, email: user.email },
      timestamp: new Date().toISOString(),
    };

    // Store message in room history
    room.messages.push(chatMessage);

    // Keep only last 100 messages
    if (room.messages.length > 100) {
      room.messages = room.messages.slice(-100);
    }

    // Broadcast to room
    this.broadcastToRoom(user.roomId, chatMessage);
  }

  handleTyping(socket, message, user, roomId) {
    this.broadcastToRoom(
      roomId,
      {
        type: 'typing',
        user: { id: user.id, email: user.email },
        isTyping: message.isTyping,
      },
      socket
    );
  }

  handlePrivateMessage(socket, message, user) {
    const targetUserId = message.targetUserId;
    const targetSocket = this.findUserSocket(targetUserId);

    if (targetSocket) {
      targetSocket.send(
        JSON.stringify({
          type: 'private-message',
          text: message.text,
          from: { id: user.id, email: user.email },
          timestamp: new Date().toISOString(),
        })
      );

      // Send confirmation to sender
      socket.send(
        JSON.stringify({
          type: 'private-message-sent',
          to: targetUserId,
          text: message.text,
        })
      );
    } else {
      this.sendError(socket, 'User not found or offline');
    }
  }

  findUserSocket(userId) {
    for (const [socket, user] of this.users) {
      if (user.id === userId) {
        return socket;
      }
    }
    return null;
  }

  broadcastToRoom(roomId, message, excludeSocket = null) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const messageStr = JSON.stringify(message);

    room.users.forEach((user, socket) => {
      if (socket !== excludeSocket && socket.readyState === socket.OPEN) {
        socket.send(messageStr);
      }
    });
  }

  sendError(socket, message) {
    socket.send(
      JSON.stringify({
        type: 'error',
        message,
      })
    );
  }

  handleDisconnect(socket) {
    const user = this.users.get(socket);
    if (!user) return;

    const roomId = user.roomId;
    const room = this.rooms.get(roomId);

    if (room) {
      room.users.delete(socket);

      // Notify others
      this.broadcastToRoom(roomId, {
        type: 'user-left',
        user: { id: user.id, email: user.email },
        userCount: room.users.size,
      });

      // Clean up empty rooms
      if (room.users.size === 0) {
        this.rooms.delete(roomId);
      }
    }

    this.users.delete(socket);
  }
}

const chatServer = new ChatServer();

app.ws('/chat/:roomId', (socket, req) => {
  if (!authenticateWebSocket(req, socket)) return;
  chatServer.handleConnection(socket, req);
});
```

### Live Updates & Notifications

```typescript
// Live updates system
class LiveUpdates {
  constructor() {
    this.subscribers = new Map();
  }

  subscribe(channel, socket) {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
    }

    this.subscribers.get(channel).add(socket);
    socket.channels = socket.channels || new Set();
    socket.channels.add(channel);

    console.log(`Socket subscribed to ${channel}`);
  }

  unsubscribe(channel, socket) {
    const channelSockets = this.subscribers.get(channel);
    if (channelSockets) {
      channelSockets.delete(socket);

      if (channelSockets.size === 0) {
        this.subscribers.delete(channel);
      }
    }

    if (socket.channels) {
      socket.channels.delete(channel);
    }
  }

  publish(channel, data) {
    const channelSockets = this.subscribers.get(channel);
    if (!channelSockets) return;

    const message = JSON.stringify({
      type: 'update',
      channel,
      data,
      timestamp: new Date().toISOString(),
    });

    channelSockets.forEach((socket) => {
      if (socket.readyState === socket.OPEN) {
        socket.send(message);
      }
    });

    console.log(`Published to ${channel}: ${channelSockets.size} subscribers`);
  }

  cleanupSocket(socket) {
    if (socket.channels) {
      socket.channels.forEach((channel) => {
        this.unsubscribe(channel, socket);
      });
    }
  }
}

const liveUpdates = new LiveUpdates();

// Live updates WebSocket
app.ws('/live', (socket, req) => {
  if (!authenticateWebSocket(req, socket)) return;

  socket.on('message', (data) => {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'subscribe':
          liveUpdates.subscribe(message.channel, socket);
          socket.send(
            JSON.stringify({
              type: 'subscribed',
              channel: message.channel,
            })
          );
          break;

        case 'unsubscribe':
          liveUpdates.unsubscribe(message.channel, socket);
          socket.send(
            JSON.stringify({
              type: 'unsubscribed',
              channel: message.channel,
            })
          );
          break;

        default:
          socket.send(
            JSON.stringify({
              type: 'error',
              message: 'Unknown message type',
            })
          );
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

  socket.on('close', () => {
    liveUpdates.cleanupSocket(socket);
  });
});

// Trigger live updates from API endpoints
app.post('/api/posts', authenticate, (req, res) => {
  // Create post logic...
  const newPost = createPost(req.body);

  // Notify subscribers
  liveUpdates.publish('posts', {
    type: 'new-post',
    post: newPost,
  });

  res.json({ success: true, post: newPost });
});

app.put('/api/posts/:id', authenticate, (req, res) => {
  // Update post logic...
  const updatedPost = updatePost(req.params.id, req.body);

  // Notify subscribers
  liveUpdates.publish('posts', {
    type: 'post-updated',
    post: updatedPost,
  });

  liveUpdates.publish(`post-${req.params.id}`, {
    type: 'updated',
    post: updatedPost,
  });

  res.json({ success: true, post: updatedPost });
});
```

## Error Handling & Reconnection

```typescript
// WebSocket error handling
app.ws('/robust-chat/:roomId', (socket, req) => {
  const { roomId } = req.params;

  // Connection timeout
  const connectionTimeout = setTimeout(() => {
    socket.close(1000, 'Connection timeout');
  }, 60000); // 60 seconds

  // Ping/Pong for connection health
  const pingInterval = setInterval(() => {
    if (socket.readyState === socket.OPEN) {
      socket.ping();
    }
  }, 30000); // 30 seconds

  socket.on('pong', () => {
    console.log('Pong received, connection healthy');
  });

  // Clear timers on close
  socket.on('close', () => {
    clearTimeout(connectionTimeout);
    clearInterval(pingInterval);
  });

  // Error handling
  socket.on('error', (error) => {
    console.error('WebSocket error:', error);

    // Send error to client before closing
    if (socket.readyState === socket.OPEN) {
      socket.send(
        JSON.stringify({
          type: 'error',
          message: 'Connection error occurred',
          code: error.code,
        })
      );
    }
  });

  // Message validation
  socket.on('message', (data) => {
    try {
      const message = JSON.parse(data);

      // Validate message structure
      if (!message.type || typeof message.type !== 'string') {
        throw new Error('Invalid message type');
      }

      // Rate limiting
      if (!rateLimitMessage(socket)) {
        socket.send(
          JSON.stringify({
            type: 'error',
            message: 'Rate limit exceeded',
          })
        );
        return;
      }

      // Process message...
    } catch (error) {
      socket.send(
        JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
          details: error.message,
        })
      );
    }
  });
});

// Rate limiting for WebSocket messages
function rateLimitMessage(socket) {
  const now = Date.now();
  socket.messageHistory = socket.messageHistory || [];

  // Remove old messages (older than 1 minute)
  socket.messageHistory = socket.messageHistory.filter(
    (time) => now - time < 60000
  );

  // Check rate limit (max 60 messages per minute)
  if (socket.messageHistory.length >= 60) {
    return false;
  }

  socket.messageHistory.push(now);
  return true;
}
```

## Client-Side JavaScript Example

```javascript
// Client-side WebSocket connection
class ChatClient {
  constructor(roomId, token) {
    this.roomId = roomId;
    this.token = token;
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect() {
    const wsUrl = `ws://localhost:3000/chat/${this.roomId}?token=${this.token}`;
    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      console.log('Connected to chat');
      this.reconnectAttempts = 0;
    };

    this.socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.socket.onclose = () => {
      console.log('Disconnected from chat');
      this.attemptReconnect();
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  handleMessage(message) {
    switch (message.type) {
      case 'chat-message':
        this.displayMessage(message);
        break;
      case 'user-joined':
        this.displayNotification(`${message.user.email} joined`);
        break;
      case 'user-left':
        this.displayNotification(`User left`);
        break;
      case 'error':
        this.displayError(message.message);
        break;
    }
  }

  sendMessage(text) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: 'chat',
          text: text,
        })
      );
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(
        `Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
      );

      setTimeout(() => {
        this.connect();
      }, 1000 * this.reconnectAttempts); // Exponential backoff
    }
  }

  displayMessage(message) {
    // Implement your UI logic
    console.log(`${message.user.email}: ${message.text}`);
  }

  displayNotification(text) {
    console.log(`Notification: ${text}`);
  }

  displayError(error) {
    console.error(`Error: ${error}`);
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
    }
  }
}

// Usage
const chatClient = new ChatClient('room123', 'your-jwt-token');
chatClient.connect();

// Send message
document.getElementById('sendButton').onclick = () => {
  const input = document.getElementById('messageInput');
  chatClient.sendMessage(input.value);
  input.value = '';
};
```

## Testing WebSocket

```typescript
// Test WebSocket functionality
import WebSocket from 'ws';
import { createApp } from 'nextrush';

describe('WebSocket', () => {
  let app, server;

  beforeEach(() => {
    app = createApp();

    app.ws('/test', (socket) => {
      socket.send('welcome');
      socket.on('message', (data) => {
        socket.send(`echo: ${data}`);
      });
    });

    server = app.listen(0); // Random port
  });

  afterEach(() => {
    server.close();
  });

  test('WebSocket connection and messaging', (done) => {
    const port = server.address().port;
    const ws = new WebSocket(`ws://localhost:${port}/test`);

    ws.on('open', () => {
      ws.send('hello');
    });

    let messageCount = 0;
    ws.on('message', (data) => {
      messageCount++;

      if (messageCount === 1) {
        expect(data.toString()).toBe('welcome');
      } else if (messageCount === 2) {
        expect(data.toString()).toBe('echo: hello');
        ws.close();
        done();
      }
    });
  });
});
```
