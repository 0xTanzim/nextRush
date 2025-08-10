# NextRush v2 Event System - Quick Reference Guide

## 🚀 Quick Setup

### Basic Event System

```typescript
import { createEventSystem } from '@nextrush/core/events';

// Minimal setup
const eventSystem = createEventSystem();

// Production setup
const eventSystem = createEventSystem({
  emitter: {
    enablePipelines: true,
    enableMetrics: true,
    maxListeners: 1000,
  },
  store: {
    type: 'persistent',
    connection: 'redis://localhost:6379',
    maxEvents: 10000,
  },
  enableProjections: true,
});
```

## 📝 Event Types Quick Reference

### Basic Events

```typescript
// Simple event
await eventSystem.emit({
  type: 'UserLoggedIn',
  data: { userId: '123', timestamp: Date.now() },
  metadata: {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    source: 'auth-service',
    version: 1,
  },
});

// Domain event
await eventSystem.appendDomainEvents('User', 'user-123', [
  {
    type: 'UserCreated',
    data: { email: 'user@example.com', name: 'John Doe' },
    aggregateId: 'user-123',
    aggregateType: 'User',
    aggregateVersion: 1,
    metadata: {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      source: 'user-service',
      version: 1,
      domain: 'identity',
      boundedContext: 'user-management',
    },
  },
]);
```

### Commands & Queries

```typescript
// Command
const result = await eventSystem.executeCommand({
  type: 'CreateUser',
  data: { email: 'user@example.com', name: 'John Doe' },
  metadata: {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    source: 'web-app',
    version: 1,
  },
});

// Query
const users = await eventSystem.executeQuery({
  type: 'GetActiveUsers',
  data: { status: 'active' },
  metadata: {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    source: 'admin-panel',
    version: 1,
  },
});
```

## 🔧 Common Patterns

### 1. Event Handler Registration

```typescript
// Simple handler
eventSystem.on('UserCreated', async event => {
  console.log(`User created: ${event.data.name}`);
});

// Handler with error handling
eventSystem.on('OrderPlaced', async event => {
  try {
    await processOrder(event.data);
  } catch (error) {
    await eventSystem.emit({
      type: 'OrderProcessingFailed',
      data: { orderId: event.data.orderId, error: error.message },
      metadata: createMetadata('order-service'),
    });
  }
});

// Handler with pipeline
eventSystem.on(
  'UserRegistered',
  async event => {
    // This handler runs in a pipeline with transformers/filters
  },
  {
    pipeline: {
      transformers: [normalizeEmailTransformer],
      filters: [activeUserFilter],
      middleware: [loggingMiddleware],
    },
  }
);
```

### 2. Command & Query Handlers

```typescript
// Command handler
eventSystem.registerCommandHandler('CreateUser', async command => {
  // Validate input
  const userData = validateUserData(command.data);

  // Create user
  const user = await userRepository.create(userData);

  // Emit domain event
  await eventSystem.appendDomainEvents('User', user.id, [
    {
      type: 'UserCreated',
      data: user,
      aggregateId: user.id,
      aggregateType: 'User',
      aggregateVersion: 1,
      metadata: createDomainMetadata('user-service', 'identity'),
    },
  ]);

  return user;
});

// Query handler with caching
eventSystem.registerQueryHandler('GetUser', async query => {
  const cacheKey = `user:${query.data.userId}`;
  let user = await cache.get(cacheKey);

  if (!user) {
    user = await userRepository.findById(query.data.userId);
    await cache.set(cacheKey, user, { ttl: 300 });
  }

  return user;
});
```

### 3. Projections

