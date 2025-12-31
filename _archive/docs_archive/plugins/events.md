# Event Emitter

> Type-safe, async-ready event system for decoupled application architecture.

## The Problem

Applications need components to communicate without tight coupling. Database changes need to trigger notifications. User actions need to update caches. Services need to react to state changes.

```typescript
// This creates tight coupling. Don't do this.
async function createUser(data: UserData) {
  const user = await db.users.create(data);

  // Every new requirement adds more code here
  await sendWelcomeEmail(user);
  await updateUserCache(user);
  await notifyAdmins(user);
  await logAnalytics('user_created', user);
  await syncToExternalSystem(user);
  // ... grows forever

  return user;
}
```

This approach creates problems:

- **Tight coupling**: `createUser` knows about emails, caches, analytics, and external systems
- **Single responsibility violation**: One function does everything
- **Testing nightmare**: Must mock all dependencies for every test
- **Deployment risk**: Email bug breaks user creation
- **Scaling issues**: All operations run sequentially

## Why NextRush Events Exists

Events provide a publish/subscribe pattern that decouples producers from consumers:

```typescript
// Producer only knows about events
async function createUser(data: UserData) {
  const user = await db.users.create(data);
  await app.events.emit('user:created', user);
  return user;
}

// Consumers register independently
app.events.on('user:created', sendWelcomeEmail);
app.events.on('user:created', updateUserCache);
app.events.on('user:created', notifyAdmins);
```

Benefits:

- **Loose coupling**: Producer doesn't know consumers exist
- **Single responsibility**: Each handler does one thing
- **Independent testing**: Test producer and consumers separately
- **Fault isolation**: One handler error doesn't break others
- **Easy extension**: Add handlers without modifying producers

## Mental Model

Think of events as a **message board** in your application:

```
Producer                    EventEmitter                   Consumers
────────                    ────────────                   ─────────
                           ┌───────────────┐
createUser() ─────────────►│ user:created  │─────┬──────► sendWelcomeEmail()
                           │               │     │
                           │               │     ├──────► updateUserCache()
                           │               │     │
                           │               │     └──────► logAnalytics()
                           └───────────────┘
```

The producer posts a message (emits an event), and all subscribed consumers receive it independently. The producer doesn't wait for—or even know about—the consumers.

## Basic Usage

```typescript
import { createApp } from '@nextrush/core';
import { eventsPlugin } from '@nextrush/events';

const app = createApp();
app.plugin(eventsPlugin());

// Subscribe to events
app.events.on('user:created', (user) => {
  console.log('User created:', user.name);
});

// Emit events
await app.events.emit('user:created', { id: '1', name: 'Alice' });
```

**What this does:**

1. Creates an event emitter attached to `app.events`
2. Registers a handler for `user:created` events
3. Emits an event, triggering all registered handlers
4. Waits for all handlers to complete (async-ready)

## What Happens Behind the Scenes

When you emit an event, here's the complete flow:

### 1. Event Validation

```
Input: emit('user:created', data)

Steps:
1. Validate event name is a non-empty string
2. Validate event name is ≤256 characters
3. If invalid → TypeError thrown immediately
```

### 2. Handler Collection

```
Event: 'user:created'

Steps:
1. Get exact match handlers for 'user:created'
2. Get pattern match handlers for 'user:*'
3. Get wildcard handlers for '*'
4. Combine all handlers in registration order
```

### 3. Once Handler Processing

```
Before execution:
1. Identify handlers marked as 'once'
2. Remove them from registry BEFORE execution
3. This prevents race conditions with concurrent emits
```

### 4. Handler Execution

```
With errorIsolation=true (default):
1. Execute all handlers with Promise.allSettled()
2. Collect errors separately
3. Call onError callback for each error
4. Other handlers continue regardless of errors

With errorIsolation=false:
1. Execute all handlers with Promise.allSettled()
2. Collect all errors
3. After all complete, throw AggregateError if any failed
```

### 5. Cleanup

```
After execution:
1. All handlers have completed (success or error)
2. Once handlers already removed
3. Promise resolves
```

## Type-Safe Events

For full TypeScript support, define your event types:

