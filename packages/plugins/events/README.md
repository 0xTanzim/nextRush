# @nextrush/events

Type-safe event emitter for NextRush v3 - simple, fast, and async-ready.

## Features

- 🎯 **Full TypeScript Support** - Typed events with autocomplete
- ⚡ **Async-Ready** - Native async/await support
- 🛡️ **Error Isolation** - One handler error won't crash others
- 🎭 **Wildcard Events** - Subscribe to `*` or `user:*` patterns
- 🔌 **Plugin Integration** - Direct `app.events` access
- 📦 **Zero Dependencies** - Lightweight and fast
- ⚠️ **Memory Leak Warnings** - Alerts for potential leaks

## Installation

```bash
# npm
npm install @nextrush/events

# pnpm
pnpm add @nextrush/events

# yarn
yarn add @nextrush/events
```

## Quick Start

### Primary Usage (with NextRush)

```typescript
import { createApp } from '@nextrush/core';
import { eventsPlugin } from '@nextrush/events';

const app = createApp();
app.plugin(eventsPlugin());

// Direct access via app.events - clean DX!
app.events.emit('user:created', { id: '1', name: 'Alice' });
app.events.on('user:created', (data) => {
  console.log('User created:', data);
});
```

### Standalone Usage (testing/libraries)

```typescript
import { createEvents } from '@nextrush/events';

// For testing or library use
const events = createEvents();

events.on('user:created', (data) => {
  console.log(data);
});

await events.emit('user:created', { id: '1', name: 'Alice' });
```

## Typed Events (Recommended)

```typescript
import { createApp } from '@nextrush/core';
import { eventsPlugin } from '@nextrush/events';

// 1. Define your event types
interface AppEvents {
  'user:created': { id: string; name: string };
  'user:deleted': { id: string };
  'order:placed': { orderId: string; total: number };
  [key: string]: unknown; // Required for EventMap compatibility
}

// 2. Augment the Application type (optional but recommended)
declare module '@nextrush/core' {
  interface Application {
    events: import('@nextrush/events').EventEmitter<AppEvents>;
  }
}

// 3. Use typed plugin
const app = createApp();
app.plugin(eventsPlugin<AppEvents>());

// Now fully typed!
app.events.emit('user:created', { id: '1', name: 'Alice' }); // ✅ Type-checked
app.events.on('user:deleted', ({ id }) => console.log(id));  // ✅ Auto-complete
```

## API Reference

### `eventsPlugin<T>(options?)` - **Primary**

Create a NextRush plugin that attaches `app.events`.

```typescript
const app = createApp();
app.plugin(eventsPlugin({
  maxListeners: 10,      // Warn if exceeded (0 = disable)
  errorIsolation: true,  // Isolate handler errors (default)
  onError: (err, event) => console.error(err)
}));

// Now use app.events directly
app.events.emit('user:created', { id: '1' });
```

### `createEvents<T>(options?)` - **Standalone**

Create a standalone event emitter (for testing or non-NextRush use).

```typescript
const events = createEvents<MyEvents>({
  maxListeners: 10,
  errorIsolation: true
});
```

### Event Emitter Methods

#### `on(event, handler)`

Subscribe to an event. Returns an unsubscribe function.

```typescript
const unsubscribe = app.events.on('user:created', (data) => {
  console.log('User created:', data);
});

// Later: unsubscribe
unsubscribe();
```

#### `once(event, handler)`

Subscribe once - auto-unsubscribes after first emit.

```typescript
app.events.once('app:ready', () => {
  console.log('App started!');
});
```

#### `off(event, handler)`

Remove a specific handler.

```typescript
const handler = (data) => console.log(data);
app.events.on('user:created', handler);

// Later: remove
app.events.off('user:created', handler);
```

#### `emit(event, data)`

Emit an event. Returns a Promise that resolves when all handlers complete.

```typescript
await app.events.emit('user:created', { id: '1', name: 'Alice' });
```

#### `listenerCount(event?)`

Get the number of listeners.

```typescript
app.events.listenerCount('user:created'); // Specific event
app.events.listenerCount();               // Total
```

#### `clear(event?)`

Remove all listeners.

```typescript
app.events.clear('user:created'); // Clear specific event
app.events.clear();               // Clear all
```

## Wildcard Events

### All Events (`*`)

```typescript
app.events.on('*', ({ event, data }) => {
  console.log(`Event: ${event}`, data);
});
```

### Pattern Matching (`prefix:*`)

```typescript
// Subscribe to all user events
app.events.on('user:*', ({ event, data }) => {
  console.log(`User event: ${event}`, data);
});

app.events.emit('user:created', data); // ✅ Matches
app.events.emit('user:deleted', data); // ✅ Matches
app.events.emit('order:placed', data); // ❌ No match
```

## Error Handling

### Error Isolation (Default)

Errors in one handler won't affect others:

```typescript
app.events.on('user:created', () => {
  throw new Error('Handler 1 error');
});

app.events.on('user:created', (data) => {
  console.log('Handler 2 still runs!'); // ✅ Executes
});
```

### Custom Error Handler

```typescript
app.plugin(eventsPlugin({
  onError: (error, eventName) => {
    logger.error(`Handler error for ${eventName}:`, error);
  }
}));
```

## Use in Middleware

```typescript
app.use(async (ctx) => {
  // Emit events from middleware
  await app.events.emit('request:received', {
    method: ctx.method,
    path: ctx.path
  });

  await ctx.next();

  await app.events.emit('request:completed', {
    method: ctx.method,
    path: ctx.path,
    status: ctx.status
  });
});
```

## Organize Event Handlers

```typescript
// events/user.events.ts
export function registerUserEvents(events) {
  events.on('user:created', sendWelcomeEmail);
  events.on('user:deleted', cleanupUserData);
  events.on('user:*', logUserEvent);
}

// main.ts
import { registerUserEvents } from './events/user.events';

registerUserEvents(app.events);
```

## Comparison: v2 vs v3

| Feature | v2 Events | v3 Events |
|---------|-----------|-----------|
| API | Complex (CQRS) | Simple (on/off/emit) |
| Size | ~800 LOC | ~200 LOC |
| Access | `emitter.subscribe()` | `app.events.on()` |
| Pipelines | Built-in | Use middleware |
| Retry | Built-in | DIY (simple) |

v3 follows Unix philosophy: **do one thing well**.

## License

MIT
