# Event System API Reference

NextRush v2 features a powerful event-driven architecture that enables loose coupling, extensibility, and reactive programming patterns throughout your application.

## What it is

The Event System is a type-safe, high-performance event emitter that allows components to communicate through events without direct dependencies. It supports async/await patterns, error handling, and middleware-like event processing.

## When to use

Use the Event System for:

- Decoupling business logic from HTTP handlers
- Background task processing
- Real-time notifications and webhooks
- Plugin communication and extensibility
- Audit logging and analytics
- Cache invalidation and data synchronization
- Workflow orchestration

## TypeScript signature

```typescript
interface EventSystem {
  // Event emission
  emit<T = any>(event: string, data: T): Promise<void>;
  emitSync<T = any>(event: string, data: T): void;

  // Event listening
  on<T = any>(event: string, handler: EventHandler<T>): void;
  once<T = any>(event: string, handler: EventHandler<T>): void;
  off(event: string, handler?: EventHandler): void;

  // Event middleware
  use(middleware: EventMiddleware): void;

  // Lifecycle
  start(): Promise<void>;
  stop(): Promise<void>;
}

type EventHandler<T = any> = (
  data: T,
  context: EventContext
) => Promise<void> | void;
type EventMiddleware = (
  event: string,
  data: any,
  context: EventContext,
  next: () => Promise<void>
) => Promise<void>;
```

---

# 🎯 Core Event Operations

## emit() - Async event emission

**What it is**: Emits an event asynchronously, waiting for all handlers to complete.

**When to use**: When you need to ensure all event handlers complete before continuing.

**Signature**:

```typescript
emit<T = any>(event: string, data: T): Promise<void>
```

**Example**:

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// User registration handler
app.post('/auth/register', async ctx => {
  const userData = ctx.body as RegisterData;

  try {
    // Create user in database
    const user = await db.user.create(userData);

    // Emit user registration event
    await app.events.emit('user.registered', {
      userId: user.id,
      email: user.email,
      registeredAt: new Date(),
      source: 'web',
    });

    ctx.json({ user }, 201);
  } catch (error) {
    ctx.res.status(500).json({ error: 'Registration failed' });
  }
});

// Event handlers for user registration
app.events.on('user.registered', async data => {
  // Send welcome email
  await emailService.sendWelcomeEmail(data.email, data.userId);
});

app.events.on('user.registered', async data => {
  // Create user profile
  await profileService.createDefaultProfile(data.userId);
});

app.events.on('user.registered', async data => {
  // Track analytics
  await analytics.track('User Registered', {
    userId: data.userId,
    source: data.source,
    timestamp: data.registeredAt,
  });
});
```

## emitSync() - Synchronous event emission

**What it is**: Emits an event synchronously without waiting for handlers to complete.

**When to use**: Fire-and-forget events, logging, non-critical notifications.

**Signature**:

```typescript
emitSync<T = any>(event: string, data: T): void
```

**Example**:

```typescript
// Quick logging and metrics
app.get('/api/users', async ctx => {
  const startTime = Date.now();

  // Synchronous event for request tracking
  app.events.emitSync('request.started', {
    method: ctx.method,
    path: ctx.path,
    ip: ctx.ip,
    timestamp: new Date(),
  });

  const users = await db.user.findMany();
  const duration = Date.now() - startTime;

  // Synchronous performance tracking
  app.events.emitSync('request.completed', {
    method: ctx.method,
    path: ctx.path,
    duration,
    responseSize: JSON.stringify(users).length,
  });

  ctx.json(users);
});

// Fast handlers for sync events
app.events.on('request.started', data => {
  console.log(`→ ${data.method} ${data.path} from ${data.ip}`);
});

app.events.on('request.completed', data => {
  console.log(`← ${data.method} ${data.path} ${data.duration}ms`);
});
```

---

# 👂 Event Listeners

## on() - Persistent event listener

**What it is**: Registers a handler that responds to every occurrence of an event.

**When to use**: Ongoing event processing, permanent handlers, system monitoring.

**Signature**:

```typescript
on<T = any>(event: string, handler: EventHandler<T>): void
```

**Example**:

```typescript
// Order processing workflow
app.events.on('order.created', async orderData => {
  // Validate inventory
  const available = await inventory.check(orderData.items);
  if (!available) {
    await app.events.emit('order.failed', {
      orderId: orderData.id,
      reason: 'insufficient_inventory',
    });
    return;
  }

  // Reserve inventory
  await inventory.reserve(orderData.items, orderData.id);

  // Process payment
  await app.events.emit('payment.process', {
    orderId: orderData.id,
    amount: orderData.total,
    customerId: orderData.customerId,
  });
});

