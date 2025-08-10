# NextRush v2 Event-Driven Architecture Guide

## Overview

This guide provides a comprehensive overview of NextRush v2's event-driven architecture, covering CQRS (Command Query Responsibility Segregation), Event Sourcing, pipeline processing, and best practices for building scalable, maintainable applications.

## Table of Contents

- [Architecture Principles](#architecture-principles)
- [Core Concepts](#core-concepts)
- [CQRS Pattern](#cqrs-pattern)
- [Event Sourcing](#event-sourcing)
- [Pipeline Processing](#pipeline-processing)
- [Domain-Driven Design Integration](#domain-driven-design-integration)
- [Microservices Architecture](#microservices-architecture)
- [Performance Considerations](#performance-considerations)
- [Deployment Strategies](#deployment-strategies)
- [Monitoring and Observability](#monitoring-and-observability)

## Architecture Principles

### 1. Event-First Design

The NextRush v2 event system is built around the principle that events are first-class citizens in your architecture. Every significant state change in your application should be represented as an event.

```typescript
// ✅ Good: Event-first design
await eventSystem.emit({
  type: 'OrderPlaced',
  data: { orderId, customerId, items, total },
  metadata: {
    id: generateId(),
    timestamp: Date.now(),
    source: 'order-service',
    version: 1,
  },
});

// ❌ Avoid: Direct database updates without events
await database.orders.insert(orderData);
```

### 2. Immutable Events

Events represent facts that happened in the past and should never be modified. This ensures data integrity and enables powerful features like event replay and time travel debugging.

```typescript
interface ImmutableEvent {
  readonly type: string;
  readonly data: unknown;
  readonly metadata: {
    readonly id: string;
    readonly timestamp: number;
    readonly source: string;
    readonly version: number;
  };
}
```

### 3. Eventual Consistency

The system embraces eventual consistency, allowing different parts of your application to process events at their own pace while maintaining overall system consistency.

### 4. Loose Coupling

Components communicate exclusively through events, reducing coupling and increasing flexibility. Services don't need to know about each other directly.

### 5. Scalability by Design

The architecture supports horizontal scaling through event partitioning, distributed processing, and asynchronous communication patterns.

## Core Concepts

### Events

Events are immutable records of something that happened in your system. They contain:

- **Type**: What happened (`OrderPlaced`, `UserRegistered`)
- **Data**: The relevant information about what happened
- **Metadata**: Context information (timestamp, source, correlation ID)

```typescript
interface OrderPlacedEvent extends DomainEvent<'OrderPlaced'> {
  data: {
    orderId: string;
    customerId: string;
    items: OrderItem[];
    total: number;
    currency: string;
  };
  aggregateId: string; // orderId
  aggregateType: 'Order';
  aggregateVersion: number;
}
```

### Commands

Commands represent intentions to change state. They are requests that may succeed or fail.

```typescript
interface PlaceOrderCommand extends Command<'PlaceOrder'> {
  data: {
    customerId: string;
    items: OrderItem[];
    shippingAddress: Address;
  };
  metadata: CommandMetadata & {
    idempotencyKey: string;
    expectedVersion?: number;
  };
}
```

### Queries

Queries represent requests for information without changing state.

```typescript
interface GetOrderQuery extends Query<'GetOrder'> {
  data: {
    orderId: string;
  };
  metadata: QueryMetadata & {
    consistency: 'eventual' | 'strong';
  };
}
```

### Aggregates

Aggregates are domain objects that encapsulate business logic and maintain consistency boundaries.

```typescript
class OrderAggregate {
  private events: DomainEvent[] = [];

  constructor(
    public readonly id: string,
    public readonly customerId: string,
    public readonly items: OrderItem[],
    public readonly status: OrderStatus,
    public readonly version: number = 0
  ) {}

  placeOrder(): void {
    if (this.status !== 'draft') {
      throw new Error('Order cannot be placed');
    }

    this.addEvent({
      type: 'OrderPlaced',
      data: {
        orderId: this.id,
        customerId: this.customerId,
        items: this.items,
        total: this.calculateTotal(),
      },
      aggregateId: this.id,
      aggregateType: 'Order',
      aggregateVersion: this.version + 1,
      metadata: {
        id: generateId(),
        timestamp: Date.now(),
        source: 'order-service',
        version: 1,
        domain: 'e-commerce',
        boundedContext: 'orders',
      },
    });
  }

  private addEvent(event: DomainEvent): void {
    this.events.push(event);
  }

  getUncommittedEvents(): DomainEvent[] {
    return [...this.events];
  }

  markEventsAsCommitted(): void {
    this.events = [];
  }
}
```

## CQRS Pattern

### Command Side

The command side handles operations that change state:

```typescript
class OrderCommandHandler {
  constructor(
    private orderRepository: OrderRepository,
    private eventSystem: NextRushEventSystem
  ) {}

  async handlePlaceOrder(command: PlaceOrderCommand): Promise<OrderAggregate> {
    // 1. Load aggregate (if exists)
    const order =
      (await this.orderRepository.findById(command.data.orderId)) ||
      new OrderAggregate(
        generateId(),
        command.data.customerId,
        command.data.items,
        'draft'
      );

    // 2. Execute business logic
    order.placeOrder();

    // 3. Save events
    const events = order.getUncommittedEvents();
    await this.eventSystem.store.appendDomainEvents('Order', order.id, events);

    // 4. Emit events
    for (const event of events) {
      await this.eventSystem.emit(event);
    }

    // 5. Mark events as committed
    order.markEventsAsCommitted();

    return order;
  }
}

// Register command handler
eventSystem.registerCommandHandler(
  'PlaceOrder',
  async (command: PlaceOrderCommand) => {
    const handler = new OrderCommandHandler(orderRepository, eventSystem);
    return await handler.handlePlaceOrder(command);
  }
);
```

### Query Side

The query side handles read operations using projections:

```typescript
class OrderQueryHandler {
  constructor(private readModel: OrderReadModel) {}

  async handleGetOrder(query: GetOrderQuery): Promise<OrderView | null> {
    return await this.readModel.findById(query.data.orderId);
  }

  async handleGetOrdersByCustomer(
    query: GetOrdersByCustomerQuery
  ): Promise<OrderView[]> {
    return await this.readModel.findByCustomerId(query.data.customerId);
  }
}

// Register query handler
eventSystem.registerQueryHandler('GetOrder', async (query: GetOrderQuery) => {
  const handler = new OrderQueryHandler(orderReadModel);
  return await handler.handleGetOrder(query);
});
```

### Read Model Projections

Projections maintain denormalized views optimized for queries:

```typescript
class OrderProjection {
  constructor(private readModel: OrderReadModel) {}

  async handleOrderPlaced(event: OrderPlacedEvent): Promise<void> {
    await this.readModel.insert({
      id: event.aggregateId,
      customerId: event.data.customerId,
      items: event.data.items,
      total: event.data.total,
      status: 'placed',
      placedAt: event.metadata.timestamp,
      version: event.aggregateVersion,
    });
  }

  async handleOrderShipped(event: OrderShippedEvent): Promise<void> {
    await this.readModel.update(event.aggregateId, {
      status: 'shipped',
      shippedAt: event.metadata.timestamp,
      trackingNumber: event.data.trackingNumber,
      version: event.aggregateVersion,
    });
  }

  async handleOrderDelivered(event: OrderDeliveredEvent): Promise<void> {
    await this.readModel.update(event.aggregateId, {
      status: 'delivered',
      deliveredAt: event.metadata.timestamp,
      version: event.aggregateVersion,
    });
  }
}

// Register projection
eventSystem.createProjection('order-view', {
  events: ['OrderPlaced', 'OrderShipped', 'OrderDelivered'],
  handler: async (event, projection) => {
    const orderProjection = new OrderProjection(orderReadModel);

    switch (event.type) {
      case 'OrderPlaced':
        await orderProjection.handleOrderPlaced(event as OrderPlacedEvent);
        break;
      case 'OrderShipped':
        await orderProjection.handleOrderShipped(event as OrderShippedEvent);
        break;
      case 'OrderDelivered':
        await orderProjection.handleOrderDelivered(
          event as OrderDeliveredEvent
        );
        break;
    }
  },
});
```

## Event Sourcing

### Event Store Design

Events are the single source of truth:

```typescript
class EventSourcedOrderRepository {
  constructor(private eventStore: EventStore) {}

  async save(aggregate: OrderAggregate): Promise<void> {
    const events = aggregate.getUncommittedEvents();
    await this.eventStore.appendDomainEvents('Order', aggregate.id, events);
    aggregate.markEventsAsCommitted();
  }

  async findById(id: string): Promise<OrderAggregate | null> {
    const events = await this.eventStore.getAggregateEvents('Order', id);
    if (events.length === 0) return null;

    return this.replayEvents(events);
  }

  private replayEvents(events: DomainEvent[]): OrderAggregate {
    let aggregate: OrderAggregate | null = null;

    for (const event of events) {
      aggregate = this.applyEvent(aggregate, event);
    }

    return aggregate!;
  }

  private applyEvent(
    aggregate: OrderAggregate | null,
    event: DomainEvent
  ): OrderAggregate {
    switch (event.type) {
      case 'OrderCreated':
        return new OrderAggregate(
          event.aggregateId,
          event.data.customerId,
          event.data.items,
          'draft',
          event.aggregateVersion
        );
      case 'OrderPlaced':
        return new OrderAggregate(
          aggregate!.id,
          aggregate!.customerId,
          aggregate!.items,
          'placed',
          event.aggregateVersion
        );
      // ... other events
      default:
        return aggregate!;
    }
  }
}
```

### Snapshots

For performance optimization with large aggregates:

```typescript
interface AggregateSnapshot<T> {
  aggregateId: string;
  aggregateType: string;
  version: number;
  data: T;
  timestamp: number;
}

class SnapshotRepository {
  private snapshots = new Map<string, AggregateSnapshot<any>>();

  async saveSnapshot<T>(
    aggregateType: string,
    aggregateId: string,
    version: number,
    data: T
  ): Promise<void> {
    const key = `${aggregateType}:${aggregateId}`;
    this.snapshots.set(key, {
      aggregateId,
      aggregateType,
      version,
      data,
      timestamp: Date.now()
    });
  }

  async getSnapshot<T>(
    aggregateType: string,
    aggregateId: string
  ): Promise<AggregateSnapshot<T> | null> {
    const key = `${aggregateType}:${aggregateId}`;
    return this.snapshots.get(key) || null;
  }
}

// Usage in repository
async findById(id: string): Promise<OrderAggregate | null> {
  // Try to get snapshot first
  const snapshot = await this.snapshotRepository.getSnapshot<OrderAggregate>('Order', id);

  let events: DomainEvent[];
  let aggregate: OrderAggregate | null = null;

  if (snapshot) {
    // Load events after snapshot
    events = await this.eventStore.getAggregateEvents('Order', id, snapshot.version + 1);
    aggregate = snapshot.data;
  } else {
    // Load all events
    events = await this.eventStore.getAggregateEvents('Order', id);
  }

  if (events.length === 0 && !snapshot) return null;

  // Apply events to restore current state
  return this.replayEvents(events, aggregate);
}
```

## Pipeline Processing

### Event Processing Pipeline

Events flow through configurable pipelines:

```typescript
// Configure pipeline for order events
eventSystem.getEmitter().configurePipeline('OrderPlaced', {
  // Transform event data
  transformers: [
    // Add computed fields
    async event => ({
      ...event,
      data: {
        ...event.data,
        totalWithTax: event.data.total * 1.1,
        itemCount: event.data.items.length,
      },
    }),
    // Normalize customer data
    async event => {
      const customer = await customerService.getCustomer(event.data.customerId);
      return {
        ...event,
        data: {
          ...event.data,
          customerName: customer?.name,
          customerEmail: customer?.email,
        },
      };
    },
  ],

  // Filter events
  filters: [
    // Only process orders above minimum threshold
    async event => event.data.total > 10.0,
    // Skip test orders
    async event => !event.data.customerId.includes('test'),
  ],

  // Processing middleware
  middleware: [
    // Logging middleware
    async (event, next) => {
      console.log(`Processing order: ${event.data.orderId}`);
      const start = Date.now();

      try {
        await next();
        console.log(`Order processed in ${Date.now() - start}ms`);
      } catch (error) {
        console.error(`Order processing failed:`, error);
        throw error;
      }
    },
    // Rate limiting middleware
    async (event, next) => {
      await rateLimiter.consume(event.data.customerId);
      await next();
    },
    // Fraud detection middleware
    async (event, next) => {
      const riskScore = await fraudService.assessRisk(event.data);
      if (riskScore > 0.8) {
        throw new Error('High fraud risk detected');
      }
      await next();
    },
  ],

  // Error handling
  errorHandlers: [
    async (error, event, stage) => {
      // Log error with context
      logger.error('Pipeline error', {
        error: error.message,
        event: event.type,
        stage,
        orderId: event.data.orderId,
      });

      // Decide how to handle the error
      if (stage === 'transformer') {
        return 'continue'; // Continue with original event
      } else if (stage === 'filter') {
        return 'abort'; // Don't process this event
      } else {
        return 'retry'; // Retry the stage
      }
    },
  ],
});
```

### Saga Pattern Implementation

Long-running business processes using sagas:

```typescript
class OrderSaga {
  constructor(
    private eventSystem: NextRushEventSystem,
    private paymentService: PaymentService,
    private inventoryService: InventoryService,
    private shippingService: ShippingService
  ) {}

  async handleOrderPlaced(event: OrderPlacedEvent): Promise<void> {
    const sagaId = generateId();

    try {
      // Step 1: Reserve inventory
      const reservation = await this.inventoryService.reserveItems(
        event.data.items
      );

      await this.eventSystem.emit({
        type: 'InventoryReserved',
        data: { orderId: event.aggregateId, reservation },
        metadata: {
          id: generateId(),
          timestamp: Date.now(),
          source: 'order-saga',
          version: 1,
          sagaId,
          correlationId: event.metadata.id,
        },
      });

      // Step 2: Process payment
      const payment = await this.paymentService.processPayment({
        amount: event.data.total,
        customerId: event.data.customerId,
        orderId: event.aggregateId,
      });

      await this.eventSystem.emit({
        type: 'PaymentProcessed',
        data: { orderId: event.aggregateId, payment },
        metadata: {
          id: generateId(),
          timestamp: Date.now(),
          source: 'order-saga',
          version: 1,
          sagaId,
          correlationId: event.metadata.id,
        },
      });
    } catch (error) {
      // Compensate on failure
      await this.compensateOrder(event.aggregateId, sagaId);
      throw error;
    }
  }

  async handlePaymentProcessed(event: PaymentProcessedEvent): Promise<void> {
    try {
      // Step 3: Arrange shipping
      const shipment = await this.shippingService.createShipment({
        orderId: event.data.orderId,
        items: event.data.items,
      });

      await this.eventSystem.emit({
        type: 'ShipmentCreated',
        data: { orderId: event.data.orderId, shipment },
        metadata: {
          id: generateId(),
          timestamp: Date.now(),
          source: 'order-saga',
          version: 1,
          sagaId: event.metadata.sagaId,
          correlationId: event.metadata.correlationId,
        },
      });
    } catch (error) {
      await this.compensateOrder(event.data.orderId, event.metadata.sagaId);
      throw error;
    }
  }

  private async compensateOrder(
    orderId: string,
    sagaId: string
  ): Promise<void> {
    // Implement compensation logic
    await this.inventoryService.releaseReservation(orderId);
    await this.paymentService.refundPayment(orderId);

    await this.eventSystem.emit({
      type: 'OrderCompensated',
      data: { orderId, reason: 'Saga compensation' },
      metadata: {
        id: generateId(),
        timestamp: Date.now(),
        source: 'order-saga',
        version: 1,
        sagaId,
      },
    });
  }
}

// Register saga handlers
const orderSaga = new OrderSaga(
  eventSystem,
  paymentService,
  inventoryService,
  shippingService
);

eventSystem
  .getEmitter()
  .on('OrderPlaced', event => orderSaga.handleOrderPlaced(event));
eventSystem
  .getEmitter()
  .on('PaymentProcessed', event => orderSaga.handlePaymentProcessed(event));
```

## Domain-Driven Design Integration

### Bounded Contexts

Organize events by bounded contexts:

```typescript
// Order Management Context
interface OrderManagementEvents {
  OrderCreated: OrderData;
  OrderPlaced: OrderData;
  OrderCancelled: OrderData;
  OrderShipped: ShipmentData;
  OrderDelivered: DeliveryData;
}

// Inventory Context
interface InventoryEvents {
  ItemReserved: ReservationData;
  ItemReleased: ReleaseData;
  StockUpdated: StockData;
  StockDepleted: DepletionData;
}

// Payment Context
interface PaymentEvents {
  PaymentInitiated: PaymentData;
  PaymentProcessed: PaymentData;
  PaymentFailed: PaymentFailureData;
  RefundIssued: RefundData;
}
```

### Domain Events

Events should reflect domain language:

```typescript
// ✅ Good: Domain-centric events
interface CustomerRegisteredEvent extends DomainEvent<'CustomerRegistered'> {
  data: {
    customerId: string;
    email: string;
    name: string;
    registrationSource: 'web' | 'mobile' | 'api';
  };
  metadata: EventMetadata & {
    domain: 'customer-management';
    boundedContext: 'identity';
  };
}

// ❌ Avoid: Technical events
interface UserRowInsertedEvent {
  tableName: 'users';
  rowId: number;
  columns: Record<string, unknown>;
}
```

### Integration Events

For cross-context communication:

```typescript
interface OrderPlacedIntegrationEvent
  extends DomainEvent<'OrderPlacedIntegrationEvent'> {
  data: {
    orderId: string;
    customerId: string;
    totalAmount: number;
    currency: string;
    items: Array<{
      productId: string;
      quantity: number;
      price: number;
    }>;
  };
  metadata: EventMetadata & {
    domain: 'e-commerce';
    boundedContext: 'orders';
    integrationType: 'cross-context';
    targetContexts: ['inventory', 'payment', 'shipping'];
  };
}
```

## Microservices Architecture

### Service Communication

Services communicate through events:

```typescript
// Order Service
class OrderService {
  async placeOrder(command: PlaceOrderCommand): Promise<void> {
    // Process order
    const order = await this.processOrder(command);

    // Emit integration event
    await this.eventSystem.emit({
      type: 'OrderPlacedIntegrationEvent',
      data: {
        orderId: order.id,
        customerId: order.customerId,
        totalAmount: order.total,
        currency: order.currency,
        items: order.items,
      },
      metadata: {
        id: generateId(),
        timestamp: Date.now(),
        source: 'order-service',
        version: 1,
        domain: 'e-commerce',
        boundedContext: 'orders',
      },
    });
  }
}

// Inventory Service
class InventoryService {
  constructor() {
    // Subscribe to order events
    this.eventSystem
      .getEmitter()
      .on('OrderPlacedIntegrationEvent', this.handleOrderPlaced.bind(this));
  }

  async handleOrderPlaced(event: OrderPlacedIntegrationEvent): Promise<void> {
    // Reserve inventory
    for (const item of event.data.items) {
      await this.reserveItem(item.productId, item.quantity);
    }

    // Emit inventory reserved event
    await this.eventSystem.emit({
      type: 'InventoryReserved',
      data: {
        orderId: event.data.orderId,
        reservationId: generateId(),
        items: event.data.items,
      },
      metadata: {
        id: generateId(),
        timestamp: Date.now(),
        source: 'inventory-service',
        version: 1,
        correlationId: event.metadata.id,
      },
    });
  }
}
```

### Event Distribution

Use message brokers for distributed events:

```typescript
class DistributedEventEmitter extends NextRushEventEmitter {
  constructor(
    private messageBroker: MessageBroker,
    options?: EventEmitterOptions
  ) {
    super(options);
  }

  async emit<TEvent extends Event>(event: TEvent): Promise<void> {
    // Emit locally first
    await super.emit(event);

    // Then distribute to other services
    if (this.isIntegrationEvent(event)) {
      await this.messageBroker.publish(`events.${event.type}`, event);
    }
  }

  private isIntegrationEvent(event: Event): boolean {
    return event.metadata.integrationType === 'cross-context';
  }
}

// Configure message broker
const eventEmitter = new DistributedEventEmitter(
  new RabbitMQBroker({
    connectionString: process.env.RABBITMQ_URL,
    exchange: 'domain-events',
  }),
  {
    maxListeners: 1000,
    enableMetrics: true,
  }
);
```

## Performance Considerations

### Event Batching

Process events in batches for better performance:

```typescript
class BatchEventProcessor {
  private batch: Event[] = [];
  private readonly batchSize: number;
  private readonly flushInterval: number;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private eventHandler: EventHandler,
    batchSize = 100,
    flushInterval = 1000
  ) {
    this.batchSize = batchSize;
    this.flushInterval = flushInterval;
  }

  async addEvent(event: Event): Promise<void> {
    this.batch.push(event);

    if (this.batch.length >= this.batchSize) {
      await this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.flushInterval);
    }
  }

  private async flush(): Promise<void> {
    if (this.batch.length === 0) return;

    const eventsToProcess = [...this.batch];
    this.batch = [];

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    try {
      await this.processBatch(eventsToProcess);
    } catch (error) {
      console.error('Batch processing failed:', error);
      // Implement retry logic or dead letter queue
    }
  }

  private async processBatch(events: Event[]): Promise<void> {
    // Process events in parallel
    await Promise.all(events.map(event => this.eventHandler(event)));
  }
}
```

### Memory Management

Implement memory-efficient event processing:

```typescript
class MemoryEfficientEventStore extends InMemoryEventStore {
  private readonly maxEvents: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(options: { maxEvents: number }) {
    super(options);
    this.maxEvents = options.maxEvents;

    // Clean up old events periodically
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Clean up every minute
  }

  async append(event: Event): Promise<void> {
    await super.append(event);

    // Trigger cleanup if needed
    if (this.events.length > this.maxEvents) {
      await this.cleanup();
    }
  }

  private async cleanup(): Promise<void> {
    if (this.events.length <= this.maxEvents) return;

    // Remove oldest events, keep last N events
    const eventsToRemove = this.events.length - this.maxEvents;
    const removedEvents = this.events.splice(0, eventsToRemove);

    // Optionally archive removed events
    await this.archiveEvents(removedEvents);

    console.log(`Cleaned up ${eventsToRemove} old events`);
  }

  private async archiveEvents(events: Event[]): Promise<void> {
    // Implement archiving logic (write to file, send to cold storage, etc.)
  }

  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}
```

### Partitioning Strategy

Distribute events across partitions for scalability:

```typescript
interface PartitionedEvent extends Event {
  partitionKey?: string;
}

class PartitionedEventStore {
  private partitions: Map<string, EventStore> = new Map();

  constructor(private partitionCount: number) {
    // Initialize partitions
    for (let i = 0; i < partitionCount; i++) {
      this.partitions.set(
        i.toString(),
        new InMemoryEventStore({ maxEvents: 10000 })
      );
    }
  }

  async append(event: PartitionedEvent): Promise<void> {
    const partition = this.getPartition(event);
    const store = this.partitions.get(partition)!;
    await store.append(event);
  }

  private getPartition(event: PartitionedEvent): string {
    if (event.partitionKey) {
      return this.hashPartitionKey(event.partitionKey);
    }

    // Default partitioning strategy
    const key = event.metadata.source + event.type;
    return this.hashPartitionKey(key);
  }

  private hashPartitionKey(key: string): string {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash % this.partitionCount).toString();
  }

  async getEvents(partitionKey?: string): Promise<Event[]> {
    if (partitionKey) {
      const partition = this.hashPartitionKey(partitionKey);
      const store = this.partitions.get(partition)!;
      return await store.getEvents();
    }

    // Get events from all partitions
    const allEvents: Event[] = [];
    for (const store of this.partitions.values()) {
      const events = await store.getEvents();
      allEvents.push(...events);
    }

    // Sort by timestamp
    return allEvents.sort(
      (a, b) => a.metadata.timestamp - b.metadata.timestamp
    );
  }
}
```

## Deployment Strategies

### Container Deployment

Deploy event-driven services in containers:

```dockerfile
# Dockerfile for event service
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY dist/ ./dist/

# Set environment variables
ENV NODE_ENV=production
ENV EVENT_STORE_TYPE=persistent
ENV EVENT_STORE_PATH=/data/events

# Create data directory
RUN mkdir -p /data

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Expose port
EXPOSE 3000

# Run application
CMD ["node", "dist/index.js"]
```

### Kubernetes Deployment

```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: event-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: event-service
  template:
    metadata:
      labels:
        app: event-service
    spec:
      containers:
        - name: event-service
          image: event-service:latest
          ports:
            - containerPort: 3000
          env:
            - name: EVENT_STORE_TYPE
              value: 'redis'
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: redis-secret
                  key: url
            - name: MAX_EVENTS_PER_STORE
              value: '100000'
          resources:
            requests:
              memory: '256Mi'
              cpu: '250m'
            limits:
              memory: '512Mi'
              cpu: '500m'
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
          volumeMounts:
            - name: event-data
              mountPath: /data
      volumes:
        - name: event-data
          persistentVolumeClaim:
            claimName: event-data-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: event-service
spec:
  selector:
    app: event-service
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  type: ClusterIP
```

### Environment Configuration

```typescript
// config/environment.ts
interface EventSystemConfig {
  store: {
    type: 'memory' | 'persistent' | 'redis';
    options: {
      maxEvents?: number;
      filePath?: string;
      redisUrl?: string;
      batchSize?: number;
      flushInterval?: number;
    };
  };
  emitter: {
    maxListeners: number;
    enablePipelines: boolean;
    enableMetrics: boolean;
  };
  performance: {
    enableBatching: boolean;
    batchSize: number;
    batchTimeout: number;
    enablePartitioning: boolean;
    partitionCount: number;
  };
}

export const config: EventSystemConfig = {
  store: {
    type: (process.env.EVENT_STORE_TYPE as any) || 'memory',
    options: {
      maxEvents: parseInt(process.env.MAX_EVENTS_PER_STORE || '10000'),
      filePath: process.env.EVENT_STORE_PATH || './events.jsonl',
      redisUrl: process.env.REDIS_URL,
      batchSize: parseInt(process.env.BATCH_SIZE || '100'),
      flushInterval: parseInt(process.env.FLUSH_INTERVAL || '1000'),
    },
  },
  emitter: {
    maxListeners: parseInt(process.env.MAX_LISTENERS || '1000'),
    enablePipelines: process.env.ENABLE_PIPELINES === 'true',
    enableMetrics: process.env.ENABLE_METRICS === 'true',
  },
  performance: {
    enableBatching: process.env.ENABLE_BATCHING === 'true',
    batchSize: parseInt(process.env.BATCH_SIZE || '100'),
    batchTimeout: parseInt(process.env.BATCH_TIMEOUT || '1000'),
    enablePartitioning: process.env.ENABLE_PARTITIONING === 'true',
    partitionCount: parseInt(process.env.PARTITION_COUNT || '4'),
  },
};
```

## Monitoring and Observability

### Metrics Collection

```typescript
interface EventSystemMetrics {
  events: {
    emitted: number;
    processed: number;
    failed: number;
    averageProcessingTime: number;
  };
  commands: {
    executed: number;
    successful: number;
    failed: number;
    averageExecutionTime: number;
  };
  queries: {
    executed: number;
    successful: number;
    failed: number;
    averageExecutionTime: number;
  };
  storage: {
    eventsStored: number;
    storageSize: number;
    averageWriteTime: number;
    averageReadTime: number;
  };
  system: {
    memoryUsage: number;
    cpuUsage: number;
    activeSubscriptions: number;
    activeProjections: number;
  };
}

class MetricsCollector {
  private metrics: EventSystemMetrics = {
    events: { emitted: 0, processed: 0, failed: 0, averageProcessingTime: 0 },
    commands: {
      executed: 0,
      successful: 0,
      failed: 0,
      averageExecutionTime: 0,
    },
    queries: { executed: 0, successful: 0, failed: 0, averageExecutionTime: 0 },
    storage: {
      eventsStored: 0,
      storageSize: 0,
      averageWriteTime: 0,
      averageReadTime: 0,
    },
    system: {
      memoryUsage: 0,
      cpuUsage: 0,
      activeSubscriptions: 0,
      activeProjections: 0,
    },
  };

  recordEventEmitted(processingTime: number): void {
    this.metrics.events.emitted++;
    this.updateAverageProcessingTime(processingTime);
  }

  recordEventProcessed(): void {
    this.metrics.events.processed++;
  }

  recordEventFailed(): void {
    this.metrics.events.failed++;
  }

  recordCommandExecuted(executionTime: number, success: boolean): void {
    this.metrics.commands.executed++;
    if (success) {
      this.metrics.commands.successful++;
    } else {
      this.metrics.commands.failed++;
    }
    this.updateAverageCommandTime(executionTime);
  }

  getMetrics(): EventSystemMetrics {
    // Update system metrics
    const memUsage = process.memoryUsage();
    this.metrics.system.memoryUsage = memUsage.heapUsed;

    return { ...this.metrics };
  }

  private updateAverageProcessingTime(time: number): void {
    const total =
      this.metrics.events.averageProcessingTime *
      (this.metrics.events.emitted - 1);
    this.metrics.events.averageProcessingTime =
      (total + time) / this.metrics.events.emitted;
  }

  private updateAverageCommandTime(time: number): void {
    const total =
      this.metrics.commands.averageExecutionTime *
      (this.metrics.commands.executed - 1);
    this.metrics.commands.averageExecutionTime =
      (total + time) / this.metrics.commands.executed;
  }
}
```

### Health Checks

```typescript
class EventSystemHealthChecker {
  constructor(private eventSystem: NextRushEventSystem) {}

  async checkHealth(): Promise<HealthStatus> {
    const checks = await Promise.allSettled([
      this.checkEventEmitter(),
      this.checkEventStore(),
      this.checkCommandHandlers(),
      this.checkQueryHandlers(),
      this.checkProjections(),
    ]);

    const failures = checks
      .filter(result => result.status === 'rejected')
      .map(result => (result as PromiseRejectedResult).reason);

    return {
      status: failures.length === 0 ? 'healthy' : 'unhealthy',
      checks: {
        eventEmitter: checks[0].status === 'fulfilled',
        eventStore: checks[1].status === 'fulfilled',
        commandHandlers: checks[2].status === 'fulfilled',
        queryHandlers: checks[3].status === 'fulfilled',
        projections: checks[4].status === 'fulfilled',
      },
      failures,
      timestamp: Date.now(),
    };
  }

  private async checkEventEmitter(): Promise<void> {
    const metrics = this.eventSystem.getEmitter().getMetrics();
    if (metrics.errors > metrics.eventsEmitted * 0.1) {
      throw new Error('High error rate in event emitter');
    }
  }

  private async checkEventStore(): Promise<void> {
    try {
      await this.eventSystem.getStore().getEvents({ limit: 1 });
    } catch (error) {
      throw new Error(`Event store check failed: ${error.message}`);
    }
  }

  private async checkCommandHandlers(): Promise<void> {
    // Test command handler registration
    const handlers = this.eventSystem.getCommandHandlers();
    if (handlers.size === 0) {
      throw new Error('No command handlers registered');
    }
  }

  private async checkQueryHandlers(): Promise<void> {
    // Test query handler registration
    const handlers = this.eventSystem.getQueryHandlers();
    if (handlers.size === 0) {
      throw new Error('No query handlers registered');
    }
  }

  private async checkProjections(): Promise<void> {
    const projections = this.eventSystem.getProjections();
    // Check if projections are processing events
    for (const projection of projections.values()) {
      if (!projection.isHealthy()) {
        throw new Error(`Projection ${projection.name} is unhealthy`);
      }
    }
  }
}
```

### Distributed Tracing

```typescript
class TracingEventEmitter extends NextRushEventEmitter {
  async emit<TEvent extends Event>(event: TEvent): Promise<void> {
    const span = tracer.startSpan(`event.emit.${event.type}`);

    try {
      // Add tracing metadata
      const tracedEvent = {
        ...event,
        metadata: {
          ...event.metadata,
          traceId: span.spanContext().traceId,
          spanId: span.spanContext().spanId,
        },
      };

      await super.emit(tracedEvent);

      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      throw error;
    } finally {
      span.end();
    }
  }
}
```

This comprehensive architecture guide provides the foundation for building robust, scalable event-driven applications with NextRush v2. The system supports enterprise-grade requirements with proper separation of concerns, type safety, performance optimization, and comprehensive monitoring capabilities.
