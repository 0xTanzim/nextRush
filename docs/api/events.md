# Event System API Reference

NextRush v2 features a powerful **hybrid event-driven architecture** that provides both beginner-friendly Express-style events and enterprise-grade CQRS/Event Sourcing capabilities.

## What it is

The Event System offers two complementary APIs:

1. **Simple Events API** (`app.events`) - Express-style event emitter for straightforward event handling
2. **Advanced Event System** (`app.eventSystem`) - Full CQRS/Event Sourcing with commands, queries, and domain events

Both APIs work together seamlessly, allowing you to start simple and scale to enterprise patterns as needed.

## When to use

**Simple Events API** for:

- Basic event-driven programming
- Express.js migration
- Straightforward notifications
- Quick prototyping

**Advanced Event System** for:

- CQRS (Command Query Responsibility Segregation)
- Event Sourcing and Domain Events
- Complex business workflows
- Enterprise-scale applications

## TypeScript Signatures

### Simple Events API

```typescript
interface SimpleEventsAPI {
  // Event emission
  emit(event: string, data: any): Promise<void>;

  // Event listening
  on(event: string, handler: (data: any) => void | Promise<void>): void;
  once(event: string, handler: (data: any) => void | Promise<void>): void;

  // Event management
  off(event: string, handler?: Function): void;
  listeners(event: string): Function[];
}
```

### Advanced Event System

```typescript
interface NextRushEventSystem {
  // Generic dispatch for commands, queries, and events
  dispatch<T = any>(operation: Command | Query | Event): Promise<T>;

  // Event operations
  emit<T extends Event>(event: T): Promise<void>;
  subscribe<T extends Event>(
    eventType: string,
    handler: EventHandler<T>
  ): EventSubscription;

  // CQRS operations
  executeCommand<TCommand extends Command, TResult = void>(
    command: TCommand
  ): Promise<TResult>;
  executeQuery<TQuery extends Query, TResult = unknown>(
    query: TQuery
  ): Promise<TResult>;

  // Handler registration
  registerCommandHandler<TCommand extends Command>(
    commandType: string,
    handler: CommandHandler<TCommand>
  ): void;
  registerQueryHandler<TQuery extends Query>(
    queryType: string,
    handler: QueryHandler<TQuery>
  ): void;
}
```

---

# 🎯 Simple Events API

The Simple Events API provides an Express-style interface that's familiar and easy to use. Perfect for getting started or migrating from other frameworks.

## emit() - Emit an event

**What it is**: Emits an event with data, triggering all registered handlers asynchronously.

**When to use**: When you need to notify multiple parts of your application about something that happened.

**Signature**:

```typescript
emit(event: string, data: any): Promise<void>
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

    // Emit user registration event - simple and clean!
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

## on() - Register event handler

**What it is**: Registers a handler that responds to every occurrence of an event.

**When to use**: For ongoing event processing, permanent handlers, system monitoring.

**Signature**:

```typescript
on(event: string, handler: (data: any) => void | Promise<void>): void
```

**Example**:

```typescript
// Order processing workflow
app.events.on('order.created', async orderData => {
  console.log(`New order created: ${orderData.orderId}`);

  // Validate inventory
  const available = await inventory.check(orderData.items);
  if (!available) {
    await app.events.emit('order.failed', {
      orderId: orderData.orderId,
      reason: 'insufficient_inventory',
    });
    return;
  }

  // Process payment
  await app.events.emit('payment.process', {
    orderId: orderData.orderId,
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

// Usage in order endpoint
app.post('/orders', async ctx => {
  const orderData = ctx.body as CreateOrderData;
  const order = await db.order.create(orderData);

  // Start order processing workflow
  await app.events.emit('order.created', {
    orderId: order.id,
    customerId: order.customerId,
    items: order.items,
    total: order.total,
    createdAt: order.createdAt,
  });

  ctx.json({ order }, 201);
});
```

## once() - One-time event handler

**What it is**: Registers a handler that responds only to the first occurrence of an event, then removes itself.

**When to use**: Initialization, single-use handlers, conditional logic.

**Signature**:

```typescript
once(event: string, handler: (data: any) => void | Promise<void>): void
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

// Server startup
app.listen(3000, async () => {
  await connectDatabase();
  await app.events.emit('database.connected', { timestamp: new Date() });
});
```

## off() - Remove event handler

**What it is**: Removes specific event handlers or all handlers for an event.

**When to use**: Cleanup, feature toggling, memory management, testing.

**Signature**:

```typescript
off(event: string, handler?: Function): void
```

**Example**:

```typescript
// Dynamic feature management
const notificationHandler = async data => {
  await websocket.broadcast('notification', data);
};

// Enable feature
app.events.on('notification.created', notificationHandler);

// Disable feature later
app.events.off('notification.created', notificationHandler);

// Remove all handlers for an event
app.events.off('notification.created');

// Test cleanup
afterEach(() => {
  // Remove all test handlers
  app.events.off('test.event');
});
```

---

# 🏢 Advanced Event System API

The Advanced Event System provides enterprise-grade CQRS, Event Sourcing, and Domain-Driven Design patterns. Use this for complex business logic and scalable architectures.

## dispatch() - Generic operation dispatch

**What it is**: Universal dispatch method that can handle Commands, Queries, or Events.

**When to use**: When you want a unified interface for all CQRS operations.

**Signature**:

```typescript
dispatch<T = any>(operation: Command | Query | Event): Promise<T>
```

**Example**:

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Define commands, queries, and events
interface CreateUserCommand {
  type: 'CreateUser';
  data: { name: string; email: string };
  metadata: { id: string; timestamp: Date; correlationId: string };
}

interface GetUserQuery {
  type: 'GetUser';
  parameters: { userId: string };
  metadata: { id: string; timestamp: Date };
}

interface UserCreatedEvent {
  type: 'user.created';
  data: { userId: string; email: string };
  timestamp: Date;
  metadata: { aggregateId: string; version: number };
}

// Register handlers
app.eventSystem.registerCommandHandler(
  'CreateUser',
  async (command: CreateUserCommand) => {
    const user = await db.user.create(command.data);

    // Emit domain event
    await app.eventSystem.emit({
      type: 'user.created',
      data: { userId: user.id, email: user.email },
      timestamp: new Date(),
      metadata: { aggregateId: user.id, version: 1 },
    });

    return user;
  }
);

app.eventSystem.registerQueryHandler('GetUser', async (query: GetUserQuery) => {
  return await db.user.findById(query.parameters.userId);
});

// Usage with dispatch
app.post('/users', async ctx => {
  const command: CreateUserCommand = {
    type: 'CreateUser',
    data: ctx.body,
    metadata: {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      correlationId: ctx.id,
    },
  };

  try {
    const user = await app.eventSystem.dispatch(command);
    ctx.json({ user }, 201);
  } catch (error) {
    ctx.res.status(500).json({ error: error.message });
  }
});

app.get('/users/:id', async ctx => {
  const query: GetUserQuery = {
    type: 'GetUser',
    parameters: { userId: ctx.params.id },
    metadata: {
      id: crypto.randomUUID(),
      timestamp: new Date(),
    },
  };

  const user = await app.eventSystem.dispatch(query);
  ctx.json({ user });
});
```

## executeCommand() - Command execution

**What it is**: Executes commands in a CQRS architecture for write operations.

**When to use**: When you need to modify state with proper command validation and event sourcing.

**Signature**:

```typescript
executeCommand<TCommand extends Command, TResult = void>(command: TCommand): Promise<TResult>
```

**Example**:

```typescript
// E-commerce order command handling
interface PlaceOrderCommand {
  type: 'PlaceOrder';
  data: {
    customerId: string;
    items: Array<{ productId: string; quantity: number; price: number }>;
    shippingAddress: Address;
    paymentMethodId: string;
  };
  metadata: { id: string; timestamp: Date; correlationId: string };
}

// Register command handler
app.eventSystem.registerCommandHandler(
  'PlaceOrder',
  async (command: PlaceOrderCommand) => {
    const { customerId, items, shippingAddress, paymentMethodId } =
      command.data;

    // Business logic validation
    const customer = await db.customer.findById(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    // Check inventory
    for (const item of items) {
      const product = await db.product.findById(item.productId);
      if (!product || product.inventory < item.quantity) {
        throw new Error(`Insufficient inventory for product ${item.productId}`);
      }
    }

    // Create order
    const order = await db.order.create({
      customerId,
      items,
      shippingAddress,
      paymentMethodId,
      total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      status: 'pending',
    });

    // Emit domain events
    await app.eventSystem.emit({
      type: 'order.placed',
      data: {
        orderId: order.id,
        customerId,
        items,
        total: order.total,
      },
      timestamp: new Date(),
      metadata: {
        aggregateId: order.id,
        aggregateType: 'Order',
        version: 1,
      },
    });

    return order;
  }
);

// Usage in endpoint
app.post('/orders', async ctx => {
  const command: PlaceOrderCommand = {
    type: 'PlaceOrder',
    data: ctx.body,
    metadata: {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      correlationId: ctx.id,
    },
  };

  try {
    const order = await app.eventSystem.executeCommand(command);
    ctx.json({ order }, 201);
  } catch (error) {
    ctx.res.status(400).json({ error: error.message });
  }
});
```

## executeQuery() - Query execution

**What it is**: Executes queries in a CQRS architecture for read operations.

**When to use**: When you need optimized read operations separate from write models.

**Signature**:

```typescript
executeQuery<TQuery extends Query, TResult = unknown>(query: TQuery): Promise<TResult>
```

**Example**:

```typescript
// Customer order history query
interface GetCustomerOrdersQuery {
  type: 'GetCustomerOrders';
  parameters: {
    customerId: string;
    page?: number;
    limit?: number;
    status?: string;
    dateFrom?: Date;
    dateTo?: Date;
  };
  metadata: { id: string; timestamp: Date };
}

// Register query handler
app.eventSystem.registerQueryHandler(
  'GetCustomerOrders',
  async (query: GetCustomerOrdersQuery) => {
    const {
      customerId,
      page = 1,
      limit = 10,
      status,
      dateFrom,
      dateTo,
    } = query.parameters;

    let queryBuilder = db.order
      .where('customerId', customerId)
      .orderBy('createdAt', 'desc');

    if (status) {
      queryBuilder = queryBuilder.where('status', status);
    }

    if (dateFrom) {
      queryBuilder = queryBuilder.where('createdAt', '>=', dateFrom);
    }

    if (dateTo) {
      queryBuilder = queryBuilder.where('createdAt', '<=', dateTo);
    }

    const orders = await queryBuilder
      .offset((page - 1) * limit)
      .limit(limit)
      .select();

    const total = await queryBuilder.count();

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
);

// Usage in endpoint
app.get('/customers/:id/orders', async ctx => {
  const query: GetCustomerOrdersQuery = {
    type: 'GetCustomerOrders',
    parameters: {
      customerId: ctx.params.id,
      page: parseInt(ctx.query.page) || 1,
      limit: parseInt(ctx.query.limit) || 10,
      status: ctx.query.status,
      dateFrom: ctx.query.dateFrom ? new Date(ctx.query.dateFrom) : undefined,
      dateTo: ctx.query.dateTo ? new Date(ctx.query.dateTo) : undefined,
    },
    metadata: {
      id: crypto.randomUUID(),
      timestamp: new Date(),
    },
  };

  const result = await app.eventSystem.executeQuery(query);
  ctx.json(result);
});
```

## subscribe() - Event subscription

**What it is**: Subscribe to domain events in the advanced event system.

**When to use**: When you need to handle domain events with full type safety and metadata.

**Signature**:

```typescript
subscribe<T extends Event>(eventType: string, handler: EventHandler<T>): EventSubscription
```

**Example**:

```typescript
// Inventory management through event subscriptions
app.eventSystem.subscribe('order.placed', async event => {
  const { orderId, items } = event.data;

  // Reserve inventory for each item
  for (const item of items) {
    await db.inventory.update(item.productId, {
      available: db.raw('available - ?', [item.quantity]),
      reserved: db.raw('reserved + ?', [item.quantity]),
    });

    // Emit inventory reserved event
    await app.eventSystem.emit({
      type: 'inventory.reserved',
      data: {
        productId: item.productId,
        quantity: item.quantity,
        orderId,
      },
      timestamp: new Date(),
      metadata: {
        aggregateId: item.productId,
        aggregateType: 'Product',
        causationId: event.metadata.id,
      },
    });
  }
});

// Payment processing subscription
app.eventSystem.subscribe('order.placed', async event => {
  const { orderId, total, customerId } = event.data;

  try {
    // Process payment
    const payment = await paymentService.charge({
      amount: total,
      customerId,
      orderId,
    });

    await app.eventSystem.emit({
      type: 'payment.succeeded',
      data: {
        orderId,
        paymentId: payment.id,
        amount: total,
      },
      timestamp: new Date(),
      metadata: {
        aggregateId: orderId,
        aggregateType: 'Order',
        causationId: event.metadata.id,
      },
    });
  } catch (error) {
    await app.eventSystem.emit({
      type: 'payment.failed',
      data: {
        orderId,
        error: error.message,
        amount: total,
      },
      timestamp: new Date(),
      metadata: {
        aggregateId: orderId,
        aggregateType: 'Order',
        causationId: event.metadata.id,
      },
    });
  }
});

// Order fulfillment subscription
app.eventSystem.subscribe('payment.succeeded', async event => {
  const { orderId } = event.data;

  // Update order status
  await db.order.update(orderId, { status: 'confirmed' });

  // Create fulfillment record
  const fulfillment = await db.fulfillment.create({
    orderId,
    status: 'pending',
    estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  });

  await app.eventSystem.emit({
    type: 'order.confirmed',
    data: {
      orderId,
      fulfillmentId: fulfillment.id,
      estimatedDelivery: fulfillment.estimatedDelivery,
    },
    timestamp: new Date(),
    metadata: {
      aggregateId: orderId,
      aggregateType: 'Order',
      causationId: event.metadata.id,
    },
  });
});
```

---

# 🔄 Hybrid Patterns and Best Practices

## Choosing Between APIs

### Start Simple, Scale Advanced

Begin with the Simple Events API for straightforward event-driven programming, then migrate to the Advanced Event System as your requirements grow.

```typescript
// Start with Simple Events API
app.events.emit('user.registered', {
  userId: '123',
  email: 'user@example.com',
});

// Later, migrate to Advanced Event System for complex business logic
await app.eventSystem.dispatch({
  type: 'RegisterUser',
  data: { email: 'user@example.com', name: 'John Doe' },
  metadata: { id: crypto.randomUUID(), timestamp: new Date() },
});
```

### Use Both APIs Together

The Simple and Advanced APIs work seamlessly together. Events emitted through the Simple API flow through the same underlying event system.

```typescript
// Simple API emits events
app.events.emit('order.created', { orderId: '123' });

// Advanced API can subscribe to the same events
app.eventSystem.subscribe('order.created', async event => {
  // Handle with full domain event metadata
  console.log('Order created:', event.data);
  console.log('Event metadata:', event.metadata);
});
```

## Migration from Express.js

NextRush's Simple Events API provides a familiar migration path from Express.js EventEmitter patterns:

```typescript
// Express.js style (works in NextRush!)
app.events.on('user.login', data => {
  console.log(`User ${data.userId} logged in`);
});

app.events.emit('user.login', { userId: '123', ip: req.ip });

// Enhanced with async support
app.events.on('user.login', async data => {
  await auditLog.record('user_login', data);
  await updateLastSeen(data.userId);
});

await app.events.emit('user.login', { userId: '123', ip: req.ip });
```

## Event Namespacing

Use consistent event naming conventions for better organization:

```typescript
// Simple Events API - string-based namespacing
app.events.emit('user.registered', data);
app.events.emit('user.updated', data);
app.events.emit('user.deleted', data);

app.events.emit('order.created', data);
app.events.emit('order.confirmed', data);
app.events.emit('order.shipped', data);

// Advanced Event System - structured event types
interface UserRegisteredEvent {
  type: 'user.registered';
  data: { userId: string; email: string };
  timestamp: Date;
  metadata: { aggregateId: string; version: number };
}

interface OrderCreatedEvent {
  type: 'order.created';
  data: { orderId: string; customerId: string; total: number };
  timestamp: Date;
  metadata: { aggregateId: string; aggregateType: 'Order'; version: number };
}
```

---

# 🎯 Complete Hybrid Event System Example

This example shows both Simple and Advanced APIs working together in a real application:

```typescript
import { createApp } from 'nextrush';
import type { Context } from 'nextrush/types';

const app = createApp();

// ==================== SIMPLE EVENTS API ====================

// Basic logging for all simple events
app.events.on('user.registered', async data => {
  console.log(`New user registered: ${data.email}`);

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

// Order processing with simple events
app.events.on('order.created', async orderData => {
  console.log(`Order created: ${orderData.orderId}`);

  // Simple inventory check
  const available = await inventory.check(orderData.items);
  if (!available) {
    await app.events.emit('order.failed', {
      orderId: orderData.orderId,
      reason: 'insufficient_inventory',
    });
    return;
  }

  // Process payment
  await app.events.emit('payment.process', {
    orderId: orderData.orderId,
    amount: orderData.total,
  });
});

// ==================== ADVANCED EVENT SYSTEM ====================

// Define sophisticated command and event types
interface CreateUserCommand {
  type: 'CreateUser';
  data: { name: string; email: string; source: string };
  metadata: { id: string; timestamp: Date; correlationId: string };
}

interface UserCreatedEvent {
  type: 'user.created';
  data: { userId: string; email: string; name: string };
  timestamp: Date;
  metadata: {
    aggregateId: string;
    aggregateType: 'User';
    version: number;
    correlationId: string;
  };
}

// Advanced command handler
app.eventSystem.registerCommandHandler(
  'CreateUser',
  async (command: CreateUserCommand) => {
    const { name, email, source } = command.data;

    // Business rule validation
    const existingUser = await db.user.findByEmail(email);
    if (existingUser) {
      throw new Error('User already exists');
    }

    // Create user aggregate
    const user = await db.user.create({ name, email, source });

    // Emit domain event
    await app.eventSystem.emit({
      type: 'user.created',
      data: { userId: user.id, email, name },
      timestamp: new Date(),
      metadata: {
        aggregateId: user.id,
        aggregateType: 'User',
        version: 1,
        correlationId: command.metadata.correlationId,
      },
    } as UserCreatedEvent);

    return user;
  }
);

// Advanced event subscription with full metadata
app.eventSystem.subscribe('user.created', async (event: UserCreatedEvent) => {
  const { userId, email, name } = event.data;

  // Advanced analytics with correlation tracking
  await analytics.track('User Created', {
    userId,
    email,
    name,
    correlationId: event.metadata.correlationId,
    aggregateVersion: event.metadata.version,
    timestamp: event.timestamp,
  });

  // Emit simple event for basic handlers
  await app.events.emit('user.registered', {
    userId,
    email,
    name,
    registeredAt: event.timestamp,
  });
});

// Complex business workflow with CQRS
interface ProcessOrderCommand {
  type: 'ProcessOrder';
  data: {
    customerId: string;
    items: Array<{ productId: string; quantity: number; price: number }>;
    shippingAddress: Address;
    paymentMethodId: string;
  };
  metadata: { id: string; timestamp: Date; correlationId: string };
}

app.eventSystem.registerCommandHandler(
  'ProcessOrder',
  async (command: ProcessOrderCommand) => {
    const { customerId, items, shippingAddress, paymentMethodId } =
      command.data;

    // Create order aggregate
    const order = await db.order.create({
      customerId,
      items,
      shippingAddress,
      paymentMethodId,
      total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      status: 'pending',
    });

    // Emit domain event
    await app.eventSystem.emit({
      type: 'order.placed',
      data: {
        orderId: order.id,
        customerId,
        items,
        total: order.total,
      },
      timestamp: new Date(),
      metadata: {
        aggregateId: order.id,
        aggregateType: 'Order',
        version: 1,
        correlationId: command.metadata.correlationId,
      },
    });

    return order;
  }
);

// Saga pattern for order processing
app.eventSystem.subscribe('order.placed', async event => {
  const { orderId, items } = event.data;

  try {
    // Reserve inventory using domain events
    for (const item of items) {
      await app.eventSystem.dispatch({
        type: 'ReserveInventory',
        data: { productId: item.productId, quantity: item.quantity, orderId },
        metadata: {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          correlationId: event.metadata.correlationId,
        },
      });
    }

    // Emit simple event for basic handlers
    await app.events.emit('order.created', {
      orderId,
      items,
      total: event.data.total,
    });
  } catch (error) {
    await app.eventSystem.emit({
      type: 'order.failed',
      data: { orderId, error: error.message },
      timestamp: new Date(),
      metadata: {
        aggregateId: orderId,
        aggregateType: 'Order',
        causationId: event.metadata.id,
      },
    });
  }
});

// ==================== HTTP ENDPOINTS ====================

// Simple endpoint using Simple Events API
app.post('/auth/register', async ctx => {
  const userData = ctx.body as { name: string; email: string };

  try {
    const user = await db.user.create(userData);

    // Use simple events for straightforward notification
    await app.events.emit('user.registered', {
      userId: user.id,
      name: user.name,
      email: user.email,
      registeredAt: user.createdAt,
    });

    ctx.json(
      { user: { id: user.id, name: user.name, email: user.email } },
      201
    );
  } catch (error) {
    ctx.res.status(500).json({ error: 'Registration failed' });
  }
});

// Advanced endpoint using CQRS
app.post('/users', async ctx => {
  const command: CreateUserCommand = {
    type: 'CreateUser',
    data: { ...ctx.body, source: 'api' },
    metadata: {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      correlationId: ctx.id,
    },
  };

  try {
    const user = await app.eventSystem.dispatch(command);
    ctx.json({ user }, 201);
  } catch (error) {
    ctx.res.status(400).json({ error: error.message });
  }
});

// Complex business operation using CQRS
app.post('/orders', async ctx => {
  const command: ProcessOrderCommand = {
    type: 'ProcessOrder',
    data: ctx.body,
    metadata: {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      correlationId: ctx.id,
    },
  };

  try {
    const order = await app.eventSystem.dispatch(command);
    ctx.json({ order }, 201);
  } catch (error) {
    ctx.res.status(400).json({ error: error.message });
  }
});

// ==================== CROSS-API INTEGRATION ====================

// Simple events trigger advanced workflows
app.events.on('payment.succeeded', async data => {
  // Simple event triggers advanced command
  await app.eventSystem.dispatch({
    type: 'FulfillOrder',
    data: { orderId: data.orderId },
    metadata: {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      correlationId: data.correlationId || crypto.randomUUID(),
    },
  });
});

// Advanced events trigger simple notifications
app.eventSystem.subscribe('order.fulfilled', async event => {
  // Advanced event triggers simple notification
  await app.events.emit('order.shipped', {
    orderId: event.data.orderId,
    trackingNumber: event.data.trackingNumber,
    shippedAt: event.timestamp,
  });
});

// Start the application
app.listen(3000, () => {
  console.log('🚀 NextRush hybrid event system ready');
  console.log('📡 Simple Events API: app.events.emit/on/once');
  console.log('🏢 Advanced Event System: app.eventSystem.dispatch/subscribe');
});

export default app;
```

---

## Performance Notes

- **Simple Events API**: Optimized for ease of use and Express.js compatibility
- **Advanced Event System**: Optimized for enterprise-scale event processing with CQRS patterns
- Use `app.events` for straightforward event-driven programming
- Use `app.eventSystem` for complex business logic and domain events
- Both APIs share the same underlying event infrastructure for consistent performance

## Security Notes

- **Event Data Validation**: Validate event data in handlers to prevent injection attacks
- **Sensitive Data**: Filter sensitive data before emitting events in both APIs
- **Access Control**: Use proper authentication and authorization for event handlers
- **Audit Trails**: Both APIs support comprehensive logging for security and compliance

## Migration Guide

### From Express.js EventEmitter

```typescript
// Express.js style
app.on('user.login', data => {
  /* handler */
});
app.emit('user.login', data);

// NextRush Simple Events API (compatible!)
app.events.on('user.login', data => {
  /* handler */
});
await app.events.emit('user.login', data);
```

### From Simple to Advanced API

```typescript
// Start with Simple Events API
app.events.emit('order.created', { orderId: '123' });

// Migrate to Advanced Event System
await app.eventSystem.dispatch({
  type: 'CreateOrder',
  data: { customerId: '456', items: [...] },
  metadata: { id: crypto.randomUUID(), timestamp: new Date() }
});
```

## See Also

- [Context API](./context.md) - Using events within request context
- [Application API](./application.md) - Application-level event configuration
- [Plugin System](../plugins/) - Plugin communication via events
- [CQRS Guide](../guides/cqrs.md) - Advanced CQRS patterns with NextRush

---

_Added in v2.0.0-alpha.1_