app.events.on('payment.succeeded', async paymentData => {
  // Fulfill order
  await fulfillment.process(paymentData.orderId);

  // Send confirmation
  await app.events.emit('order.confirmed', {
    orderId: paymentData.orderId,
    confirmedAt: new Date(),
  });
});

app.events.on('payment.failed', async paymentData => {
  // Release inventory
  await inventory.release(paymentData.orderId);

  // Notify customer
  await app.events.emit('order.failed', {
    orderId: paymentData.orderId,
    reason: 'payment_failed',
  });
});

// Usage in order endpoint
app.post('/orders', async ctx => {
  const orderData = ctx.body as CreateOrderData;

  const order = await db.order.create(orderData);

  // Start order processing workflow
  await app.events.emit('order.created', {
    id: order.id,
    customerId: order.customerId,
    items: order.items,
    total: order.total,
    createdAt: order.createdAt,
  });

  ctx.json({ order }, 201);
});
```

## once() - One-time event listener

**What it is**: Registers a handler that responds only to the first occurrence of an event, then removes itself.

**When to use**: Initialization, single-use handlers, conditional logic.

**Signature**:

```typescript
once<T = any>(event: string, handler: EventHandler<T>): void
```

**Example**:

```typescript
// Application initialization sequence
app.events.once('app.ready', async () => {
  console.log('🚀 Application started successfully');

  // Run one-time initialization tasks
  await cache.warmup();
  await scheduler.start();
  await monitoring.initialize();

  console.log('✅ All systems initialized');
});

// Database connection event
app.events.once('database.connected', async () => {
  console.log('📊 Database connected, running migrations...');
  await runMigrations();

  // Emit ready event after database is set up
  await app.events.emit('app.ready', {
    startedAt: new Date(),
    version: process.env.APP_VERSION,
  });
});

// Feature flag initialization
app.events.once('features.loaded', async features => {
  if (features.newUserFlow) {
    // Register handlers for new user flow
    app.events.on('user.registered', newUserOnboardingHandler);
  }

  if (features.advancedAnalytics) {
    // Enable advanced analytics
    app.events.on('*', analyticsHandler);
  }
});

// Server startup
app.listen(3000, async () => {
  await connectDatabase();
  await app.events.emit('database.connected', { timestamp: new Date() });
});
```

## off() - Remove event listener

**What it is**: Removes specific event handlers or all handlers for an event.

**When to use**: Cleanup, feature toggling, memory management, testing.

**Signature**:

```typescript
off(event: string, handler?: EventHandler): void
```

**Example**:

```typescript
// Dynamic feature management
class FeatureManager {
  private handlers = new Map<string, EventHandler[]>();

  enableFeature(featureName: string) {
    switch (featureName) {
      case 'realtime_notifications':
        const notificationHandler = async data => {
          await websocket.broadcast('notification', data);
        };
        app.events.on('notification.created', notificationHandler);
        this.handlers.set('realtime_notifications', [notificationHandler]);
        break;

      case 'audit_logging':
        const auditHandler = async data => {
          await auditLog.record(data);
        };
        app.events.on('user.*', auditHandler);
        app.events.on('order.*', auditHandler);
        this.handlers.set('audit_logging', [auditHandler]);
        break;
    }
  }

  disableFeature(featureName: string) {
    const handlers = this.handlers.get(featureName);
    if (handlers) {
      handlers.forEach(handler => {
        switch (featureName) {
          case 'realtime_notifications':
            app.events.off('notification.created', handler);
            break;
          case 'audit_logging':
            app.events.off('user.*', handler);
            app.events.off('order.*', handler);
            break;
        }
      });
      this.handlers.delete(featureName);
    }
  }
}