```typescript
// User statistics projection
eventSystem.createProjection('user-stats', {
  events: ['UserCreated', 'UserActivated', 'UserDeactivated'],
  handler: async (event, projection) => {
    const stats = (await projection.getState()) || {
      total: 0,
      active: 0,
      inactive: 0,
    };

    switch (event.type) {
      case 'UserCreated':
        stats.total++;
        stats.inactive++;
        break;
      case 'UserActivated':
        stats.active++;
        stats.inactive--;
        break;
      case 'UserDeactivated':
        stats.active--;
        stats.inactive++;
        break;
    }

    await projection.setState(stats);
  },
  replay: true,
});

// Read model projection
eventSystem.createProjection('user-profile-read-model', {
  events: ['UserCreated', 'UserUpdated', 'ProfileUpdated'],
  handler: async (event, projection) => {
    const userId = event.aggregateId || event.data.userId;
    let profile = (await projection.getState(userId)) || {};

    switch (event.type) {
      case 'UserCreated':
        profile = {
          id: userId,
          email: event.data.email,
          name: event.data.name,
          createdAt: event.metadata.timestamp,
          updatedAt: event.metadata.timestamp,
        };
        break;
      case 'UserUpdated':
      case 'ProfileUpdated':
        profile = {
          ...profile,
          ...event.data.changes,
          updatedAt: event.metadata.timestamp,
        };
        break;
    }

    await projection.setState(userId, profile);
  },
});
```

### 4. Sagas / Process Managers

```typescript
// Order processing saga
class OrderProcessingSaga {
  constructor(private eventSystem: NextRushEventSystem) {
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.eventSystem.on('OrderPlaced', this.handleOrderPlaced.bind(this));
    this.eventSystem.on(
      'InventoryReserved',
      this.handleInventoryReserved.bind(this)
    );
    this.eventSystem.on(
      'PaymentProcessed',
      this.handlePaymentProcessed.bind(this)
    );
    this.eventSystem.on('PaymentFailed', this.handlePaymentFailed.bind(this));
  }

  private async handleOrderPlaced(event: Event): Promise<void> {
    // Step 1: Reserve inventory
    await this.eventSystem.executeCommand({
      type: 'ReserveInventory',
      data: { orderId: event.data.orderId, items: event.data.items },
      metadata: createMetadata('order-saga'),
    });
  }

  private async handleInventoryReserved(event: Event): Promise<void> {
    // Step 2: Process payment
    await this.eventSystem.executeCommand({
      type: 'ProcessPayment',
      data: {
        orderId: event.data.orderId,
        amount: event.data.totalAmount,
        customerId: event.data.customerId,
      },
      metadata: createMetadata('order-saga'),
    });
  }

  private async handlePaymentProcessed(event: Event): Promise<void> {
    // Step 3: Fulfill order
    await this.eventSystem.executeCommand({
      type: 'FulfillOrder',
      data: { orderId: event.data.orderId },
      metadata: createMetadata('order-saga'),
    });
  }

  private async handlePaymentFailed(event: Event): Promise<void> {
    // Compensate: Release inventory
    await this.eventSystem.executeCommand({
      type: 'ReleaseInventory',
      data: { orderId: event.data.orderId },
      metadata: createMetadata('order-saga'),
    });

    await this.eventSystem.emit({
      type: 'OrderCancelled',
      data: { orderId: event.data.orderId, reason: 'Payment failed' },
      metadata: createMetadata('order-saga'),
    });
  }
}
```

## 🏗️ Architecture Patterns

### CQRS with Event Sourcing