```typescript
import { createApp } from '@nextrush/core';
import { eventsPlugin, EventEmitter } from '@nextrush/events';

// 1. Define your event map
interface AppEvents {
  'user:created': { id: string; name: string; email: string };
  'user:deleted': { id: string };
  'order:placed': { orderId: string; total: number; userId: string };
  'payment:received': { paymentId: string; amount: number };
  [key: string]: unknown; // Required for EventMap compatibility
}

// 2. Augment the Application type (optional but recommended)
declare module '@nextrush/core' {
  interface Application {
    events: EventEmitter<AppEvents>;
  }
}

// 3. Create app with typed events
const app = createApp();
app.plugin(eventsPlugin<AppEvents>());

// Now fully typed!
app.events.emit('user:created', {
  id: '1',
  name: 'Alice',
  email: 'alice@example.com'
}); // ✅ Type-checked

app.events.on('order:placed', ({ orderId, total, userId }) => {
  // orderId: string, total: number, userId: string
  console.log(`Order ${orderId} for $${total} from user ${userId}`);
}); // ✅ Auto-complete
```

## Configuration Options

### Basic Options

```typescript
app.plugin(eventsPlugin({
  maxListeners: 10,       // Warn if exceeded (0 = disable)
  errorIsolation: true,   // Isolate handler errors (default)
  onError: (err, event) => console.error(err),
  propertyName: 'events', // Property name on app (default)
}));
```

### Option Details

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxListeners` | `number` | `10` | Warning threshold for listener count. Set to 0 to disable. |
| `errorIsolation` | `boolean` | `true` | When true, errors in one handler don't affect others. |
| `onError` | `Function` | Console log | Called when a handler throws. |
| `propertyName` | `string` | `'events'` | Property name to attach to app object. |

### Standalone Usage

For testing or use outside NextRush:

```typescript
import { createEvents } from '@nextrush/events';

const events = createEvents<AppEvents>({
  maxListeners: 20,
  errorIsolation: true,
});

events.on('user:created', (user) => console.log(user));
await events.emit('user:created', { id: '1', name: 'Alice' });
```

## API Reference

### Core Methods

#### `on(event, handler)`

Subscribe to an event. Returns an unsubscribe function.

```typescript
const unsubscribe = app.events.on('user:created', (user) => {
  console.log('User created:', user.name);
});

// Later: unsubscribe
unsubscribe();
```

#### `once(event, handler)`

Subscribe once—handler auto-unsubscribes after first invocation.

```typescript
app.events.once('app:ready', () => {
  console.log('App started! (only logged once)');
});
```

**Race condition safety:** The handler is removed synchronously before execution, preventing duplicate calls with concurrent emits.

#### `off(event, handler)`

Remove a specific handler.

```typescript
const handler = (user) => console.log(user);
app.events.on('user:created', handler);

// Later: remove
app.events.off('user:created', handler);
```

#### `emit(event, data)`

Emit an event. Returns a Promise that resolves when all handlers complete.

```typescript
await app.events.emit('user:created', { id: '1', name: 'Alice' });
```

### Inspection Methods

#### `listenerCount(event?)`

Get the number of listeners.

```typescript
app.events.listenerCount('user:created'); // Specific event: 3
app.events.listenerCount();               // Total all events: 15
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
  await app.events.emit('user:created', user);
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

### Handler Ordering

#### `prepend(event, handler)`

Add a handler at the beginning of the handler list.

```typescript
// Security handler runs first
app.events.prepend('user:created', (user) => {
  if (!user.id) throw new Error('Invalid user');
});

// Regular handler runs after
app.events.on('user:created', (user) => {
  console.log('User valid:', user.name);
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

### Configuration Methods

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

#### `clear(event?)`

Remove all listeners.

```typescript
app.events.clear('user:created'); // Clear specific event
app.events.clear();               // Clear all
```

## Wildcard Events

### Global Wildcard (`*`)

Subscribe to all events:

```typescript
app.events.on('*', ({ event, data }) => {
  console.log(`Event: ${event}`, data);
});

// Logs all events
app.events.emit('user:created', { id: '1' }); // Event: user:created { id: '1' }
app.events.emit('order:placed', { id: '2' }); // Event: order:placed { id: '2' }
```

### Prefix Pattern (`prefix:*`)

Subscribe to events matching a prefix:

```typescript
// Subscribe to all user events
app.events.on('user:*', ({ event, data }) => {
  console.log(`User event: ${event}`, data);
});