// Test cleanup
afterEach(() => {
  // Remove all test handlers
  app.events.off('test.*');

  // Remove specific handler
  app.events.off('user.created', testUserHandler);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  // Stop processing new events
  app.events.off('*');

  // Wait for in-flight events to complete
  await app.events.stop();

  process.exit(0);
});
```

---

# 🔧 Event Middleware

## use() - Event middleware

**What it is**: Registers middleware that processes all events before they reach handlers.

**When to use**: Logging, validation, transformation, rate limiting, security.

**Signature**:

```typescript
use(middleware: EventMiddleware): void
```

**Example**:

```typescript
// Event logging middleware
app.events.use(async (event, data, context, next) => {
  const startTime = Date.now();

  console.log(`📡 Event: ${event}`, {
    timestamp: new Date().toISOString(),
    eventId: context.eventId,
    data: JSON.stringify(data).slice(0, 100) + '...',
  });

  try {
    await next();
    const duration = Date.now() - startTime;
    console.log(`✅ Event completed: ${event} (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Event failed: ${event} (${duration}ms)`, error);
    throw error;
  }
});

// Event validation middleware
app.events.use(async (event, data, context, next) => {
  // Validate event data structure
  if (event.startsWith('user.')) {
    if (!data.userId) {
      throw new Error(`User events must include userId: ${event}`);
    }
  }

  if (event.startsWith('order.')) {
    if (!data.orderId) {
      throw new Error(`Order events must include orderId: ${event}`);
    }
  }

  await next();
});

// Rate limiting middleware
const eventCounts = new Map<string, number>();

app.events.use(async (event, data, context, next) => {
  const key = `${event}:${context.source || 'unknown'}`;
  const count = eventCounts.get(key) || 0;

  if (count > 1000) {
    console.warn(`Rate limit exceeded for event: ${event}`);
    return; // Skip processing
  }

  eventCounts.set(key, count + 1);

  // Reset counts every minute
  setTimeout(() => {
    eventCounts.delete(key);
  }, 60000);

  await next();
});

// Security middleware
app.events.use(async (event, data, context, next) => {
  // Filter sensitive data
  if (data.password) {
    data = { ...data, password: '[REDACTED]' };
  }

  if (data.creditCard) {
    data = { ...data, creditCard: '[REDACTED]' };
  }

  // Add security context
  context.security = {
    filtered: true,
    timestamp: Date.now(),
  };

  await next();
});

// Error handling middleware
app.events.use(async (event, data, context, next) => {
  try {
    await next();
  } catch (error) {
    // Log error with context
    console.error('Event processing error:', {
      event,
      eventId: context.eventId,
      error: error.message,
      stack: error.stack,
      data,
    });

    // Emit error event for monitoring
    await app.events.emitSync('system.error', {
      originalEvent: event,
      error: error.message,
      timestamp: new Date(),
    });

    // Re-throw for proper error handling
    throw error;
  }
});
```

---

# 🔄 Event Patterns

## Wildcards and namespacing

**What it is**: Pattern matching for event names using wildcards and hierarchical naming.

**When to use**: Grouped event handling, category-based listeners, debugging.

**Example**:

```typescript
// Namespace-based event organization
const events = {
  user: {
    registered: 'user.registered',
    updated: 'user.updated',
    deleted: 'user.deleted',
    loginAttempt: 'user.login.attempt',
    loginSuccess: 'user.login.success',
    loginFailure: 'user.login.failure',
  },
  order: {
    created: 'order.created',
    confirmed: 'order.confirmed',
    shipped: 'order.shipped',
    delivered: 'order.delivered',
    cancelled: 'order.cancelled',
  },
  payment: {
    initiated: 'payment.initiated',
    processing: 'payment.processing',
    succeeded: 'payment.succeeded',
    failed: 'payment.failed',
    refunded: 'payment.refunded',
  },
};

// Wildcard listeners
app.events.on('user.*', async (data, context) => {
  // Handle all user events
  await auditLog.record({
    category: 'user',
    event: context.event,
    userId: data.userId,
    timestamp: new Date(),
  });
});

app.events.on('user.login.*', async (data, context) => {
  // Handle all login events
  await securityLog.record({
    event: context.event,
    userId: data.userId,
    ip: data.ip,
    userAgent: data.userAgent,
    success: context.event.endsWith('.success'),
  });
});

app.events.on('*.failed', async (data, context) => {
  // Handle all failure events
  await alerting.sendAlert({
    type: 'failure',
    event: context.event,
    data,
    severity: 'warning',
  });
});

// Multi-level wildcards
app.events.on('**', async (data, context) => {
  // Handle ALL events (use sparingly)
  await metrics.increment(`events.${context.event.replace(/\./g, '_')}`);
});