```typescript
// Command side
export class UserCommandHandler {
  constructor(private eventSystem: NextRushEventSystem) {}

  async handle(command: Command): Promise<any> {
    switch (command.type) {
      case 'CreateUser':
        return this.createUser(command);
      case 'UpdateUser':
        return this.updateUser(command);
      case 'DeleteUser':
        return this.deleteUser(command);
      default:
        throw new Error(`Unknown command: ${command.type}`);
    }
  }

  private async createUser(command: CreateUserCommand): Promise<User> {
    // Business logic validation
    await this.validateUserCreation(command.data);

    const userId = crypto.randomUUID();
    const domainEvent: UserCreatedDomainEvent = {
      type: 'UserCreated',
      data: { ...command.data, id: userId },
      aggregateId: userId,
      aggregateType: 'User',
      aggregateVersion: 1,
      metadata: createDomainMetadata('user-service', 'identity'),
    };

    await this.eventSystem.appendDomainEvents('User', userId, [domainEvent]);

    return { id: userId, ...command.data };
  }

  private async updateUser(command: UpdateUserCommand): Promise<User> {
    // Reconstruct aggregate from events
    const aggregate = await this.eventSystem.reconstructAggregate(
      'User',
      command.data.userId
    );
    const currentVersion = aggregate.version;

    // Business logic
    const updatedData = this.applyUserUpdate(aggregate, command.data);

    const domainEvent: UserUpdatedDomainEvent = {
      type: 'UserUpdated',
      data: { id: command.data.userId, changes: updatedData },
      aggregateId: command.data.userId,
      aggregateType: 'User',
      aggregateVersion: currentVersion + 1,
      metadata: createDomainMetadata('user-service', 'identity'),
    };

    await this.eventSystem.appendDomainEvents('User', command.data.userId, [
      domainEvent,
    ]);

    return { ...aggregate.state, ...updatedData };
  }
}

// Query side
export class UserQueryHandler {
  constructor(
    private eventSystem: NextRushEventSystem,
    private readModelRepository: UserReadModelRepository
  ) {}

  async handle(query: Query): Promise<any> {
    switch (query.type) {
      case 'GetUser':
        return this.getUser(query);
      case 'GetActiveUsers':
        return this.getActiveUsers(query);
      case 'GetUsersByEmail':
        return this.getUsersByEmail(query);
      default:
        throw new Error(`Unknown query: ${query.type}`);
    }
  }

  private async getUser(query: GetUserQuery): Promise<UserView | null> {
    return this.readModelRepository.findById(query.data.userId);
  }

  private async getActiveUsers(
    query: GetActiveUsersQuery
  ): Promise<UserView[]> {
    return this.readModelRepository.findByStatus('active', {
      limit: query.data.limit || 100,
      offset: query.data.offset || 0,
    });
  }
}
```

### Event-Driven Microservices

```typescript
// Service A: User Service
export class UserService {
  constructor(private eventSystem: NextRushEventSystem) {
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Listen to events from other services
    this.eventSystem.on(
      'PaymentProcessed',
      this.handlePaymentProcessed.bind(this)
    );
    this.eventSystem.on('OrderCompleted', this.handleOrderCompleted.bind(this));
  }

  async createUser(userData: CreateUserData): Promise<User> {
    const user = await this.userRepository.create(userData);

    // Publish event to other services
    await this.eventSystem.emit({
      type: 'UserCreated',
      data: user,
      metadata: createMetadata('user-service'),
    });

    return user;
  }

  private async handlePaymentProcessed(event: Event): Promise<void> {
    // Update user's purchase history
    const user = await this.userRepository.findById(event.data.customerId);
    if (user) {
      user.purchaseHistory.push(event.data);
      await this.userRepository.update(user);

      await this.eventSystem.emit({
        type: 'UserPurchaseHistoryUpdated',
        data: { userId: user.id, purchase: event.data },
        metadata: createMetadata('user-service'),
      });
    }
  }
}

// Service B: Notification Service
export class NotificationService {
  constructor(private eventSystem: NextRushEventSystem) {
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.eventSystem.on('UserCreated', this.sendWelcomeNotification.bind(this));
    this.eventSystem.on(
      'OrderCompleted',
      this.sendOrderConfirmation.bind(this)
    );
    this.eventSystem.on(
      'PaymentFailed',
      this.sendPaymentFailureNotification.bind(this)
    );
  }

  private async sendWelcomeNotification(event: Event): Promise<void> {
    await this.emailService.send({
      to: event.data.email,
      template: 'welcome',
      data: { name: event.data.name },
    });

    await this.eventSystem.emit({
      type: 'WelcomeEmailSent',
      data: { userId: event.data.id, email: event.data.email },
      metadata: createMetadata('notification-service'),
    });
  }
}
```

## 🧪 Testing Quick Reference

### Unit Testing

```typescript
describe('UserService', () => {
  let userService: UserService;
  let eventSystem: MockEventSystem;

  beforeEach(() => {
    eventSystem = new MockEventSystem();
    userService = new UserService(eventSystem);
  });

  it('should create user and emit event', async () => {
    // Arrange
    const userData = { email: 'test@example.com', name: 'Test User' };

    // Act
    const user = await userService.createUser(userData);

    // Assert
    expect(user.id).toBeDefined();
    expect(eventSystem.getEmittedEvents()).toHaveLength(1);
    expect(eventSystem.getEmittedEvents()[0].type).toBe('UserCreated');
  });
});
```

