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
- 🔒 **Security Hardened** - Input validation, race-safe handlers
- 🌐 **Universal Runtime** - Node.js, Bun, Deno, edge runtimes

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

#### `listeners(event)`

Get an array of handlers for an event. Returns a copy (safe to iterate).

```typescript
const handlers = app.events.listeners('user:created');
console.log(`${handlers.length} handlers registered`);
```

#### `hasListeners(event?)`

Check if listeners exist without getting the full list.

```typescript
if (app.events.hasListeners('user:created')) {
  await app.events.emit('user:created', data);
}

// Check if any listeners exist
if (app.events.hasListeners()) {
  console.log('Event system is active');
}
```

#### `eventNames()`

Get all registered event names.

```typescript
const events = app.events.eventNames();
// ['user:created', 'user:deleted', 'order:placed']
```

#### `prepend(event, handler)`

Add a handler at the beginning of the handler list.

```typescript
// Security handler runs first
app.events.prepend('user:created', (data) => {
  validateUserData(data);
});
```

#### `prependOnce(event, handler)`

Add a one-time handler at the beginning of the handler list.

```typescript
// Run initialization before other handlers, once
app.events.prependOnce('app:ready', () => {
  console.log('First handler to run on app:ready');
});
```

#### `setMaxListeners(n)`

Configure max listeners at runtime.

```typescript
app.events.setMaxListeners(20); // Allow more listeners
app.events.setMaxListeners(0);  // Disable warning
```

#### `getMaxListeners()`

Get the current max listeners setting.

```typescript
const max = app.events.getMaxListeners();
console.log(`Max listeners: ${max}`);
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

### Strict Mode (AggregateError)

With `errorIsolation: false`, all handlers run but errors are collected and thrown as an `AggregateError`:

```typescript
const events = createEvents({ errorIsolation: false });

events.on('test', () => { throw new Error('Error 1'); });
events.on('test', () => { throw new Error('Error 2'); });
events.on('test', () => console.log('Still runs!')); // ✅ Executes

try {
  await events.emit('test', {});
} catch (error) {
  if (error instanceof AggregateError) {
    console.log(`${error.errors.length} handlers failed`);
    for (const e of error.errors) {
      console.error(e.message);
    }
  }
}
```

## Security Features

### Event Name Validation

Event names are validated to prevent abuse:

```typescript
// Maximum length: 256 characters
events.emit('a'.repeat(257), data); // ❌ Throws TypeError

// Must be a string
events.emit(123, data);     // ❌ Throws TypeError
events.emit(null, data);    // ❌ Throws TypeError

// Empty strings are invalid
events.emit('', data);      // ❌ Throws TypeError
```

### Race-Safe Once Handlers

Once handlers are removed synchronously before execution, preventing race conditions:

```typescript
// Safe: handler runs exactly once even with concurrent emits
events.once('init', () => {
  console.log('Only runs once');
});

// Concurrent emits are safe
await Promise.all([
  events.emit('init', {}),
  events.emit('init', {}),
  events.emit('init', {}),
]);
// Output: "Only runs once" (exactly once)
```

### Plugin Property Name Validation

The plugin validates the property name to prevent prototype pollution:

```typescript
// ✅ Valid property names
app.plugin(eventsPlugin());                        // Default: 'events'
app.plugin(eventsPlugin({ propertyName: 'bus' }));
app.plugin(eventsPlugin({ propertyName: '$events' }));

// ❌ Invalid property names throw
app.plugin(eventsPlugin({ propertyName: '' }));
app.plugin(eventsPlugin({ propertyName: '123abc' }));
app.plugin(eventsPlugin({ propertyName: 'has-dash' }));
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

## Type Helper: WithEvents<T>

The `WithEvents<T>` type helper makes it easy to type functions that accept an app with events:

```typescript
import type { WithEvents } from '@nextrush/events';

interface MyEvents {
  'user:created': { id: string };
  'user:deleted': { id: string };
}

// Use in function signatures
function setupUserRoutes(app: WithEvents<MyEvents>) {
  app.events.emit('user:created', { id: '1' }); // ✅ Typed
}

// Combine with other app properties
function initApp(app: Application & WithEvents<MyEvents>) {
  app.use((ctx) => { /* ... */ });
  app.events.on('user:created', (data) => console.log(data));
}
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

## Runtime Compatibility

| Runtime | Version | Support | Notes |
|---------|---------|---------|-------|
| Node.js | 20+ | ✅ Full | Primary target |
| Bun | 1.0+ | ✅ Full | Native ES modules |
| Deno | 1.37+ | ✅ Full | Via npm: specifier |
| Cloudflare Workers | - | ✅ Full | Edge-compatible |
| Vercel Edge | - | ✅ Full | Edge-compatible |

**Zero Node.js-specific APIs**: Uses only `Map`, `Set`, `Promise`, `console`, and `AggregateError`.

## Constants

The package exports validation constants for advanced use cases:

```typescript
import { MAX_EVENT_NAME_LENGTH, VALID_PROPERTY_NAME } from '@nextrush/events';

console.log(MAX_EVENT_NAME_LENGTH); // 256
console.log(VALID_PROPERTY_NAME);   // /^[a-zA-Z_$][a-zA-Z0-9_$]*$/
```

## License

MIT
