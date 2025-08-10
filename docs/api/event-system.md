# NextRush v2 Event System API Reference

## Overview

The NextRush v2 Event System provides a complete enterprise-grade event-driven architecture with CQRS (Command Query Responsibility Segregation), Event Sourcing, and pipeline processing capabilities. The system is built with 100% TypeScript type safety and designed for high-performance applications.

## Table of Contents

- [Core Components](#core-components)
- [Type Definitions](#type-definitions)
- [Event Emitter](#event-emitter)
- [Event Store](#event-store)
- [Event System (CQRS)](#event-system-cqrs)
- [Pipeline Processing](#pipeline-processing)
- [Event Sourcing](#event-sourcing)
- [Performance Monitoring](#performance-monitoring)
- [Usage Examples](#usage-examples)
- [Best Practices](#best-practices)

## Core Components

### NextRushEventEmitter

High-performance event emitter with pipeline processing support.

```typescript
import { NextRushEventEmitter } from '@/core/events';

const emitter = new NextRushEventEmitter<MyEventMap>({
  maxListeners: 100,
  enablePipelines: true,
  enableMetrics: true,
});
```

**Key Features:**

- Type-safe event emission and subscription
- Pipeline processing with middleware support
- Performance metrics and monitoring
- Memory management and cleanup
- Error handling and recovery

### InMemoryEventStore

In-memory event store for development and testing.

```typescript
import { InMemoryEventStore } from '@/core/events';

const store = new InMemoryEventStore({
  maxEvents: 10000,
  enableMetrics: true,
});
```

**Key Features:**

- Fast in-memory event storage
- Event querying and filtering
- Domain event support
- Subscription management
- Statistics tracking

### PersistentEventStore

File-based persistent event store for production use.

```typescript
import { PersistentEventStore } from '@/core/events';

const store = new PersistentEventStore({
  filePath: './events.jsonl',
  batchSize: 100,
  flushInterval: 1000,
});
```

**Key Features:**

- Persistent event storage
- Batched writes for performance
- Event replay capabilities
- Data integrity guarantees
- Backup and recovery

### NextRushEventSystem

Complete CQRS implementation with command and query handlers.

```typescript
import { NextRushEventSystem } from '@/core/events';

const eventSystem = new NextRushEventSystem({
  emitter: myEmitter,
  store: myStore,
  enableProjections: true,
});
```

**Key Features:**

- Command and query separation
- Event sourcing integration
- Projection management
- Saga pattern support
- Transaction handling

## Type Definitions

### Base Event Types

```typescript
interface Event<
  TType extends string = string,
  TData = unknown,
  TMetadata = EventMetadata,
> {
  type: TType;
  data: TData;
  metadata: TMetadata;
}

interface EventMetadata {
  id: string;
  timestamp: number;
  source: string;
  version: number;
  correlationId?: string;
  causationId?: string;
  userId?: string;
  sessionId?: string;
  traceId?: string;
}
```

### Domain Events

```typescript
interface DomainEvent<TType extends string = string, TData = unknown>
  extends Event<TType, TData> {
  aggregateId: string;
  aggregateType: string;
  aggregateVersion: number;
  metadata: EventMetadata & {
    domain: string;
    boundedContext: string;
  };
}
```

### Commands and Queries

```typescript
interface Command<TType extends string = string, TData = unknown>
  extends Event<TType, TData> {
  metadata: EventMetadata & {
    expectedVersion?: number;
    idempotencyKey?: string;
  };
}

interface Query<TType extends string = string, TData = unknown>
  extends Event<TType, TData> {
  metadata: EventMetadata & {
    timeout?: number;
    consistency?: 'eventual' | 'strong';
  };
}
```

### Handler Types

```typescript
type EventHandler<TEvent extends Event = Event> = (
  event: TEvent
) => Promise<void> | void;

type CommandHandler<TCommand extends Command, TResult = void> = (
  command: TCommand
) => Promise<TResult>;

type QueryHandler<TQuery extends Query, TResult = unknown> = (
  query: TQuery
) => Promise<TResult>;
```

## Event Emitter

### Basic Usage

```typescript
// Define your event types
interface UserEvents {
  'user.created': { id: string; email: string; name: string };
  'user.updated': { id: string; changes: Record<string, unknown> };
  'user.deleted': { id: string };
}

// Create type-safe emitter
const emitter = new NextRushEventEmitter<UserEvents>();

// Subscribe to events
const subscription = emitter.on('user.created', async event => {
  console.log('User created:', event.data);
});

// Emit events
await emitter.emit({
  type: 'user.created',
  data: { id: '1', email: 'user@example.com', name: 'John Doe' },
  metadata: {
    id: 'evt-1',
    timestamp: Date.now(),
    source: 'user-service',
    version: 1,
  },
});

// Clean up
subscription.unsubscribe();
```

### Pipeline Processing

```typescript
// Configure pipeline processing
emitter.configurePipeline('user.created', {
  transformers: [
    // Add computed fields
    async event => ({
      ...event,
      data: {
        ...event.data,
        displayName: event.data.name.toUpperCase(),
      },
    }),
  ],
  filters: [
    // Filter out test users
    async event => !event.data.email.includes('@test.com'),
  ],
  middleware: [
    // Log all events
    async (event, next) => {
      console.log('Processing event:', event.type);
      await next();
      console.log('Event processed:', event.type);
    },
  ],
});
```

### Error Handling

```typescript
// Handle pipeline errors
emitter.configurePipeline('user.created', {
  errorHandlers: [
    async (error, event, stage) => {
      console.error(`Error in ${stage}:`, error);
      // Decide whether to continue or abort
      return stage === 'transformer' ? 'continue' : 'abort';
    },
  ],
});

// Handle subscription errors
emitter
  .on('user.created', async event => {
    throw new Error('Handler error');
  })
  .onError(async (error, event) => {
    console.error('Handler failed:', error, event);
  });
```

## Event Store

### Storing Events

```typescript
// Store single event
await store.append({
  type: 'user.created',
  data: { id: '1', email: 'user@example.com', name: 'John Doe' },
  metadata: {
    id: 'evt-1',
    timestamp: Date.now(),
    source: 'user-service',
    version: 1,
  },
});

// Store multiple events
await store.appendMany([event1, event2, event3]);

// Store domain events
await store.appendDomainEvents('user', '1', [
  {
    type: 'UserCreated',
    data: { email: 'user@example.com', name: 'John Doe' },
    aggregateId: '1',
    aggregateType: 'User',
    aggregateVersion: 1,
    metadata: {
      id: 'evt-1',
      timestamp: Date.now(),
      source: 'user-service',
      version: 1,
      domain: 'user-management',
      boundedContext: 'identity',
    },
  },
]);
```

### Querying Events

```typescript
// Get all events
const allEvents = await store.getEvents();

// Get events by type
const userEvents = await store.getEventsByType('user.created');

// Get events by aggregate
const userAggregateEvents = await store.getAggregateEvents('user', '1');

// Get events with filters
const filteredEvents = await store.getEvents({
  fromTimestamp: Date.now() - 86400000, // Last 24 hours
  toTimestamp: Date.now(),
  types: ['user.created', 'user.updated'],
  limit: 100,
  offset: 0,
});

// Get domain events
const domainEvents = await store.getDomainEvents('user-management');
```

### Event Subscriptions

```typescript
// Subscribe to all events
const subscription = store.subscribe(async event => {
  console.log('Event stored:', event);
});

// Subscribe to specific event types
const typeSubscription = store.subscribe(
  async event => {
    console.log('User event:', event);
  },
  { types: ['user.created', 'user.updated'] }
);

// Subscribe to domain events
const domainSubscription = store.subscribeToDomainEvents(
  'user-management',
  async event => {
    console.log('Domain event:', event);
  }
);
```

## Event System (CQRS)

### Command Handling

```typescript
// Define command types
interface CreateUserCommand extends Command<'CreateUser'> {
  data: { email: string; name: string };
}

interface UpdateUserCommand extends Command<'UpdateUser'> {
  data: { id: string; changes: Record<string, unknown> };
}

// Register command handlers
eventSystem.registerCommandHandler(
  'CreateUser',
  async (command: CreateUserCommand) => {
    const user = await userService.createUser(
      command.data.email,
      command.data.name
    );

    // Emit domain event
    await eventSystem.emit({
      type: 'UserCreated',
      data: user,
      aggregateId: user.id,
      aggregateType: 'User',
      aggregateVersion: 1,
      metadata: {
        id: generateId(),
        timestamp: Date.now(),
        source: 'user-service',
        version: 1,
        domain: 'user-management',
        boundedContext: 'identity',
      },
    });

    return user;
  }
);

// Execute commands
const user = await eventSystem.executeCommand<CreateUserCommand, User>({
  type: 'CreateUser',
  data: { email: 'user@example.com', name: 'John Doe' },
  metadata: {
    id: 'cmd-1',
    timestamp: Date.now(),
    source: 'user-api',
    version: 1,
  },
});
```

### Query Handling

```typescript
// Define query types
interface GetUserQuery extends Query<'GetUser'> {
  data: { id: string };
}

interface GetUsersQuery extends Query<'GetUsers'> {
  data: { limit?: number; offset?: number };
}

// Register query handlers
eventSystem.registerQueryHandler('GetUser', async (query: GetUserQuery) => {
  return await userService.getUserById(query.data.id);
});

eventSystem.registerQueryHandler('GetUsers', async (query: GetUsersQuery) => {
  return await userService.getUsers(query.data.limit, query.data.offset);
});

// Execute queries
const user = await eventSystem.executeQuery<GetUserQuery, User>({
  type: 'GetUser',
  data: { id: '1' },
  metadata: {
    id: 'qry-1',
    timestamp: Date.now(),
    source: 'user-api',
    version: 1,
  },
});
```

### Event Sourcing

```typescript
// Reconstruct aggregate from events
const user = await eventSystem.reconstructAggregate<User>('user', '1');

// Get aggregate version
const version = await eventSystem.getAggregateVersion('user', '1');

// Snapshot management
await eventSystem.createSnapshot('user', '1', user);
const snapshot = await eventSystem.getSnapshot<User>('user', '1');

// Replay events from specific version
const events = await eventSystem.replayEvents('user', '1', { fromVersion: 5 });
```

### Projections

```typescript
// Create read model projections
eventSystem.createProjection('user-list', {
  events: ['UserCreated', 'UserUpdated', 'UserDeleted'],
  handler: async (event, projection) => {
    switch (event.type) {
      case 'UserCreated':
        await projection.insert('users', {
          id: event.aggregateId,
          ...event.data,
          createdAt: event.metadata.timestamp,
        });
        break;
      case 'UserUpdated':
        await projection.update('users', event.aggregateId, event.data);
        break;
      case 'UserDeleted':
        await projection.delete('users', event.aggregateId);
        break;
    }
  },
});

// Query projections
const userList = await eventSystem.queryProjection('user-list', 'users');
```

## Pipeline Processing

### Transformer Functions

```typescript
// Data transformation
emitter.configurePipeline('user.created', {
  transformers: [
    // Normalize email
    async event => ({
      ...event,
      data: {
        ...event.data,
        email: event.data.email.toLowerCase(),
      },
    }),
    // Add computed fields
    async event => ({
      ...event,
      data: {
        ...event.data,
        displayName: `${event.data.name} <${event.data.email}>`,
      },
    }),
  ],
});
```

### Filter Functions

```typescript
// Event filtering
emitter.configurePipeline('user.created', {
  filters: [
    // Only process verified users
    async event => event.data.isVerified === true,
    // Skip test users
    async event => !event.data.email.includes('@test.com'),
    // Rate limiting
    async event => {
      const recent = await redis.get(`rate:${event.data.email}`);
      return !recent;
    },
  ],
});
```

### Middleware Functions

```typescript
// Processing middleware
emitter.configurePipeline('user.created', {
  middleware: [
    // Logging middleware
    async (event, next) => {
      const start = Date.now();
      console.log(`Processing ${event.type}...`);

      try {
        await next();
        console.log(`Completed ${event.type} in ${Date.now() - start}ms`);
      } catch (error) {
        console.error(`Failed ${event.type}:`, error);
        throw error;
      }
    },
    // Authentication middleware
    async (event, next) => {
      if (!event.metadata.userId) {
        throw new Error('Authentication required');
      }
      await next();
    },
    // Rate limiting middleware
    async (event, next) => {
      await rateLimiter.consume(event.metadata.userId);
      await next();
    },
  ],
});
```

## Performance Monitoring

### Metrics Collection

```typescript
// Enable metrics
const emitter = new NextRushEventEmitter({
  enableMetrics: true,
});

// Get metrics
const metrics = emitter.getMetrics();
console.log({
  eventsEmitted: metrics.eventsEmitted,
  subscriptionsActive: metrics.subscriptionsActive,
  pipelineExecutions: metrics.pipelineExecutions,
  errors: metrics.errors,
  averageProcessingTime: metrics.averageProcessingTime,
  memoryUsage: metrics.memoryUsage,
});

// Reset metrics
emitter.resetMetrics();
```

### Performance Monitoring

```typescript
// Monitor processing times
emitter.on('user.created', async event => {
  const start = process.hrtime.bigint();

  // Process event
  await processUser(event.data);

  const end = process.hrtime.bigint();
  const duration = Number(end - start) / 1_000_000; // Convert to milliseconds

  console.log(`Processed in ${duration}ms`);
});

// Monitor memory usage
const subscription = emitter.on('user.created', handler);
console.log(`Memory usage: ${process.memoryUsage().heapUsed / 1024 / 1024} MB`);
```

## Usage Examples

### Complete User Service Example

```typescript
import {
  NextRushEventSystem,
  NextRushEventEmitter,
  InMemoryEventStore,
  EventSystemBuilder,
} from '@/core/events';

// Define event types
interface UserEventMap {
  'user.created': { id: string; email: string; name: string };
  'user.updated': { id: string; changes: Record<string, unknown> };
  'user.deleted': { id: string };
}

// Create event system
const eventSystem = new EventSystemBuilder()
  .withEmitter(
    new NextRushEventEmitter<UserEventMap>({
      maxListeners: 1000,
      enablePipelines: true,
      enableMetrics: true,
    })
  )
  .withStore(
    new InMemoryEventStore({
      maxEvents: 100000,
      enableMetrics: true,
    })
  )
  .withProjections(true)
  .build();

// User aggregate
class User {
  constructor(
    public id: string,
    public email: string,
    public name: string,
    public version: number = 1
  ) {}

  static create(email: string, name: string): User {
    return new User(generateId(), email, name);
  }

  update(changes: Record<string, unknown>): User {
    return new User(
      this.id,
      (changes.email as string) || this.email,
      (changes.name as string) || this.name,
      this.version + 1
    );
  }
}

// User service
class UserService {
  private users = new Map<string, User>();

  async createUser(email: string, name: string): Promise<User> {
    const user = User.create(email, name);
    this.users.set(user.id, user);
    return user;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async updateUser(
    id: string,
    changes: Record<string, unknown>
  ): Promise<User | null> {
    const user = this.users.get(id);
    if (!user) return null;

    const updatedUser = user.update(changes);
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  async getUsers(limit = 10, offset = 0): Promise<User[]> {
    return Array.from(this.users.values()).slice(offset, offset + limit);
  }
}

// Register handlers
const userService = new UserService();

eventSystem.registerCommandHandler('CreateUser', async command => {
  const user = await userService.createUser(
    command.data.email,
    command.data.name
  );

  await eventSystem.emit({
    type: 'user.created',
    data: { id: user.id, email: user.email, name: user.name },
    metadata: {
      id: generateId(),
      timestamp: Date.now(),
      source: 'user-service',
      version: 1,
      correlationId: command.metadata.id,
    },
  });

  return user;
});

eventSystem.registerQueryHandler('GetUser', async query => {
  return await userService.getUserById(query.data.id);
});

// Set up projections
eventSystem.createProjection('user-list', {
  events: ['user.created', 'user.updated', 'user.deleted'],
  handler: async (event, projection) => {
    switch (event.type) {
      case 'user.created':
        console.log('User created projection:', event.data);
        break;
      case 'user.updated':
        console.log('User updated projection:', event.data);
        break;
      case 'user.deleted':
        console.log('User deleted projection:', event.data);
        break;
    }
  },
});

// Usage
async function main() {
  // Create user
  const user = await eventSystem.executeCommand({
    type: 'CreateUser',
    data: { email: 'user@example.com', name: 'John Doe' },
    metadata: {
      id: 'cmd-1',
      timestamp: Date.now(),
      source: 'api',
      version: 1,
    },
  });

  console.log('Created user:', user);

  // Get user
  const foundUser = await eventSystem.executeQuery({
    type: 'GetUser',
    data: { id: user.id },
    metadata: {
      id: 'qry-1',
      timestamp: Date.now(),
      source: 'api',
      version: 1,
    },
  });

  console.log('Found user:', foundUser);

  // Get metrics
  const metrics = eventSystem.getMetrics();
  console.log('System metrics:', metrics);
}

main().catch(console.error);
```

## Best Practices

### 1. Event Design

- **Use past tense for events**: `UserCreated`, `OrderShipped`
- **Include all necessary data**: Events should be self-contained
- **Version your events**: Use semantic versioning for event schemas
- **Add correlation IDs**: Enable tracing across service boundaries

### 2. Command Design

- **Use imperative names**: `CreateUser`, `UpdateOrder`
- **Validate input**: Always validate command data
- **Be idempotent**: Commands should be safely retryable
- **Include expected version**: For optimistic concurrency control

### 3. Query Design

- **Separate read models**: Use projections for complex queries
- **Cache results**: Cache frequently accessed data
- **Set timeouts**: Prevent long-running queries
- **Use eventual consistency**: Accept slightly stale data when possible

### 4. Error Handling

- **Handle pipeline errors**: Decide between continue/retry/abort
- **Log all errors**: Include context and correlation IDs
- **Use circuit breakers**: Prevent cascading failures
- **Implement retry logic**: With exponential backoff

### 5. Performance Optimization

- **Monitor metrics**: Track processing times and memory usage
- **Use batching**: Process events in batches when possible
- **Implement snapshots**: For large aggregates
- **Clean up subscriptions**: Prevent memory leaks

### 6. Testing Strategies

- **Test event handlers**: Verify event processing logic
- **Test command handlers**: Validate business logic
- **Test projections**: Ensure read models stay consistent
- **Test error scenarios**: Verify error handling and recovery

### 7. Deployment Considerations

- **Use persistent storage**: For production event stores
- **Monitor memory usage**: Prevent memory leaks
- **Configure logging**: Enable structured logging
- **Set up health checks**: Monitor system health

This comprehensive API reference provides everything needed to build robust event-driven applications with NextRush v2's event system. The system is designed for enterprise-grade applications with high performance, type safety, and comprehensive error handling.