### Integration Testing

```typescript
describe('User Registration Flow', () => {
  let eventSystem: NextRushEventSystem;

  beforeEach(() => {
    eventSystem = createTestEventSystem();
  });

  it('should complete registration flow', async () => {
    // Setup event capture
    const events: Event[] = [];
    eventSystem.on('*', event => events.push(event));

    // Execute flow
    await eventSystem.executeCommand({
      type: 'RegisterUser',
      data: { email: 'test@example.com', name: 'Test User' },
      metadata: createMetadata('test'),
    });

    // Wait for async events
    await new Promise(resolve => setTimeout(resolve, 100));

    // Assert
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'UserRegistered' })
    );
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'WelcomeEmailSent' })
    );
  });
});
```

## 🚀 Performance Optimization

### High-Throughput Setup

```typescript
const eventSystem = createEventSystem({
  emitter: {
    enableMetrics: true,
    batchSize: 1000,
    flushInterval: 100,
    concurrency: 10,
  },
  store: {
    type: 'persistent',
    batchWrites: true,
    writeBufferSize: 10000,
    compressionEnabled: true,
  },
});
```

### Memory Optimization

```typescript
// Use event pruning
eventSystem.configurePruning({
  maxEvents: 100000,
  pruneInterval: '1h',
  retentionPolicy: {
    UserLoggedIn: '7d',
    UserCreated: 'never',
    TemporaryEvent: '1h',
  },
});

// Use efficient projections
eventSystem.createProjection('user-count', {
  events: ['UserCreated', 'UserDeleted'],
  handler: async (event, projection) => {
    const count = (await projection.getState()) || 0;
    const newCount = event.type === 'UserCreated' ? count + 1 : count - 1;
    await projection.setState(newCount);
  },
  snapshotInterval: 1000, // Snapshot every 1000 events
});
```

## 🛠️ Utility Functions

```typescript
// Helper for creating metadata
export function createMetadata(
  source: string,
  extra: Partial<EventMetadata> = {}
): EventMetadata {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    source,
    version: 1,
    ...extra,
  };
}

// Helper for creating domain metadata
export function createDomainMetadata(
  source: string,
  domain: string,
  boundedContext?: string,
  extra: Partial<DomainEventMetadata> = {}
): DomainEventMetadata {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    source,
    version: 1,
    domain,
    boundedContext: boundedContext || domain,
    ...extra,
  };
}

// Event matcher for testing
export function eventMatcher(
  type: string,
  data?: any
): (event: Event) => boolean {
  return (event: Event) => {
    if (event.type !== type) return false;
    if (data && !deepEqual(event.data, data)) return false;
    return true;
  };
}

// Retry helper for event handlers
export function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries: number; delay: number; backoff?: number }
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    let attempts = 0;

    while (attempts <= options.maxRetries) {
      try {
        const result = await fn();
        resolve(result);
        return;
      } catch (error) {
        attempts++;

        if (attempts > options.maxRetries) {
          reject(error);
          return;
        }

        const delay =
          options.delay * Math.pow(options.backoff || 1, attempts - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  });
}
```

## 📊 Monitoring & Debugging

```typescript
// Enable comprehensive monitoring
eventSystem.enableMetrics({
  collectPerformance: true,
  collectMemory: true,
  collectErrors: true,
});

// Custom metrics
eventSystem.on('UserCreated', async event => {
  metrics.increment('users.created');
  metrics.gauge('users.total', await getUserCount());
});

// Error tracking
eventSystem.onError((error, context) => {
  logger.error('Event system error', {
    error: error.message,
    stack: error.stack,
    context,
    timestamp: Date.now(),
  });

  // Send to monitoring service
  monitoring.captureException(error, context);
});

// Debug mode
if (process.env.NODE_ENV === 'development') {
  eventSystem.enableDebugMode({
    logAllEvents: true,
    logHandlerExecution: true,
    logPerformanceMetrics: true,
  });
}
```

This quick reference guide provides immediate access to the most common patterns and setups for NextRush v2's event-driven architecture. Keep it handy for rapid development!