app.events.emit('user:created', data); // ✅ Matches
app.events.emit('user:deleted', data); // ✅ Matches
app.events.emit('user:updated', data); // ✅ Matches
app.events.emit('order:placed', data); // ❌ No match
```

### Pattern Matching Rules

| Pattern | Matches | Doesn't Match |
|---------|---------|---------------|
| `*` | All events | - |
| `user:*` | `user:created`, `user:deleted` | `users:created`, `order:placed` |
| `system:*` | `system:start`, `system:stop` | `systems:error`, `user:system` |

## Error Handling

### Default Behavior (Error Isolation)

Errors in one handler don't affect others:

```typescript
app.events.on('user:created', () => {
  throw new Error('Handler 1 error');
});

app.events.on('user:created', (user) => {
  console.log('Handler 2 still runs!'); // ✅ Executes
});

app.events.on('user:created', (user) => {
  console.log('Handler 3 also runs!'); // ✅ Executes
});

await app.events.emit('user:created', user);
// All handlers run, error is logged but doesn't propagate
```

### Custom Error Handler

```typescript
app.plugin(eventsPlugin({
  onError: (error, eventName) => {
    logger.error(`Handler error for ${eventName}:`, error);
    metrics.increment('event_handler_error', { event: eventName });
  }
}));
```

### Strict Mode (AggregateError)

When you need to know if any handlers failed:

```typescript
const events = createEvents({ errorIsolation: false });

events.on('important', () => { throw new Error('Error 1'); });
events.on('important', () => { throw new Error('Error 2'); });
events.on('important', () => console.log('Still runs!')); // ✅ Executes

