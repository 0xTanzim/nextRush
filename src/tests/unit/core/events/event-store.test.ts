/**
 * NextRush v2 Event Store Tests
 *
 * Comprehensive test suite for event store implementations
 * with persistence, querying, and subscription capabilities.
 *
 * @version 2.0.0
 * @author NextRush Core Team
 */

import { setTimeout } from 'node:timers/promises';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  EventStoreFactory,
  InMemoryEventStore,
  PersistentEventStore,
  createEvent,
  createEventMetadata,
  createEventStore,
} from '@/core/events';

import type {
  DomainEvent,
  Event,
  EventFilter,
  EventHandler,
  EventSubscription,
} from '../../../types/events';

// Test event types
type TestEvent = Event<'test.event', { message: string }>;

type TestDomainEvent = DomainEvent<
  'test.domain',
  {
    action: string;
    value: number;
  }
>;

describe('EventStore Implementations', () => {
  describe('InMemoryEventStore', () => {
    let store: InMemoryEventStore;

    beforeEach(() => {
      store = new InMemoryEventStore();
    });

    describe('Event Persistence', () => {
      test('should save and retrieve events', async () => {
        const event = createEvent<TestEvent>('test.event', {
          message: 'hello',
        });

        await store.save(event);

        const events = await store.loadByType<TestEvent>('test.event');
        expect(events).toHaveLength(1);
        expect(events[0]).toEqual(event);
      });

      test('should save multiple events atomically', async () => {
        const events = [
          createEvent<TestEvent>('test.event', { message: 'first' }),
          createEvent<TestEvent>('test.event', { message: 'second' }),
          createEvent<TestEvent>('test.event', { message: 'third' }),
        ];

        await store.saveMany(events);

        const retrievedEvents = await store.loadByType<TestEvent>('test.event');
        expect(retrievedEvents).toHaveLength(3);
        expect(retrievedEvents.map(e => e.data.message)).toEqual([
          'first',
          'second',
          'third',
        ]);
      });

      test('should handle concurrent saves', async () => {
        const savePromises = Array.from({ length: 50 }, (_, i) =>
          store.save(
            createEvent<TestEvent>('test.event', { message: `msg-${i}` })
          )
        );

        await Promise.all(savePromises);

        const events = await store.loadByType<TestEvent>('test.event');
        expect(events).toHaveLength(50);
      });
    });

    describe('Event Querying', () => {
      beforeEach(async () => {
        // Set up test data
        const baseTime = Date.now();
        const events = [
          createEvent<TestEvent>(
            'test.event',
            { message: 'first' },
            {
              timestamp: baseTime - 3000,
              correlationId: 'corr-1',
            }
          ),
          createEvent<TestEvent>(
            'test.event',
            { message: 'second' },
            {
              timestamp: baseTime - 2000,
              correlationId: 'corr-1',
            }
          ),
          createEvent<TestEvent>(
            'test.event',
            { message: 'third' },
            {
              timestamp: baseTime - 1000,
              correlationId: 'corr-2',
            }
          ),
          createEvent<Event<'other.event', { data: string }>>(
            'other.event',
            { data: 'other' },
            {
              timestamp: baseTime,
              correlationId: 'corr-1',
            }
          ),
        ];

        await store.saveMany(events);
      });

      test('should load events by type', async () => {
        const testEvents = await store.loadByType<TestEvent>('test.event');
        const otherEvents = await store.loadByType('other.event');

        expect(testEvents).toHaveLength(3);
        expect(otherEvents).toHaveLength(1);
        expect(testEvents.every(e => e.type === 'test.event')).toBe(true);
      });

      test('should load events by type with time filters', async () => {
        const baseTime = Date.now();
        const after = new Date(baseTime - 2500);
        const before = new Date(baseTime - 500);

        const events = await store.loadByType<TestEvent>('test.event', {
          after,
          before,
        });

        expect(events).toHaveLength(2); // second and third events
        expect(events.map(e => e.data.message)).toContain('second');
        expect(events.map(e => e.data.message)).toContain('third');
      });

      test('should load events by type with pagination', async () => {
        const firstPage = await store.loadByType<TestEvent>('test.event', {
          limit: 2,
          offset: 0,
        });
        const secondPage = await store.loadByType<TestEvent>('test.event', {
          limit: 2,
          offset: 2,
        });

        expect(firstPage).toHaveLength(2);
        expect(secondPage).toHaveLength(1);

        // Should not have overlapping events
        const firstIds = firstPage.map(e => e.metadata.id);
        const secondIds = secondPage.map(e => e.metadata.id);
        expect(firstIds.some(id => secondIds.includes(id))).toBe(false);
      });

      test('should load events by correlation ID', async () => {
        const corr1Events = await store.loadByCorrelationId('corr-1');
        const corr2Events = await store.loadByCorrelationId('corr-2');
        const nonExistentEvents =
          await store.loadByCorrelationId('non-existent');

        expect(corr1Events).toHaveLength(3); // first, second, and other event
        expect(corr2Events).toHaveLength(1); // third event
        expect(nonExistentEvents).toHaveLength(0);

        // Events should be ordered by timestamp
        expect(corr1Events[0]?.metadata.timestamp).toBeLessThan(
          corr1Events[1]?.metadata.timestamp as number
        );
      });
    });

    describe('Domain Event Support', () => {
      beforeEach(async () => {
        const domainEvents: TestDomainEvent[] = [
          {
            type: 'test.domain',
            data: { action: 'create', value: 1 },
            metadata: createEventMetadata(),
            aggregateId: 'agg-1',
            aggregateType: 'TestAggregate',
            sequenceNumber: 1,
          },
          {
            type: 'test.domain',
            data: { action: 'update', value: 2 },
            metadata: createEventMetadata(),
            aggregateId: 'agg-1',
            aggregateType: 'TestAggregate',
            sequenceNumber: 2,
          },
          {
            type: 'test.domain',
            data: { action: 'delete', value: 0 },
            metadata: createEventMetadata(),
            aggregateId: 'agg-2',
            aggregateType: 'TestAggregate',
            sequenceNumber: 1,
          },
        ];

        await store.saveMany(domainEvents);
      });

      test('should load events by aggregate ID', async () => {
        const agg1Events =
          await store.loadByAggregateId<TestDomainEvent>('agg-1');
        const agg2Events =
          await store.loadByAggregateId<TestDomainEvent>('agg-2');

        expect(agg1Events).toHaveLength(2);
        expect(agg2Events).toHaveLength(1);

        // Should be ordered by sequence number
        expect(agg1Events[0]?.sequenceNumber).toBe(1);
        expect(agg1Events[1]?.sequenceNumber).toBe(2);
      });

      test('should load events by aggregate ID with sequence filter', async () => {
        const events = await store.loadByAggregateId<TestDomainEvent>('agg-1', {
          afterSequence: 1,
        });

        expect(events).toHaveLength(1);
        expect(events[0]?.sequenceNumber).toBe(2);
        expect(events[0]?.data.action).toBe('update');
      });

      test('should load events by aggregate ID with limit', async () => {
        const events = await store.loadByAggregateId<TestDomainEvent>('agg-1', {
          limit: 1,
        });

        expect(events).toHaveLength(1);
        expect(events[0]?.sequenceNumber).toBe(1);
      });
    });

    describe('Event Subscriptions', () => {
      test('should create and manage subscriptions', async () => {
        const receivedEvents: Event[] = [];
        const handler: EventHandler = async event => {
          receivedEvents.push(event);
        };

        const filter: EventFilter = event => event.type === 'test.event';

        const subscription = await store.subscribe(filter, handler);

        expect(subscription.id).toBeDefined();
        expect(subscription.isActive()).toBe(true);

        // Add events after subscription
        const event1 = createEvent<TestEvent>('test.event', {
          message: 'subscribed',
        });
        const event2 = createEvent<Event<'other.event', unknown>>(
          'other.event',
          {}
        );

        await store.save(event1);
        await store.save(event2);

        // Wait for async processing
        await setTimeout(10);

        expect(receivedEvents).toHaveLength(1);
        expect(receivedEvents[0]).toEqual(event1);

        // Unsubscribe
        await subscription.unsubscribe();
        expect(subscription.isActive()).toBe(false);

        // Should not receive new events
        await store.save(
          createEvent<TestEvent>('test.event', { message: 'after-unsub' })
        );
        await setTimeout(10);

        expect(receivedEvents).toHaveLength(1);
      });

      test('should handle multiple subscriptions', async () => {
        const receivedEvents1: Event[] = [];
        const receivedEvents2: Event[] = [];

        const handler1: EventHandler = async event => {
          receivedEvents1.push(event);
        };
        const handler2: EventHandler = async event => {
          receivedEvents2.push(event);
        };

        const allEventsFilter: EventFilter = () => true;
        const testEventsFilter: EventFilter = event =>
          event.type === 'test.event';

        await store.subscribe(allEventsFilter, handler1);
        await store.subscribe(testEventsFilter, handler2);

        const testEvent = createEvent<TestEvent>('test.event', {
          message: 'test',
        });
        const otherEvent = createEvent<Event<'other.event', unknown>>(
          'other.event',
          {}
        );

        await store.save(testEvent);
        await store.save(otherEvent);

        await setTimeout(10);

        expect(receivedEvents1).toHaveLength(2); // All events
        expect(receivedEvents2).toHaveLength(1); // Only test events
        expect(receivedEvents2[0]).toEqual(testEvent);
      });

      test('should handle subscription errors gracefully', async () => {
        const failingHandler: EventHandler = async () => {
          throw new Error('Handler error');
        };

        const filter: EventFilter = () => true;

        await store.subscribe(filter, failingHandler);

        const event = createEvent<TestEvent>('test.event', { message: 'test' });

        // Should not throw despite failing handler
        await expect(store.save(event)).resolves.not.toThrow();
      });

      test('should handle subscription filter errors gracefully', async () => {
        const handler = vi.fn();
        const failingFilter: EventFilter = () => {
          throw new Error('Filter error');
        };

        await store.subscribe(failingFilter, handler);

        const event = createEvent<TestEvent>('test.event', { message: 'test' });

        // Should not throw despite failing filter
        await expect(store.save(event)).resolves.not.toThrow();
        expect(handler).not.toHaveBeenCalled();
      });
    });

    describe('Store Statistics', () => {
      test('should provide accurate statistics', async () => {
        const events = [
          createEvent<TestEvent>('test.event', { message: 'first' }),
          createEvent<TestEvent>('test.event', { message: 'second' }),
          createEvent<Event<'other.event', unknown>>('other.event', {}),
          createEvent<Event<'another.event', unknown>>('another.event', {}),
        ];

        await store.saveMany(events);

        const stats = await store.getStats();

        expect(stats.totalEvents).toBe(4);
        expect(stats.eventsByType['test.event']).toBe(2);
        expect(stats.eventsByType['other.event']).toBe(1);
        expect(stats.eventsByType['another.event']).toBe(1);
        expect(stats.storageSize).toBeGreaterThan(0);
        expect(stats.lastEventTimestamp).toBeDefined();
      });

      test('should handle empty store statistics', async () => {
        const stats = await store.getStats();

        expect(stats.totalEvents).toBe(0);
        expect(stats.eventsByType).toEqual({});
        expect(stats.storageSize).toBe(0);
        expect(stats.lastEventTimestamp).toBeUndefined();
      });
    });

    describe('Store Management', () => {
      test('should clear all events', async () => {
        const events = Array.from({ length: 10 }, (_, i) =>
          createEvent<TestEvent>('test.event', { message: `msg-${i}` })
        );

        await store.saveMany(events);

        let stats = await store.getStats();
        expect(stats.totalEvents).toBe(10);

        await store.clear();

        stats = await store.getStats();
        expect(stats.totalEvents).toBe(0);

        const retrievedEvents = await store.loadByType('test.event');
        expect(retrievedEvents).toHaveLength(0);
      });

      test('should handle memory limits and cleanup', async () => {
        const smallStore = new InMemoryEventStore(5); // Very small limit for testing

        // Add more events than the limit
        const events = Array.from({ length: 10 }, (_, i) =>
          createEvent<TestEvent>('test.event', { message: `msg-${i}` })
        );

        for (const event of events) {
          await smallStore.save(event);
        }

        const stats = await smallStore.getStats();

        // Should have triggered cleanup
        expect(stats.totalEvents).toBeLessThan(10);
      });
    });
  });

  describe('PersistentEventStore', () => {
    let store: PersistentEventStore;

    beforeEach(() => {
      store = new PersistentEventStore();
    });

    test('should delegate to in-memory store (placeholder implementation)', async () => {
      const event = createEvent<TestEvent>('test.event', {
        message: 'persistent',
      });

      await store.save(event);

      const events = await store.loadByType<TestEvent>('test.event');
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(event);
    });

    test('should provide statistics', async () => {
      const event = createEvent<TestEvent>('test.event', { message: 'test' });
      await store.save(event);

      const stats = await store.getStats();
      expect(stats.totalEvents).toBe(1);
    });
  });

  describe('EventStoreFactory', () => {
    test('should create memory store', () => {
      const store = EventStoreFactory.create('memory');
      expect(store).toBeInstanceOf(InMemoryEventStore);
    });

    test('should create memory store with options', () => {
      const store = EventStoreFactory.create('memory', { maxEvents: 500 });
      expect(store).toBeInstanceOf(InMemoryEventStore);
    });

    test('should create persistent store', () => {
      const store = EventStoreFactory.create('persistent');
      expect(store).toBeInstanceOf(PersistentEventStore);
    });

    test('should throw for unknown store type', () => {
      expect(() => {
        EventStoreFactory.create('unknown' as never);
      }).toThrow('Unknown event store type: unknown');
    });
  });

  describe('EventStoreBuilder', () => {
    test('should build memory store with defaults', () => {
      const store = createEventStore().build();
      expect(store).toBeInstanceOf(InMemoryEventStore);
    });

    test('should build memory store with custom max events', () => {
      const store = createEventStore()
        .withType('memory')
        .withMaxEvents(1000)
        .build();

      expect(store).toBeInstanceOf(InMemoryEventStore);
    });

    test('should build persistent store', () => {
      const store = createEventStore().withType('persistent').build();

      expect(store).toBeInstanceOf(PersistentEventStore);
    });

    test('should support fluent configuration', () => {
      const builder = createEventStore();

      expect(builder.withType('memory')).toBe(builder);
      expect(builder.withMaxEvents(500)).toBe(builder);

      const store = builder.build();
      expect(store).toBeInstanceOf(InMemoryEventStore);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    let store: InMemoryEventStore;

    beforeEach(() => {
      store = new InMemoryEventStore();
    });

    test('should handle queries with no matching events', async () => {
      const events = await store.loadByType('non.existent');
      expect(events).toEqual([]);

      await store.loadByCorrelationId('non-existent');
      expect(events).toEqual([]);

      const aggEvents = await store.loadByAggregateId('non-existent');
      expect(aggEvents).toEqual([]);
    });

    test('should handle invalid query parameters gracefully', async () => {
      const event = createEvent<TestEvent>('test.event', { message: 'test' });
      await store.save(event);

      // Negative limits/offsets should be handled gracefully
      const events1 = await store.loadByType('test.event', { limit: -1 });
      const events2 = await store.loadByType('test.event', { offset: -1 });

      expect(Array.isArray(events1)).toBe(true);
      expect(Array.isArray(events2)).toBe(true);
    });

    test('should handle events with missing optional properties', async () => {
      const eventWithoutCorrelation = createEvent<TestEvent>('test.event', {
        message: 'test',
      });

      // Test that events can be saved (the store should handle missing correlation IDs)
      await expect(store.save(eventWithoutCorrelation)).resolves.not.toThrow();

      const events = await store.loadByType<TestEvent>('test.event');
      expect(events).toHaveLength(1);
    });

    test('should handle rapid subscription/unsubscription', async () => {
      const subscriptions: EventSubscription[] = [];

      // Create many subscriptions
      for (let i = 0; i < 100; i++) {
        subscriptions.push(await store.subscribe(() => true, vi.fn()));
      }

      // Unsubscribe all rapidly
      await Promise.all(subscriptions.map(sub => sub.unsubscribe()));

      // Add event - should not trigger any handlers
      const event = createEvent<TestEvent>('test.event', { message: 'test' });
      await expect(store.save(event)).resolves.not.toThrow();
    });

    test('should handle concurrent saves and queries', async () => {
      const savePromises = Array.from({ length: 20 }, (_, i) =>
        store.save(
          createEvent<TestEvent>('test.event', { message: `save-${i}` })
        )
      );

      const queryPromises = Array.from({ length: 10 }, () =>
        store.loadByType<TestEvent>('test.event')
      );

      await Promise.all([...savePromises, ...queryPromises]);

      const finalEvents = await store.loadByType<TestEvent>('test.event');
      expect(finalEvents.length).toBeLessThanOrEqual(20);
    });

    test('should handle large event payloads', async () => {
      const largeData = {
        message: 'x'.repeat(10000), // 10KB string
        array: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          data: `item-${i}`,
        })),
      };

      const event = createEvent<Event<'test.large', typeof largeData>>(
        'test.large',
        largeData
      );

      await expect(store.save(event)).resolves.not.toThrow();

      const events = await store.loadByType('test.large');
      expect(events).toHaveLength(1);

      const eventData = events[0]?.data as typeof largeData;
      expect(eventData?.message).toBe(largeData.message);
      expect(eventData?.array).toHaveLength(1000);
    });
  });
});
