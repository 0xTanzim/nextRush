# NextRush v2 Event System - Testing Guide

## Overview

This comprehensive testing guide provides strategies, patterns, and tools for testing NextRush v2's event-driven architecture. Learn how to write effective unit tests, integration tests, and end-to-end tests for your event-driven applications.

## Table of Contents

- [Testing Philosophy](#testing-philosophy)
- [Test Setup and Configuration](#test-setup-and-configuration)
- [Unit Testing](#unit-testing)
- [Integration Testing](#integration-testing)
- [End-to-End Testing](#end-to-end-testing)
- [Event Sourcing Testing](#event-sourcing-testing)
- [CQRS Testing](#cqrs-testing)
- [Pipeline Testing](#pipeline-testing)
- [Performance Testing](#performance-testing)
- [Error Handling Testing](#error-handling-testing)
- [Test Utilities](#test-utilities)

## Testing Philosophy

### Event-Driven Testing Principles

1. **Test Events, Not Implementation**: Focus on the events your system emits and processes
2. **Verify Side Effects**: Ensure events produce the expected side effects
3. **Test Event Order**: Verify that events are processed in the correct order
4. **Isolate Components**: Use mocks and stubs to isolate components under test
5. **Test Edge Cases**: Cover error conditions, race conditions, and boundary cases

### Testing Pyramid for Event Systems

```
        /\
       /  \  E2E Tests
      /____\ (Event Flows)
     /      \
    /        \ Integration Tests
   /          \ (Event Handlers)
  /__________  \
 /              \  Unit Tests
/________________\ (Individual Components)
```

## Test Setup and Configuration

### Basic Test Environment

```typescript
// tests/setup/test-environment.ts
import { beforeEach, afterEach, vi } from 'vitest';
import type {
  NextRushEventSystem,
  NextRushEventEmitter,
  EventStore,
} from '@/core/events';
import { createTestEventSystem } from './test-helpers';

// Global test setup
beforeEach(() => {
  // Reset time
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));

  // Reset crypto for deterministic IDs
  vi.stubGlobal('crypto', {
    randomUUID: vi.fn(() => 'test-uuid-123'),
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// Test event system factory
export function createTestEventSystem(): {
  eventSystem: NextRushEventSystem;
  emitter: NextRushEventEmitter;
  store: EventStore;
} {
  const emitter = new NextRushEventEmitter({
    maxListeners: 100,
    enablePipelines: true,
    enableMetrics: true,
  });

  const store = new InMemoryEventStore({
    maxEvents: 1000,
    enableMetrics: true,
  });

  const eventSystem = new NextRushEventSystem({
    emitter,
    store,
    enableProjections: true,
  });

  return { eventSystem, emitter, store };
}
```

### Test Helpers and Utilities

```typescript
// tests/helpers/event-test-helpers.ts
import type {
  Event,
  DomainEvent,
  Command,
  Query,
  EventHandler,
} from '@/types/events';

export class EventCapture {
  private capturedEvents: Event[] = [];

  getHandler(): EventHandler {
    return async (event: Event) => {
      this.capturedEvents.push(event);
    };
  }

  getEvents(): Event[] {
    return [...this.capturedEvents];
  }

  getEventsByType<T extends Event>(type: string): T[] {
    return this.capturedEvents.filter(e => e.type === type) as T[];
  }

  getLastEvent(): Event | null {
    return this.capturedEvents[this.capturedEvents.length - 1] || null;
  }

  clear(): void {
    this.capturedEvents = [];
  }

  hasEvent(type: string): boolean {
    return this.capturedEvents.some(e => e.type === type);
  }

  getEventCount(type?: string): number {
    if (type) {
      return this.capturedEvents.filter(e => e.type === type).length;
    }
    return this.capturedEvents.length;
  }
}

export class EventMatcher {
  static toMatch(event: Event, expected: Partial<Event>): boolean {
    return (
      (!expected.type || event.type === expected.type) &&
      (!expected.data || this.deepEqual(event.data, expected.data)) &&
      (!expected.metadata ||
        this.matchMetadata(event.metadata, expected.metadata))
    );
  }

  private static deepEqual(a: any, b: any): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  private static matchMetadata(actual: any, expected: any): boolean {
    return Object.keys(expected).every(key => actual[key] === expected[key]);
  }
}

export function createMockEvent<T extends Event>(
  overrides: Partial<T> = {}
): T {
  return {
    type: 'test.event',
    data: { test: true },
    metadata: {
      id: 'test-event-id',
      timestamp: Date.now(),
      source: 'test',
      version: 1,
    },
    ...overrides,
  } as T;
}

export function createMockCommand<T extends Command>(
  overrides: Partial<T> = {}
): T {
  return {
    type: 'TestCommand',
    data: { test: true },
    metadata: {
      id: 'test-command-id',
      timestamp: Date.now(),
      source: 'test',
      version: 1,
    },
    ...overrides,
  } as T;
}

export function createMockQuery<T extends Query>(
  overrides: Partial<T> = {}
): T {
  return {
    type: 'TestQuery',
    data: { test: true },
    metadata: {
      id: 'test-query-id',
      timestamp: Date.now(),
      source: 'test',
      version: 1,
    },
    ...overrides,
  } as T;
}

export function createMockDomainEvent<T extends DomainEvent>(
  overrides: Partial<T> = {}
): T {
  return {
    type: 'TestDomainEvent',
    data: { test: true },
    aggregateId: 'test-aggregate-id',
    aggregateType: 'TestAggregate',
    aggregateVersion: 1,
    metadata: {
      id: 'test-domain-event-id',
      timestamp: Date.now(),
      source: 'test',
      version: 1,
      domain: 'test-domain',
      boundedContext: 'test-context',
    },
    ...overrides,
  } as T;
}
```

## Unit Testing

### Testing Event Emitter

```typescript
// tests/unit/event-emitter.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRushEventEmitter } from '@/core/events';
import { EventCapture, createMockEvent } from '../helpers/event-test-helpers';

describe('NextRushEventEmitter', () => {
  let emitter: NextRushEventEmitter;
  let eventCapture: EventCapture;

  beforeEach(() => {
    emitter = new NextRushEventEmitter();
    eventCapture = new EventCapture();
  });

  describe('Event Emission', () => {
    it('should emit events to subscribers', async () => {
      // Arrange
      emitter.on('test.event', eventCapture.getHandler());
      const event = createMockEvent({
        type: 'test.event',
        data: { message: 'hello' },
      });

      // Act
      await emitter.emit(event);

      // Assert
      expect(eventCapture.getEventCount()).toBe(1);
      expect(eventCapture.getLastEvent()).toEqual(event);
    });

    it('should emit events to multiple subscribers', async () => {
      // Arrange
      const capture1 = new EventCapture();
      const capture2 = new EventCapture();

      emitter.on('test.event', capture1.getHandler());
      emitter.on('test.event', capture2.getHandler());

      const event = createMockEvent({ type: 'test.event' });

      // Act
      await emitter.emit(event);

      // Assert
      expect(capture1.getEventCount()).toBe(1);
      expect(capture2.getEventCount()).toBe(1);
    });

    it('should not emit to unsubscribed handlers', async () => {
      // Arrange
      const subscription = emitter.on('test.event', eventCapture.getHandler());
      const event = createMockEvent({ type: 'test.event' });

      // Act
      subscription.unsubscribe();
      await emitter.emit(event);

      // Assert
      expect(eventCapture.getEventCount()).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in event handlers', async () => {
      // Arrange
      const errorHandler = vi
        .fn()
        .mockRejectedValue(new Error('Handler error'));
      emitter.on('test.event', errorHandler);

      const event = createMockEvent({ type: 'test.event' });

      // Act & Assert
      await expect(emitter.emit(event)).rejects.toThrow('Handler error');
    });

    it('should continue processing other handlers when one fails', async () => {
      // Arrange
      const errorHandler = vi
        .fn()
        .mockRejectedValue(new Error('Handler error'));
      const successHandler = vi.fn().mockResolvedValue(undefined);

      emitter.on('test.event', errorHandler);
      emitter.on('test.event', successHandler);

      const event = createMockEvent({ type: 'test.event' });

      // Act
      try {
        await emitter.emit(event);
      } catch (error) {
        // Expected to throw
      }

      // Assert
      expect(errorHandler).toHaveBeenCalledWith(event);
      expect(successHandler).toHaveBeenCalledWith(event);
    });
  });

  describe('Performance Metrics', () => {
    it('should track event emission metrics', async () => {
      // Arrange
      emitter = new NextRushEventEmitter({ enableMetrics: true });
      emitter.on('test.event', vi.fn());

      const event = createMockEvent({ type: 'test.event' });

      // Act
      await emitter.emit(event);

      // Assert
      const metrics = emitter.getMetrics();
      expect(metrics.eventsEmitted).toBe(1);
      expect(metrics.subscriptionsActive).toBe(1);
    });

    it('should track processing times', async () => {
      // Arrange
      emitter = new NextRushEventEmitter({ enableMetrics: true });
      const slowHandler = vi
        .fn()
        .mockImplementation(
          () => new Promise(resolve => setTimeout(resolve, 10))
        );

      emitter.on('test.event', slowHandler);
      const event = createMockEvent({ type: 'test.event' });

      // Act
      await emitter.emit(event);

      // Assert
      const metrics = emitter.getMetrics();
      expect(metrics.averageProcessingTime).toBeGreaterThan(0);
    });
  });
});
```

### Testing Event Store

```typescript
// tests/unit/event-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventStore } from '@/core/events';
import {
  createMockEvent,
  createMockDomainEvent,
} from '../helpers/event-test-helpers';

describe('InMemoryEventStore', () => {
  let store: InMemoryEventStore;

  beforeEach(() => {
    store = new InMemoryEventStore({ maxEvents: 1000 });
  });

  describe('Event Storage', () => {
    it('should store single event', async () => {
      // Arrange
      const event = createMockEvent({
        type: 'test.stored',
        data: { value: 42 },
      });

      // Act
      await store.append(event);

      // Assert
      const events = await store.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(event);
    });

    it('should store multiple events', async () => {
      // Arrange
      const events = [
        createMockEvent({ type: 'event.1', data: { id: 1 } }),
        createMockEvent({ type: 'event.2', data: { id: 2 } }),
        createMockEvent({ type: 'event.3', data: { id: 3 } }),
      ];

      // Act
      await store.appendMany(events);

      // Assert
      const storedEvents = await store.getEvents();
      expect(storedEvents).toHaveLength(3);
      expect(storedEvents).toEqual(events);
    });

    it('should maintain event order', async () => {
      // Arrange
      const events = Array.from({ length: 10 }, (_, i) =>
        createMockEvent({
          type: 'ordered.event',
          data: { sequence: i },
          metadata: {
            id: `event-${i}`,
            timestamp: Date.now() + i,
            source: 'test',
            version: 1,
          },
        })
      );

      // Act
      for (const event of events) {
        await store.append(event);
      }

      // Assert
      const storedEvents = await store.getEvents();
      expect(storedEvents.map(e => e.data.sequence)).toEqual([
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
      ]);
    });
  });

  describe('Event Querying', () => {
    beforeEach(async () => {
      // Setup test data
      const events = [
        createMockEvent({
          type: 'user.created',
          data: { userId: '1', email: 'user1@test.com' },
          metadata: { id: '1', timestamp: 1000, source: 'test', version: 1 },
        }),
        createMockEvent({
          type: 'user.updated',
          data: { userId: '1', name: 'Updated Name' },
          metadata: { id: '2', timestamp: 2000, source: 'test', version: 1 },
        }),
        createMockEvent({
          type: 'user.created',
          data: { userId: '2', email: 'user2@test.com' },
          metadata: { id: '3', timestamp: 3000, source: 'test', version: 1 },
        }),
      ];

      await store.appendMany(events);
    });

    it('should filter events by type', async () => {
      // Act
      const createdEvents = await store.getEventsByType('user.created');

      // Assert
      expect(createdEvents).toHaveLength(2);
      expect(createdEvents.every(e => e.type === 'user.created')).toBe(true);
    });

    it('should filter events by timestamp range', async () => {
      // Act
      const events = await store.getEvents({
        fromTimestamp: 1500,
        toTimestamp: 2500,
      });

      // Assert
      expect(events).toHaveLength(1);
      expect(events[0].metadata.timestamp).toBe(2000);
    });

    it('should apply limit and offset', async () => {
      // Act
      const events = await store.getEvents({
        limit: 2,
        offset: 1,
      });

      // Assert
      expect(events).toHaveLength(2);
      expect(events[0].metadata.id).toBe('2');
      expect(events[1].metadata.id).toBe('3');
    });
  });

  describe('Domain Events', () => {
    it('should store and retrieve domain events', async () => {
      // Arrange
      const domainEvents = [
        createMockDomainEvent({
          type: 'UserCreated',
          aggregateId: 'user-1',
          aggregateType: 'User',
          aggregateVersion: 1,
          data: { email: 'test@example.com' },
        }),
        createMockDomainEvent({
          type: 'UserUpdated',
          aggregateId: 'user-1',
          aggregateType: 'User',
          aggregateVersion: 2,
          data: { name: 'Updated Name' },
        }),
      ];

      // Act
      await store.appendDomainEvents('User', 'user-1', domainEvents);

      // Assert
      const aggregateEvents = await store.getAggregateEvents('User', 'user-1');
      expect(aggregateEvents).toHaveLength(2);
      expect(aggregateEvents[0].aggregateVersion).toBe(1);
      expect(aggregateEvents[1].aggregateVersion).toBe(2);
    });

    it('should get events by domain', async () => {
      // Arrange
      const domainEvent = createMockDomainEvent({
        type: 'TestDomainEvent',
        metadata: {
          id: 'domain-event',
          timestamp: Date.now(),
          source: 'test',
          version: 1,
          domain: 'test-domain',
          boundedContext: 'test-context',
        },
      });

      await store.appendDomainEvents('Test', 'test-1', [domainEvent]);

      // Act
      const domainEvents = await store.getDomainEvents('test-domain');

      // Assert
      expect(domainEvents).toHaveLength(1);
      expect(domainEvents[0].metadata.domain).toBe('test-domain');
    });
  });
});
```

### Testing CQRS Components

```typescript
// tests/unit/event-system-cqrs.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRushEventSystem } from '@/core/events';
import { createTestEventSystem } from '../setup/test-environment';
import {
  createMockCommand,
  createMockQuery,
  EventCapture,
} from '../helpers/event-test-helpers';

describe('NextRushEventSystem CQRS', () => {
  let eventSystem: NextRushEventSystem;
  let eventCapture: EventCapture;

  beforeEach(() => {
    ({ eventSystem } = createTestEventSystem());
    eventCapture = new EventCapture();
  });

  describe('Command Handling', () => {
    it('should register and execute command handlers', async () => {
      // Arrange
      const commandHandler = vi
        .fn()
        .mockResolvedValue({ success: true, id: 'result-1' });
      eventSystem.registerCommandHandler('TestCommand', commandHandler);

      const command = createMockCommand({
        type: 'TestCommand',
        data: { action: 'create', payload: { name: 'test' } },
      });

      // Act
      const result = await eventSystem.executeCommand(command);

      // Assert
      expect(commandHandler).toHaveBeenCalledWith(command);
      expect(result).toEqual({ success: true, id: 'result-1' });
    });

    it('should throw error for unregistered command', async () => {
      // Arrange
      const command = createMockCommand({ type: 'UnregisteredCommand' });

      // Act & Assert
      await expect(eventSystem.executeCommand(command)).rejects.toThrow(
        'No handler registered'
      );
    });

    it('should handle command execution errors', async () => {
      // Arrange
      const commandHandler = vi
        .fn()
        .mockRejectedValue(new Error('Command failed'));
      eventSystem.registerCommandHandler('FailingCommand', commandHandler);

      const command = createMockCommand({ type: 'FailingCommand' });

      // Act & Assert
      await expect(eventSystem.executeCommand(command)).rejects.toThrow(
        'Command failed'
      );
    });
  });

  describe('Query Handling', () => {
    it('should register and execute query handlers', async () => {
      // Arrange
      const queryHandler = vi
        .fn()
        .mockResolvedValue([{ id: '1', name: 'Item 1' }]);
      eventSystem.registerQueryHandler('TestQuery', queryHandler);

      const query = createMockQuery({
        type: 'TestQuery',
        data: { filter: { active: true } },
      });

      // Act
      const result = await eventSystem.executeQuery(query);

      // Assert
      expect(queryHandler).toHaveBeenCalledWith(query);
      expect(result).toEqual([{ id: '1', name: 'Item 1' }]);
    });

    it('should handle query execution timeouts', async () => {
      // Arrange
      const slowQueryHandler = vi
        .fn()
        .mockImplementation(
          () => new Promise(resolve => setTimeout(resolve, 1000))
        );

      eventSystem.registerQueryHandler('SlowQuery', slowQueryHandler);

      const query = createMockQuery({
        type: 'SlowQuery',
        metadata: {
          id: 'slow-query',
          timestamp: Date.now(),
          source: 'test',
          version: 1,
          timeout: 100, // 100ms timeout
        },
      });

      // Act & Assert
      await expect(eventSystem.executeQuery(query)).rejects.toThrow('timeout');
    });
  });

  describe('Event Sourcing Integration', () => {
    it('should reconstruct aggregate from events', async () => {
      // Arrange
      const domainEvents = [
        {
          type: 'UserCreated',
          data: { email: 'test@example.com', name: 'Test User' },
          aggregateId: 'user-1',
          aggregateType: 'User',
          aggregateVersion: 1,
          metadata: {
            id: 'evt-1',
            timestamp: Date.now(),
            source: 'test',
            version: 1,
            domain: 'user-management',
            boundedContext: 'identity',
          },
        },
        {
          type: 'UserUpdated',
          data: { name: 'Updated User' },
          aggregateId: 'user-1',
          aggregateType: 'User',
          aggregateVersion: 2,
          metadata: {
            id: 'evt-2',
            timestamp: Date.now(),
            source: 'test',
            version: 1,
            domain: 'user-management',
            boundedContext: 'identity',
          },
        },
      ];

      await eventSystem
        .getStore()
        .appendDomainEvents('User', 'user-1', domainEvents);

      // Act
      const aggregate = await eventSystem.reconstructAggregate(
        'User',
        'user-1'
      );

      // Assert
      expect(aggregate).toBeDefined();
      expect(aggregate.events).toHaveLength(2);
      expect(aggregate.version).toBe(2);
    });

    it('should get aggregate version', async () => {
      // Arrange
      const domainEvent = {
        type: 'UserCreated',
        data: { email: 'test@example.com' },
        aggregateId: 'user-1',
        aggregateType: 'User',
        aggregateVersion: 5,
        metadata: {
          id: 'evt-1',
          timestamp: Date.now(),
          source: 'test',
          version: 1,
          domain: 'user-management',
          boundedContext: 'identity',
        },
      };

      await eventSystem
        .getStore()
        .appendDomainEvents('User', 'user-1', [domainEvent]);

      // Act
      const version = await eventSystem.getAggregateVersion('User', 'user-1');

      // Assert
      expect(version).toBe(5);
    });
  });
});
```

## Integration Testing

### Testing Event Flows

```typescript
// tests/integration/event-flows.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestEventSystem } from '../setup/test-environment';
import { EventCapture } from '../helpers/event-test-helpers';

describe('Event Flow Integration', () => {
  let eventSystem: NextRushEventSystem;
  let eventCapture: EventCapture;

  beforeEach(() => {
    ({ eventSystem } = createTestEventSystem());
    eventCapture = new EventCapture();
  });

  describe('User Registration Flow', () => {
    it('should complete full user registration flow', async () => {
      // Arrange - Setup handlers
      const registrationCapture = new EventCapture();
      const activationCapture = new EventCapture();
      const emailCapture = new EventCapture();

      eventSystem
        .getEmitter()
        .on('UserRegistered', registrationCapture.getHandler());
      eventSystem
        .getEmitter()
        .on('UserActivated', activationCapture.getHandler());
      eventSystem
        .getEmitter()
        .on('WelcomeEmailSent', emailCapture.getHandler());

      // Register command handlers
      eventSystem.registerCommandHandler('RegisterUser', async command => {
        const user = {
          id: 'user-123',
          email: command.data.email,
          name: command.data.name,
          status: 'pending_activation',
        };

        // Emit user registered event
        await eventSystem.emit({
          type: 'UserRegistered',
          data: user,
          metadata: {
            id: 'evt-registered',
            timestamp: Date.now(),
            source: 'user-service',
            version: 1,
          },
        });

        return user;
      });

      eventSystem.registerCommandHandler('ActivateUser', async command => {
        // Emit user activated event
        await eventSystem.emit({
          type: 'UserActivated',
          data: { userId: command.data.userId, activatedAt: Date.now() },
          metadata: {
            id: 'evt-activated',
            timestamp: Date.now(),
            source: 'user-service',
            version: 1,
          },
        });

        return { success: true };
      });

      // Setup event handlers for side effects
      eventSystem.getEmitter().on('UserRegistered', async event => {
        // Send welcome email
        await eventSystem.emit({
          type: 'WelcomeEmailSent',
          data: {
            userId: event.data.id,
            email: event.data.email,
            sentAt: Date.now(),
          },
          metadata: {
            id: 'evt-email-sent',
            timestamp: Date.now(),
            source: 'email-service',
            version: 1,
          },
        });
      });

      // Act - Execute flow
      const user = await eventSystem.executeCommand({
        type: 'RegisterUser',
        data: { email: 'test@example.com', name: 'Test User' },
        metadata: {
          id: 'cmd-register',
          timestamp: Date.now(),
          source: 'web-app',
          version: 1,
        },
      });

      await eventSystem.executeCommand({
        type: 'ActivateUser',
        data: { userId: user.id },
        metadata: {
          id: 'cmd-activate',
          timestamp: Date.now(),
          source: 'admin-panel',
          version: 1,
        },
      });

      // Wait for async events to process
      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert - Verify complete flow
      expect(registrationCapture.getEventCount()).toBe(1);
      expect(activationCapture.getEventCount()).toBe(1);
      expect(emailCapture.getEventCount()).toBe(1);

      const registeredEvent = registrationCapture.getLastEvent();
      expect(registeredEvent?.data.email).toBe('test@example.com');

      const activatedEvent = activationCapture.getLastEvent();
      expect(activatedEvent?.data.userId).toBe('user-123');

      const emailEvent = emailCapture.getLastEvent();
      expect(emailEvent?.data.email).toBe('test@example.com');
    });
  });

  describe('Order Processing Saga', () => {
    it('should handle order placement saga with compensation', async () => {
      // Arrange - Capture events
      const orderCapture = new EventCapture();
      const inventoryCapture = new EventCapture();
      const paymentCapture = new EventCapture();
      const compensationCapture = new EventCapture();

      eventSystem.getEmitter().on('OrderPlaced', orderCapture.getHandler());
      eventSystem
        .getEmitter()
        .on('InventoryReserved', inventoryCapture.getHandler());
      eventSystem.getEmitter().on('PaymentFailed', paymentCapture.getHandler());
      eventSystem
        .getEmitter()
        .on('OrderCompensated', compensationCapture.getHandler());

      // Mock services
      let shouldPaymentFail = false;

      // Setup saga handlers
      eventSystem.getEmitter().on('OrderPlaced', async event => {
        // Step 1: Reserve inventory
        await eventSystem.emit({
          type: 'InventoryReserved',
          data: { orderId: event.data.orderId, items: event.data.items },
          metadata: {
            id: 'evt-inventory-reserved',
            timestamp: Date.now(),
            source: 'inventory-service',
            version: 1,
          },
        });
      });

      eventSystem.getEmitter().on('InventoryReserved', async event => {
        // Step 2: Process payment
        if (shouldPaymentFail) {
          await eventSystem.emit({
            type: 'PaymentFailed',
            data: { orderId: event.data.orderId, error: 'Insufficient funds' },
            metadata: {
              id: 'evt-payment-failed',
              timestamp: Date.now(),
              source: 'payment-service',
              version: 1,
            },
          });
        }
      });

      eventSystem.getEmitter().on('PaymentFailed', async event => {
        // Compensation: Release inventory
        await eventSystem.emit({
          type: 'OrderCompensated',
          data: { orderId: event.data.orderId, reason: 'Payment failed' },
          metadata: {
            id: 'evt-order-compensated',
            timestamp: Date.now(),
            source: 'order-service',
            version: 1,
          },
        });
      });

      // Act - Start saga with failing payment
      shouldPaymentFail = true;

      await eventSystem.emit({
        type: 'OrderPlaced',
        data: {
          orderId: 'order-123',
          customerId: 'customer-456',
          items: [{ productId: 'product-1', quantity: 2, price: 29.99 }],
          total: 59.98,
        },
        metadata: {
          id: 'evt-order-placed',
          timestamp: Date.now(),
          source: 'order-service',
          version: 1,
        },
      });

      // Wait for saga to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      // Assert - Verify compensation occurred
      expect(orderCapture.getEventCount()).toBe(1);
      expect(inventoryCapture.getEventCount()).toBe(1);
      expect(paymentCapture.getEventCount()).toBe(1);
      expect(compensationCapture.getEventCount()).toBe(1);

      const compensationEvent = compensationCapture.getLastEvent();
      expect(compensationEvent?.data.reason).toBe('Payment failed');
    });
  });
});
```

### Testing Projections

```typescript
// tests/integration/projections.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestEventSystem } from '../setup/test-environment';

interface UserView {
  id: string;
  email: string;
  name: string;
  status: string;
  createdAt: number;
  updatedAt: number;
}

describe('Event Projections Integration', () => {
  let eventSystem: NextRushEventSystem;
  let userViews: Map<string, UserView>;

  beforeEach(() => {
    ({ eventSystem } = createTestEventSystem());
    userViews = new Map();
  });

  it('should maintain user view projection', async () => {
    // Arrange - Setup projection
    eventSystem.createProjection('user-view', {
      events: ['UserCreated', 'UserUpdated', 'UserActivated'],
      handler: async (event, projection) => {
        switch (event.type) {
          case 'UserCreated':
            userViews.set(event.data.id, {
              id: event.data.id,
              email: event.data.email,
              name: event.data.name,
              status: 'inactive',
              createdAt: event.metadata.timestamp,
              updatedAt: event.metadata.timestamp,
            });
            break;

          case 'UserUpdated':
            const existingUser = userViews.get(event.data.id);
            if (existingUser) {
              userViews.set(event.data.id, {
                ...existingUser,
                ...event.data.changes,
                updatedAt: event.metadata.timestamp,
              });
            }
            break;

          case 'UserActivated':
            const userToActivate = userViews.get(event.data.userId);
            if (userToActivate) {
              userViews.set(event.data.userId, {
                ...userToActivate,
                status: 'active',
                updatedAt: event.metadata.timestamp,
              });
            }
            break;
        }
      },
    });

    // Act - Emit events
    await eventSystem.emit({
      type: 'UserCreated',
      data: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
      metadata: { id: 'evt-1', timestamp: 1000, source: 'test', version: 1 },
    });

    await eventSystem.emit({
      type: 'UserUpdated',
      data: { id: 'user-1', changes: { name: 'Updated User' } },
      metadata: { id: 'evt-2', timestamp: 2000, source: 'test', version: 1 },
    });

    await eventSystem.emit({
      type: 'UserActivated',
      data: { userId: 'user-1', activatedAt: 3000 },
      metadata: { id: 'evt-3', timestamp: 3000, source: 'test', version: 1 },
    });

    // Wait for projections to process
    await new Promise(resolve => setTimeout(resolve, 10));

    // Assert - Check projection state
    const userView = userViews.get('user-1');
    expect(userView).toBeDefined();
    expect(userView?.email).toBe('test@example.com');
    expect(userView?.name).toBe('Updated User');
    expect(userView?.status).toBe('active');
    expect(userView?.createdAt).toBe(1000);
    expect(userView?.updatedAt).toBe(3000);
  });

  it('should handle projection replay', async () => {
    // Arrange - Emit events before setting up projection
    await eventSystem.emit({
      type: 'UserCreated',
      data: { id: 'user-1', email: 'test1@example.com', name: 'User 1' },
      metadata: { id: 'evt-1', timestamp: 1000, source: 'test', version: 1 },
    });

    await eventSystem.emit({
      type: 'UserCreated',
      data: { id: 'user-2', email: 'test2@example.com', name: 'User 2' },
      metadata: { id: 'evt-2', timestamp: 2000, source: 'test', version: 1 },
    });

    // Act - Setup projection (should replay existing events)
    eventSystem.createProjection('user-count', {
      events: ['UserCreated'],
      handler: async (event, projection) => {
        const currentCount = userViews.get('count')?.id || '0';
        const newCount = parseInt(currentCount) + 1;
        userViews.set('count', { id: newCount.toString() } as UserView);
      },
      replay: true,
    });

    // Wait for replay to complete
    await new Promise(resolve => setTimeout(resolve, 50));

    // Assert - Check that existing events were replayed
    const count = userViews.get('count');
    expect(count?.id).toBe('2');
  });
});
```

## End-to-End Testing

### Complete Application Testing

```typescript
// tests/e2e/user-management-e2e.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestEventSystem } from '../setup/test-environment';
import { EventCapture } from '../helpers/event-test-helpers';

// Simulate complete user management application
class UserManagementApp {
  private users = new Map<string, any>();
  private userProfiles = new Map<string, any>();
  private emailService = new MockEmailService();

  constructor(private eventSystem: NextRushEventSystem) {
    this.setupCommandHandlers();
    this.setupQueryHandlers();
    this.setupEventHandlers();
  }

  private setupCommandHandlers(): void {
    this.eventSystem.registerCommandHandler('RegisterUser', async command => {
      const userId = crypto.randomUUID();
      const user = {
        id: userId,
        email: command.data.email,
        name: command.data.name,
        status: 'pending_verification',
        createdAt: Date.now(),
      };

      this.users.set(userId, user);

      await this.eventSystem.emit({
        type: 'UserRegistered',
        data: user,
        metadata: {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          source: 'user-service',
          version: 1,
        },
      });

      return user;
    });

    this.eventSystem.registerCommandHandler('VerifyUser', async command => {
      const user = this.users.get(command.data.userId);
      if (!user) throw new Error('User not found');

      const updatedUser = { ...user, status: 'active', verifiedAt: Date.now() };
      this.users.set(command.data.userId, updatedUser);

      await this.eventSystem.emit({
        type: 'UserVerified',
        data: {
          userId: command.data.userId,
          verifiedAt: updatedUser.verifiedAt,
        },
        metadata: {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          source: 'user-service',
          version: 1,
        },
      });

      return updatedUser;
    });
  }

  private setupQueryHandlers(): void {
    this.eventSystem.registerQueryHandler('GetUser', async query => {
      return this.users.get(query.data.userId) || null;
    });

    this.eventSystem.registerQueryHandler('GetUserStats', async () => {
      const totalUsers = this.users.size;
      const activeUsers = Array.from(this.users.values()).filter(
        u => u.status === 'active'
      ).length;

      return {
        totalUsers,
        activeUsers,
        pendingUsers: totalUsers - activeUsers,
      };
    });
  }

  private setupEventHandlers(): void {
    this.eventSystem.getEmitter().on('UserRegistered', async event => {
      // Send verification email
      await this.emailService.sendVerificationEmail(
        event.data.email,
        event.data.id
      );

      await this.eventSystem.emit({
        type: 'VerificationEmailSent',
        data: {
          userId: event.data.id,
          email: event.data.email,
          sentAt: Date.now(),
        },
        metadata: {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          source: 'email-service',
          version: 1,
        },
      });
    });

    this.eventSystem.getEmitter().on('UserVerified', async event => {
      // Create user profile
      const profile = {
        userId: event.data.userId,
        bio: '',
        avatar: null,
        preferences: { theme: 'light', notifications: true },
        createdAt: Date.now(),
      };

      this.userProfiles.set(event.data.userId, profile);

      await this.eventSystem.emit({
        type: 'UserProfileCreated',
        data: profile,
        metadata: {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          source: 'profile-service',
          version: 1,
        },
      });

      // Send welcome email
      const user = this.users.get(event.data.userId);
      if (user) {
        await this.emailService.sendWelcomeEmail(user.email, user.name);

        await this.eventSystem.emit({
          type: 'WelcomeEmailSent',
          data: {
            userId: event.data.userId,
            email: user.email,
            sentAt: Date.now(),
          },
          metadata: {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            source: 'email-service',
            version: 1,
          },
        });
      }
    });
  }
}

class MockEmailService {
  public sentEmails: Array<{ type: string; email: string; data?: any }> = [];

  async sendVerificationEmail(email: string, userId: string): Promise<void> {
    this.sentEmails.push({ type: 'verification', email, data: { userId } });
  }

  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    this.sentEmails.push({ type: 'welcome', email, data: { name } });
  }
}

describe('User Management E2E', () => {
  let app: UserManagementApp;
  let eventSystem: NextRushEventSystem;
  let eventCapture: EventCapture;

  beforeEach(() => {
    ({ eventSystem } = createTestEventSystem());
    app = new UserManagementApp(eventSystem);
    eventCapture = new EventCapture();

    // Capture all events
    eventSystem.getEmitter().on('*', eventCapture.getHandler());
  });

  it('should handle complete user registration and verification flow', async () => {
    // Act - Register user
    const user = await eventSystem.executeCommand({
      type: 'RegisterUser',
      data: { email: 'test@example.com', name: 'Test User' },
      metadata: {
        id: 'cmd-register',
        timestamp: Date.now(),
        source: 'web-app',
        version: 1,
      },
    });

    // Wait for async events
    await new Promise(resolve => setTimeout(resolve, 50));

    // Verify user
    const verifiedUser = await eventSystem.executeCommand({
      type: 'VerifyUser',
      data: { userId: user.id },
      metadata: {
        id: 'cmd-verify',
        timestamp: Date.now(),
        source: 'web-app',
        version: 1,
      },
    });

    // Wait for async events
    await new Promise(resolve => setTimeout(resolve, 50));

    // Query user stats
    const stats = await eventSystem.executeQuery({
      type: 'GetUserStats',
      data: {},
      metadata: {
        id: 'qry-stats',
        timestamp: Date.now(),
        source: 'admin-panel',
        version: 1,
      },
    });

    // Assert - Verify complete flow
    expect(user.id).toBeDefined();
    expect(user.email).toBe('test@example.com');
    expect(user.status).toBe('pending_verification');

    expect(verifiedUser.status).toBe('active');
    expect(verifiedUser.verifiedAt).toBeDefined();

    expect(stats.totalUsers).toBe(1);
    expect(stats.activeUsers).toBe(1);
    expect(stats.pendingUsers).toBe(0);

    // Verify events were emitted in correct order
    const events = eventCapture.getEvents();
    const eventTypes = events.map(e => e.type);

    expect(eventTypes).toContain('UserRegistered');
    expect(eventTypes).toContain('VerificationEmailSent');
    expect(eventTypes).toContain('UserVerified');
    expect(eventTypes).toContain('UserProfileCreated');
    expect(eventTypes).toContain('WelcomeEmailSent');

    // Verify emails were sent
    expect(app.emailService.sentEmails).toHaveLength(2);
    expect(app.emailService.sentEmails[0].type).toBe('verification');
    expect(app.emailService.sentEmails[1].type).toBe('welcome');
  });

  it('should handle multiple users and maintain accurate statistics', async () => {
    // Act - Register multiple users
    const users = await Promise.all([
      eventSystem.executeCommand({
        type: 'RegisterUser',
        data: { email: 'user1@example.com', name: 'User 1' },
        metadata: {
          id: 'cmd-1',
          timestamp: Date.now(),
          source: 'test',
          version: 1,
        },
      }),
      eventSystem.executeCommand({
        type: 'RegisterUser',
        data: { email: 'user2@example.com', name: 'User 2' },
        metadata: {
          id: 'cmd-2',
          timestamp: Date.now(),
          source: 'test',
          version: 1,
        },
      }),
      eventSystem.executeCommand({
        type: 'RegisterUser',
        data: { email: 'user3@example.com', name: 'User 3' },
        metadata: {
          id: 'cmd-3',
          timestamp: Date.now(),
          source: 'test',
          version: 1,
        },
      }),
    ]);

    // Verify only the first two users
    await eventSystem.executeCommand({
      type: 'VerifyUser',
      data: { userId: users[0].id },
      metadata: {
        id: 'cmd-verify-1',
        timestamp: Date.now(),
        source: 'test',
        version: 1,
      },
    });

    await eventSystem.executeCommand({
      type: 'VerifyUser',
      data: { userId: users[1].id },
      metadata: {
        id: 'cmd-verify-2',
        timestamp: Date.now(),
        source: 'test',
        version: 1,
      },
    });

    // Wait for all events to process
    await new Promise(resolve => setTimeout(resolve, 100));

    // Query final stats
    const stats = await eventSystem.executeQuery({
      type: 'GetUserStats',
      data: {},
      metadata: {
        id: 'qry-final-stats',
        timestamp: Date.now(),
        source: 'test',
        version: 1,
      },
    });

    // Assert
    expect(stats.totalUsers).toBe(3);
    expect(stats.activeUsers).toBe(2);
    expect(stats.pendingUsers).toBe(1);

    // Verify correct number of emails sent (2 verification + 2 welcome)
    expect(app.emailService.sentEmails).toHaveLength(6); // 3 verification + 3 welcome attempts, but only 2 welcome should succeed
  });
});
```

This comprehensive testing guide provides everything needed to thoroughly test NextRush v2's event-driven architecture, from individual components to complete application flows, ensuring robust and reliable event-driven systems.