try {
  await events.emit('important', {});
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

// Must be a non-empty string
events.emit('', data);     // ❌ Throws TypeError
events.emit(123, data);    // ❌ Throws TypeError
events.emit(null, data);   // ❌ Throws TypeError
```

### Race-Safe Once Handlers

Once handlers are removed synchronously before execution, preventing race conditions:

```typescript
events.once('init', () => {
  console.log('Runs exactly once');
});

// Safe even with concurrent emits
await Promise.all([
  events.emit('init', {}),
  events.emit('init', {}),
  events.emit('init', {}),
]);
// Output: "Runs exactly once" (not three times)
```

### Plugin Property Name Validation

The plugin validates the property name to prevent prototype pollution:

```typescript
// ✅ Valid property names
app.plugin(eventsPlugin());                        // Default: 'events'
app.plugin(eventsPlugin({ propertyName: 'bus' }));
app.plugin(eventsPlugin({ propertyName: '$events' }));
app.plugin(eventsPlugin({ propertyName: '_events' }));

// ❌ Invalid property names throw TypeError
app.plugin(eventsPlugin({ propertyName: '' }));      // Empty
app.plugin(eventsPlugin({ propertyName: '123abc' })); // Starts with number
app.plugin(eventsPlugin({ propertyName: 'has-dash' })); // Contains dash
```

## Common Patterns

### Organizing Event Handlers

Separate handlers by domain:

```typescript
// events/user.events.ts
export function registerUserEvents(events: EventEmitter<AppEvents>) {
  events.on('user:created', sendWelcomeEmail);
  events.on('user:created', createUserProfile);
  events.on('user:deleted', cleanupUserData);
  events.on('user:*', logUserEvent);
}

// events/order.events.ts
export function registerOrderEvents(events: EventEmitter<AppEvents>) {
  events.on('order:placed', processPayment);
  events.on('order:placed', updateInventory);
  events.on('order:shipped', sendShippingNotification);
}

// main.ts
import { registerUserEvents } from './events/user.events';
import { registerOrderEvents } from './events/order.events';

const app = createApp();
app.plugin(eventsPlugin<AppEvents>());

registerUserEvents(app.events);
registerOrderEvents(app.events);
```

### Events in Middleware

Emit events from request handlers:

```typescript
app.use(async (ctx) => {
  // Emit request events
  await app.events.emit('request:received', {
    method: ctx.method,
    path: ctx.path,
    timestamp: Date.now(),
  });

  await ctx.next();

  await app.events.emit('request:completed', {
    method: ctx.method,
    path: ctx.path,
    status: ctx.status,
    duration: Date.now() - ctx.state.startTime,
  });
});
```

### Request-Scoped Events

Create events per request for isolation:

```typescript
import { createEvents } from '@nextrush/events';

app.use(async (ctx) => {
  // Each request gets its own event emitter
  ctx.state.events = createEvents();

  // Register request-specific handlers
  ctx.state.events.on('validation:failed', (errors) => {
    ctx.status = 400;
    ctx.json({ errors });
  });

  await ctx.next();
});
```

### Audit Logging

Log all events for debugging or compliance:

```typescript
// Development: log all events
if (process.env.NODE_ENV !== 'production') {
  app.events.on('*', ({ event, data }) => {
    console.log(`[EVENT] ${event}`, JSON.stringify(data, null, 2));
  });
}

// Production: structured logging
app.events.on('*', ({ event, data }) => {
  logger.info({
    type: 'event',
    event,
    data,
    timestamp: new Date().toISOString(),
  });
});
```

### Retry Failed Handlers

Implement retry logic for critical events:

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, delay * (i + 1)));
    }
  }
  throw new Error('Unreachable');
}

app.events.on('payment:received', async (payment) => {
  await withRetry(() => processPayment(payment), 3, 1000);
});
```

## TypeScript Type Helper

The `WithEvents<T>` type helper makes it easy to type functions:

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

## Runtime Compatibility

This package uses no Node.js-specific APIs:

| Runtime | Version | Support | Notes |
|---------|---------|---------|-------|
| Node.js | 20+ | ✅ Full | Primary target |
| Bun | 1.0+ | ✅ Full | Native ES modules |
| Deno | 1.37+ | ✅ Full | Via npm: specifier |
| Cloudflare Workers | - | ✅ Full | Edge-compatible |
| Vercel Edge | - | ✅ Full | Edge-compatible |

**APIs used:** `Map`, `Set`, `Promise`, `console`, `AggregateError` (all standard JavaScript)

## Common Mistakes

### Mistake: Forgetting await on emit

```typescript
// ❌ Handlers may not complete before function returns
function createUser(data) {
  const user = db.users.create(data);
  app.events.emit('user:created', user); // No await!
  return user;
}

// ✅ Wait for all handlers
async function createUser(data) {
  const user = await db.users.create(data);
  await app.events.emit('user:created', user);
  return user;
}
```

### Mistake: Not unsubscribing in cleanup

```typescript
// ❌ Memory leak in request handlers
app.use(async (ctx) => {
  app.events.on('update', () => {
    // This handler persists after request ends
  });
});

// ✅ Unsubscribe when done
app.use(async (ctx) => {
  const unsubscribe = app.events.on('update', () => {
    // Handle update
  });

  await ctx.next();

  unsubscribe(); // Clean up
});
```

### Mistake: Assuming handler order

```typescript
// ❌ Don't assume which handler runs first
app.events.on('user:created', (user) => {
  user.processed = true; // Modifies shared object
});

app.events.on('user:created', (user) => {
  if (user.processed) { /* ... */ } // May or may not be true
});

// ✅ Use prepend for ordering, or don't share mutable state
app.events.prepend('user:created', validate);
app.events.on('user:created', process);
```

### Mistake: Too many listeners without reason

```typescript
// ❌ Creates new listener on every request
app.use(async (ctx) => {
  app.events.on('update', handleUpdate);
  await ctx.next();
});

// ✅ Register once at startup
app.events.on('update', handleUpdate);

app.use(async (ctx) => {
  await ctx.next();
});
```

## When NOT to Use Events

### Don't use for synchronous flow control

```typescript
// ❌ Events for sequential operations
await events.emit('step1', data);
await events.emit('step2', data);
await events.emit('step3', data);

// ✅ Use direct function calls
await step1(data);
await step2(data);
await step3(data);
```

### Don't use for request-response patterns

```typescript
// ❌ Events for getting data back
events.on('get:user', (id, respond) => {
  respond(db.users.findById(id));
});

// ✅ Use direct function calls
const user = await db.users.findById(id);
```

### Don't use for tightly-coupled operations

```typescript
// ❌ If operation B must always follow A
await events.emit('create:user', user);
// If profile creation is required, don't use events

// ✅ Make it explicit in the function
async function createUser(data) {
  const user = await db.users.create(data);
  await createProfile(user); // Required, so call directly
  await events.emit('user:created', user); // Optional reactions
  return user;
}
```

## Next Steps

- Learn about [Middleware](/concepts/middleware) to understand request/response flow
- See [Plugins](/concepts/plugins) for creating your own plugins
- Read [Testing Guide](/guides/testing) for testing event-driven code