// Usage with namespaced events
await app.events.emit(events.user.registered, {
  userId: '123',
  email: 'user@example.com',
});

await app.events.emit(events.order.created, {
  orderId: 'order-456',
  userId: '123',
  total: 99.99,
});
```

## Event composition and chaining

**What it is**: Creating complex workflows by chaining events together.

**When to use**: Multi-step processes, workflow orchestration, saga patterns.

**Example**:

```typescript
// E-commerce order processing saga
class OrderSaga {
  async handleOrderCreated(orderData) {
    try {
      // Step 1: Validate inventory
      await app.events.emit('inventory.validate', {
        orderId: orderData.id,
        items: orderData.items,
      });
    } catch (error) {
      await app.events.emit('order.failed', {
        orderId: orderData.id,
        step: 'inventory_validation',
        error: error.message,
      });
    }
  }

  async handleInventoryValidated(data) {
    try {
      // Step 2: Reserve inventory
      await app.events.emit('inventory.reserve', {
        orderId: data.orderId,
        items: data.validatedItems,
      });
    } catch (error) {
      await app.events.emit('order.failed', {
        orderId: data.orderId,
        step: 'inventory_reservation',
        error: error.message,
      });
    }
  }

  async handleInventoryReserved(data) {
    try {
      // Step 3: Process payment
      await app.events.emit('payment.process', {
        orderId: data.orderId,
        amount: data.totalAmount,
        paymentMethod: data.paymentMethod,
      });
    } catch (error) {
      // Compensate by releasing inventory
      await app.events.emit('inventory.release', {
        orderId: data.orderId,
      });

      await app.events.emit('order.failed', {
        orderId: data.orderId,
        step: 'payment_processing',
        error: error.message,
      });
    }
  }

  async handlePaymentSucceeded(data) {
    try {
      // Step 4: Fulfill order
      await app.events.emit('fulfillment.process', {
        orderId: data.orderId,
      });

      // Step 5: Send confirmation
      await app.events.emit('notification.send', {
        type: 'order_confirmed',
        userId: data.userId,
        orderId: data.orderId,
      });

      // Final step: Mark order as confirmed
      await app.events.emit('order.confirmed', {
        orderId: data.orderId,
        confirmedAt: new Date(),
      });
    } catch (error) {
      await app.events.emit('order.failed', {
        orderId: data.orderId,
        step: 'fulfillment',
        error: error.message,
      });
    }
  }
}

const orderSaga = new OrderSaga();

// Register saga handlers
app.events.on('order.created', orderSaga.handleOrderCreated.bind(orderSaga));
app.events.on(
  'inventory.validated',
  orderSaga.handleInventoryValidated.bind(orderSaga)
);
app.events.on(
  'inventory.reserved',
  orderSaga.handleInventoryReserved.bind(orderSaga)
);
app.events.on(
  'payment.succeeded',
  orderSaga.handlePaymentSucceeded.bind(orderSaga)
);

// Error handling and compensation
app.events.on('order.failed', async data => {
  console.error(`Order ${data.orderId} failed at step: ${data.step}`);

  // Notify customer
  await app.events.emit('notification.send', {
    type: 'order_failed',
    userId: data.userId,
    orderId: data.orderId,
    reason: data.error,
  });

  // Trigger cleanup if needed
  await app.events.emit('order.cleanup', {
    orderId: data.orderId,
    step: data.step,
  });
});
```

---

# 🔄 Lifecycle Management

## start() / stop() - Event system lifecycle

**What it is**: Methods to control the event system lifecycle and manage resources.

**When to use**: Application startup/shutdown, testing setup/teardown, graceful restarts.

**Signature**:

```typescript
start(): Promise<void>
stop(): Promise<void>
```

**Example**:

```typescript
// Application lifecycle management
class Application {
  constructor() {
    this.app = createApp();
    this.isShuttingDown = false;
  }

  async start() {
    try {
      // Start event system
      await this.app.events.start();
      console.log('✅ Event system started');

      // Register event handlers
      this.registerEventHandlers();

      // Start HTTP server
      this.server = this.app.listen(3000);
      console.log('🚀 Server started on port 3000');

      // Emit application ready event
      await this.app.events.emit('app.started', {
        timestamp: new Date(),
        version: process.env.APP_VERSION,
      });
    } catch (error) {
      console.error('Failed to start application:', error);
      process.exit(1);
    }
  }

  async stop() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    console.log('🛑 Shutting down application...');

    try {
      // Emit shutdown event
      await this.app.events.emit('app.stopping', {
        timestamp: new Date(),
      });

      // Stop accepting new HTTP requests
      this.server.close();

      // Wait for in-flight events to complete
      await this.app.events.stop();
      console.log('✅ Event system stopped');

      // Close database connections
      await database.close();

      console.log('✅ Application shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  }

  registerEventHandlers() {
    // Register cleanup handlers
    this.app.events.on('app.stopping', async () => {
      // Cancel all background jobs
      await jobQueue.stop();

      // Close external connections
      await redis.disconnect();
      await messageQueue.close();
    });
  }
}

// Graceful shutdown handling
const app = new Application();

process.on('SIGTERM', () => app.stop());
process.on('SIGINT', () => app.stop());

// Start application
app.start().catch(console.error);

// Testing lifecycle
describe('Event System', () => {
  beforeEach(async () => {
    await app.events.start();
  });

  afterEach(async () => {
    await app.events.stop();
  });

  test('should handle user registration', async () => {
    const handler = jest.fn();
    app.events.on('user.registered', handler);

    await app.events.emit('user.registered', { userId: '123' });

    expect(handler).toHaveBeenCalledWith({ userId: '123' }, expect.any(Object));
  });
});
```

---

# 🎯 Complete Event System Example

```typescript
import { createApp } from 'nextrush';
import type { Context } from 'nextrush/types';

const app = createApp();

// Event middleware for logging
app.events.use(async (event, data, context, next) => {
  console.log(`📡 Event: ${event}`, {
    eventId: context.eventId,
    timestamp: new Date().toISOString(),
  });

  const startTime = Date.now();

  try {
    await next();
    const duration = Date.now() - startTime;
    console.log(`✅ Event completed: ${event} (${duration}ms)`);
  } catch (error) {
    console.error(`❌ Event failed: ${event}`, error);
    throw error;
  }
});

// Event middleware for metrics
app.events.use(async (event, data, context, next) => {
  const metric = `events.${event.replace(/\./g, '_')}`;

  try {
    await next();
    metrics.increment(`${metric}.success`);
  } catch (error) {
    metrics.increment(`${metric}.error`);
    throw error;
  }
});

// User management events
app.events.on('user.registered', async data => {
  // Send welcome email
  await emailService.send({
    to: data.email,
    template: 'welcome',
    data: { name: data.name, userId: data.userId },
  });
});

app.events.on('user.registered', async data => {
  // Create default profile
  await profileService.create({
    userId: data.userId,
    displayName: data.name,
    avatar: generateAvatarUrl(data.email),
  });
});

app.events.on('user.registered', async data => {
  // Track analytics
  await analytics.track('User Registered', {
    userId: data.userId,
    email: data.email,
    source: data.source,
    timestamp: data.registeredAt,
  });
});

// Order processing events
app.events.on('order.created', async orderData => {
  // Validate inventory
  const items = await inventory.validate(orderData.items);

  if (items.some(item => !item.available)) {
    await app.events.emit('order.failed', {
      orderId: orderData.id,
      reason: 'insufficient_inventory',
      unavailableItems: items.filter(item => !item.available),
    });
    return;
  }

  // Reserve inventory
  await inventory.reserve(orderData.items, orderData.id);

  // Process payment
  await app.events.emit('payment.process', {
    orderId: orderData.id,
    amount: orderData.total,
    customerId: orderData.customerId,
    paymentMethodId: orderData.paymentMethodId,
  });
});

app.events.on('payment.succeeded', async paymentData => {
  // Fulfill order
  await fulfillment.create({
    orderId: paymentData.orderId,
    shippingAddress: paymentData.shippingAddress,
  });

  // Send confirmation
  await app.events.emit('order.confirmed', {
    orderId: paymentData.orderId,
    paymentId: paymentData.paymentId,
    confirmedAt: new Date(),
  });
});

app.events.on('payment.failed', async paymentData => {
  // Release reserved inventory
  await inventory.release(paymentData.orderId);

  // Notify customer
  await app.events.emit('notification.send', {
    userId: paymentData.customerId,
    type: 'payment_failed',
    data: {
      orderId: paymentData.orderId,
      reason: paymentData.error,
    },
  });
});

// Notification events
app.events.on('notification.send', async notificationData => {
  const user = await db.user.findById(notificationData.userId);

  if (user.preferences.email) {
    await emailService.send({
      to: user.email,
      template: notificationData.type,
      data: notificationData.data,
    });
  }

  if (user.preferences.push) {
    await pushService.send({
      userId: user.id,
      title: getNotificationTitle(notificationData.type),
      body: getNotificationBody(notificationData.type, notificationData.data),
    });
  }

  // Real-time notification via WebSocket
  if (user.isOnline) {
    await websocket.send(user.socketId, {
      type: 'notification',
      data: notificationData,
    });
  }
});

// System events
app.events.on('system.error', async errorData => {
  // Log to monitoring service
  await monitoring.recordError(errorData);

  // Send alert if critical
  if (errorData.severity === 'critical') {
    await alerting.send({
      channel: 'ops-alerts',
      message: `Critical error: ${errorData.message}`,
      data: errorData,
    });
  }
});

// Audit logging for all user actions
app.events.on('user.*', async (data, context) => {
  await auditLog.record({
    event: context.event,
    userId: data.userId,
    timestamp: new Date(),
    metadata: data,
  });
});

// HTTP endpoints that emit events
app.post('/auth/register', async ctx => {
  const userData = ctx.body as RegisterData;

  try {
    const user = await db.user.create({
      name: userData.name,
      email: userData.email,
      password: await hashPassword(userData.password),
    });

    // Emit registration event
    await app.events.emit('user.registered', {
      userId: user.id,
      name: user.name,
      email: user.email,
      source: 'web',
      registeredAt: user.createdAt,
    });

    ctx.json(
      { user: { id: user.id, name: user.name, email: user.email } },
      201
    );
  } catch (error) {
    await app.events.emitSync('system.error', {
      message: 'User registration failed',
      error: error.message,
      severity: 'warning',
      context: { userData },
    });

    ctx.res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/orders', async ctx => {
  const orderData = ctx.body as CreateOrderData;

  try {
    const order = await db.order.create({
      customerId: ctx.state.user.id,
      items: orderData.items,
      total: calculateTotal(orderData.items),
      shippingAddress: orderData.shippingAddress,
      paymentMethodId: orderData.paymentMethodId,
    });

    // Start order processing workflow
    await app.events.emit('order.created', {
      id: order.id,
      customerId: order.customerId,
      items: order.items,
      total: order.total,
      shippingAddress: order.shippingAddress,
      paymentMethodId: order.paymentMethodId,
    });

    ctx.json({ order }, 201);
  } catch (error) {
    await app.events.emitSync('system.error', {
      message: 'Order creation failed',
      error: error.message,
      severity: 'warning',
      context: { orderData, userId: ctx.state.user.id },
    });

    ctx.res.status(500).json({ error: 'Order creation failed' });
  }
});

// Graceful startup and shutdown
app.events.once('app.ready', async () => {
  console.log('🎉 Application is ready to handle requests');

  // Warm up caches
  await cache.warmup();

  // Start background jobs
  await jobScheduler.start();
});

process.on('SIGTERM', async () => {
  console.log('📤 Received SIGTERM, shutting down gracefully...');

  await app.events.emit('app.stopping', {
    timestamp: new Date(),
    reason: 'SIGTERM',
  });

  // Stop event system
  await app.events.stop();

  process.exit(0);
});

// Start the application
app.listen(3000, async () => {
  await app.events.start();

  await app.events.emit('app.ready', {
    timestamp: new Date(),
    version: process.env.APP_VERSION || '1.0.0',
  });
});

export default app;
```

---

## Performance notes

- Use `emitSync()` for non-critical, fire-and-forget events
- Event middleware executes in order - place expensive operations last
- Use wildcards sparingly as they can impact performance
- Consider event batching for high-frequency events

## Security notes

- Validate event data in middleware to prevent injection attacks
- Filter sensitive data before emitting events
- Use namespaces to control event access in multi-tenant applications
- Log security-relevant events for audit trails

## See also

- [Context API](./context.md) - Using events within request context
- [Middleware guide](./middleware.md) - Event-driven middleware patterns
- [Application API](./application.md) - Application-level event configuration
- [Plugin system](../plugins/) - Plugin communication via events

---

_Added in v2.0.0-alpha.1_
