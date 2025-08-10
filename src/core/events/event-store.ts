/**
 * NextRush v2 Event Store Implementation
 *
 * High-performance event store with in-memory and persistent storage options,
 * supporting event sourcing patterns and stream processing.
 *
 * @version 2.0.0
 * @author NextRush Core Team
 */

import { randomUUID } from 'node:crypto';

import type {
  DomainEvent,
  Event,
  EventFilter,
  EventHandler,
  EventStore,
  EventStoreStats,
  EventSubscription,
} from '../../types/events';

/**
 * In-memory event store implementation
 */
export class InMemoryEventStore implements EventStore {
  private readonly events: Map<string, Event> = new Map();
  private readonly eventsByType: Map<string, string[]> = new Map();
  private readonly eventsByCorrelation: Map<string, string[]> = new Map();
  private readonly eventsByAggregate: Map<string, string[]> = new Map();
  private readonly subscriptions: Map<string, EventStoreSubscription> =
    new Map();

  private eventCounter = 0;
  private readonly maxEvents: number;

  constructor(maxEvents = 100000) {
    this.maxEvents = maxEvents;
  }

  /**
   * Save event to store
   */
  async save<T extends Event>(event: T): Promise<void> {
    const eventId = event.metadata.id;

    // Store the event
    this.events.set(eventId, event);

    // Index by type
    if (!this.eventsByType.has(event.type)) {
      this.eventsByType.set(event.type, []);
    }
    this.eventsByType.get(event.type)!.push(eventId);

    // Index by correlation ID if present
    if (event.metadata.correlationId) {
      if (!this.eventsByCorrelation.has(event.metadata.correlationId)) {
        this.eventsByCorrelation.set(event.metadata.correlationId, []);
      }
      this.eventsByCorrelation.get(event.metadata.correlationId)!.push(eventId);
    }

    // Index by aggregate ID for domain events
    if (this.isDomainEvent(event)) {
      if (!this.eventsByAggregate.has(event.aggregateId)) {
        this.eventsByAggregate.set(event.aggregateId, []);
      }
      this.eventsByAggregate.get(event.aggregateId)!.push(eventId);
    }

    this.eventCounter++;

    // Cleanup old events if we exceed max
    if (this.eventCounter > this.maxEvents) {
      await this.cleanup();
    }

    // Notify subscribers
    await this.notifySubscribers(event);
  }

  /**
   * Save multiple events atomically
   */
  async saveMany<T extends Event>(events: T[]): Promise<void> {
    // In a real implementation, this would be atomic
    for (const event of events) {
      await this.save(event);
    }
  }

  /**
   * Load events by type
   */
  async loadByType<T extends Event>(
    type: string,
    options: {
      readonly after?: Date;
      readonly before?: Date;
      readonly limit?: number;
      readonly offset?: number;
    } = {}
  ): Promise<T[]> {
    const eventIds = this.eventsByType.get(type) || [];
    const events = this.getEventsById(eventIds) as T[];

    return this.filterAndPaginateEvents(events, options);
  }

  /**
   * Load events by correlation ID
   */
  async loadByCorrelationId<T extends Event>(
    correlationId: string,
    options: {
      readonly limit?: number;
      readonly offset?: number;
    } = {}
  ): Promise<T[]> {
    const eventIds = this.eventsByCorrelation.get(correlationId) || [];
    const events = this.getEventsById(eventIds) as T[];

    // Sort by timestamp
    events.sort((a, b) => a.metadata.timestamp - b.metadata.timestamp);

    const { limit = 1000, offset = 0 } = options;
    return events.slice(offset, offset + limit);
  }

  /**
   * Load events for aggregate
   */
  async loadByAggregateId<T extends DomainEvent>(
    aggregateId: string,
    options: {
      readonly afterSequence?: number;
      readonly limit?: number;
    } = {}
  ): Promise<T[]> {
    const eventIds = this.eventsByAggregate.get(aggregateId) || [];
    const events = this.getEventsById(eventIds) as T[];

    // Filter domain events
    const domainEvents = events.filter(this.isDomainEvent) as T[];

    // Sort by sequence number
    domainEvents.sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    // Filter by sequence number if specified
    let filteredEvents = domainEvents;
    if (options.afterSequence !== undefined) {
      filteredEvents = domainEvents.filter(
        e => e.sequenceNumber > options.afterSequence!
      );
    }

    // Apply limit
    if (options.limit !== undefined) {
      filteredEvents = filteredEvents.slice(0, options.limit);
    }

    return filteredEvents;
  }

  /**
   * Create event stream subscription
   */
  async subscribe<T extends Event>(
    filter: EventFilter<T>,
    handler: EventHandler<T>
  ): Promise<EventSubscription> {
    const subscriptionId = randomUUID();

    const subscription: EventStoreSubscription = {
      id: subscriptionId,
      filter: filter as EventFilter,
      handler: handler as EventHandler,
      active: true,
    };

    this.subscriptions.set(subscriptionId, subscription);

    return {
      id: subscriptionId,
      unsubscribe: async () => {
        subscription.active = false;
        this.subscriptions.delete(subscriptionId);
      },
      isActive: () => subscription.active,
    };
  }

  /**
   * Get event statistics
   */
  async getStats(): Promise<EventStoreStats> {
    const eventsByType: Record<string, number> = {};

    for (const [type, eventIds] of this.eventsByType.entries()) {
      eventsByType[type] = eventIds.length;
    }

    const timestamps = Array.from(this.events.values()).map(
      e => e.metadata.timestamp
    );

    const lastEventTimestamp =
      timestamps.length > 0 ? Math.max(...timestamps) : undefined;

    const result: EventStoreStats = {
      totalEvents: this.events.size,
      eventsByType,
      storageSize: this.estimateStorageSize(),
      ...(lastEventTimestamp !== undefined && { lastEventTimestamp }),
    };

    return result;
  }

  /**
   * Clear all events from store
   */
  async clear(): Promise<void> {
    this.events.clear();
    this.eventsByType.clear();
    this.eventsByCorrelation.clear();
    this.eventsByAggregate.clear();
    this.eventCounter = 0;

    // Notify all subscribers to unsubscribe
    for (const subscription of this.subscriptions.values()) {
      subscription.active = false;
    }
    this.subscriptions.clear();
  }

  /**
   * Get events by ID array
   */
  private getEventsById(eventIds: string[]): Event[] {
    return eventIds
      .map(id => this.events.get(id))
      .filter((event): event is Event => event !== undefined);
  }

  /**
   * Filter and paginate events based on options
   */
  private filterAndPaginateEvents<T extends Event>(
    events: T[],
    options: {
      readonly after?: Date;
      readonly before?: Date;
      readonly limit?: number;
      readonly offset?: number;
    }
  ): T[] {
    let filteredEvents = [...events];

    // Sort by timestamp
    filteredEvents.sort((a, b) => a.metadata.timestamp - b.metadata.timestamp);

    // Filter by time range
    if (options.after) {
      const afterMs = options.after.getTime();
      filteredEvents = filteredEvents.filter(
        e => e.metadata.timestamp > afterMs
      );
    }

    if (options.before) {
      const beforeMs = options.before.getTime();
      filteredEvents = filteredEvents.filter(
        e => e.metadata.timestamp < beforeMs
      );
    }

    // Apply pagination
    const { limit = 1000, offset = 0 } = options;
    return filteredEvents.slice(offset, offset + limit);
  }

  /**
   * Notify subscribers of new event
   */
  private async notifySubscribers<T extends Event>(event: T): Promise<void> {
    const notifyPromises: Promise<void>[] = [];

    for (const subscription of this.subscriptions.values()) {
      if (!subscription.active) continue;

      try {
        const shouldNotify = await Promise.resolve(subscription.filter(event));
        if (shouldNotify) {
          notifyPromises.push(
            Promise.resolve(subscription.handler(event)).catch(() => {
              // Silently ignore subscription handler errors
            })
          );
        }
      } catch {
        // Silently ignore subscription filter errors
      }
    }

    if (notifyPromises.length > 0) {
      await Promise.allSettled(notifyPromises);
    }
  }

  /**
   * Cleanup old events when approaching max capacity
   */
  private async cleanup(): Promise<void> {
    const allEvents = Array.from(this.events.values());

    // Sort by timestamp (oldest first)
    allEvents.sort((a, b) => a.metadata.timestamp - b.metadata.timestamp);

    // Remove oldest 10% of events
    const eventsToRemove = Math.floor(allEvents.length * 0.1);
    const oldestEvents = allEvents.slice(0, eventsToRemove);

    for (const event of oldestEvents) {
      await this.removeEvent(event);
    }
  }

  /**
   * Remove a specific event from all indexes
   */
  private async removeEvent(event: Event): Promise<void> {
    const eventId = event.metadata.id;

    // Remove from main store
    this.events.delete(eventId);

    // Remove from type index
    const typeEventIds = this.eventsByType.get(event.type);
    if (typeEventIds) {
      const index = typeEventIds.indexOf(eventId);
      if (index >= 0) {
        typeEventIds.splice(index, 1);
      }
      if (typeEventIds.length === 0) {
        this.eventsByType.delete(event.type);
      }
    }

    // Remove from correlation index
    if (event.metadata.correlationId) {
      const correlationEventIds = this.eventsByCorrelation.get(
        event.metadata.correlationId
      );
      if (correlationEventIds) {
        const index = correlationEventIds.indexOf(eventId);
        if (index >= 0) {
          correlationEventIds.splice(index, 1);
        }
        if (correlationEventIds.length === 0) {
          this.eventsByCorrelation.delete(event.metadata.correlationId);
        }
      }
    }

    // Remove from aggregate index
    if (this.isDomainEvent(event)) {
      const aggregateEventIds = this.eventsByAggregate.get(event.aggregateId);
      if (aggregateEventIds) {
        const index = aggregateEventIds.indexOf(eventId);
        if (index >= 0) {
          aggregateEventIds.splice(index, 1);
        }
        if (aggregateEventIds.length === 0) {
          this.eventsByAggregate.delete(event.aggregateId);
        }
      }
    }
  }

  /**
   * Check if event is a domain event
   */
  private isDomainEvent(event: Event): event is DomainEvent {
    return (
      'aggregateId' in event &&
      'aggregateType' in event &&
      'sequenceNumber' in event
    );
  }

  /**
   * Estimate storage size in bytes
   */
  private estimateStorageSize(): number {
    let totalSize = 0;

    for (const event of this.events.values()) {
      // Rough estimation: JSON string length * 2 (for UTF-16)
      totalSize += JSON.stringify(event).length * 2;
    }

    return totalSize;
  }
}

/**
 * Internal subscription data
 */
interface EventStoreSubscription {
  readonly id: string;
  readonly filter: EventFilter;
  readonly handler: EventHandler;
  active: boolean;
}

/**
 * Persistent event store implementation (placeholder for database integration)
 */
export class PersistentEventStore implements EventStore {
  private readonly inMemoryStore: InMemoryEventStore;

  constructor() {
    this.inMemoryStore = new InMemoryEventStore();
  }

  async save<T extends Event>(event: T): Promise<void> {
    // In a real implementation, this would persist to database
    // For now, delegate to in-memory store
    await this.inMemoryStore.save(event);
  }

  async saveMany<T extends Event>(events: T[]): Promise<void> {
    // In a real implementation, this would use database transactions
    await this.inMemoryStore.saveMany(events);
  }

  async loadByType<T extends Event>(
    type: string,
    options?: {
      readonly after?: Date;
      readonly before?: Date;
      readonly limit?: number;
      readonly offset?: number;
    }
  ): Promise<T[]> {
    // In a real implementation, this would query database
    return this.inMemoryStore.loadByType(type, options);
  }

  async loadByCorrelationId<T extends Event>(
    correlationId: string,
    options?: {
      readonly limit?: number;
      readonly offset?: number;
    }
  ): Promise<T[]> {
    // In a real implementation, this would query database
    return this.inMemoryStore.loadByCorrelationId(correlationId, options);
  }

  async loadByAggregateId<T extends DomainEvent>(
    aggregateId: string,
    options?: {
      readonly afterSequence?: number;
      readonly limit?: number;
    }
  ): Promise<T[]> {
    // In a real implementation, this would query database
    return this.inMemoryStore.loadByAggregateId(aggregateId, options);
  }

  async subscribe<T extends Event>(
    filter: EventFilter<T>,
    handler: EventHandler<T>
  ): Promise<EventSubscription> {
    // In a real implementation, this might use database change streams
    return this.inMemoryStore.subscribe(filter, handler);
  }

  async getStats(): Promise<EventStoreStats> {
    // In a real implementation, this would query database statistics
    return this.inMemoryStore.getStats();
  }
}

/**
 * Event store factory
 */
export class EventStoreFactory {
  /**
   * Create event store based on configuration
   */
  static create(
    type: 'memory' | 'persistent' = 'memory',
    options: {
      maxEvents?: number;
    } = {}
  ): EventStore {
    switch (type) {
      case 'memory':
        return new InMemoryEventStore(options.maxEvents);
      case 'persistent':
        return new PersistentEventStore();
      default:
        throw new Error(`Unknown event store type: ${type}`);
    }
  }
}

/**
 * Event store builder for fluent configuration
 */
export class EventStoreBuilder {
  private type: 'memory' | 'persistent' = 'memory';
  private maxEvents = 100000;

  /**
   * Set store type
   */
  withType(type: 'memory' | 'persistent'): this {
    this.type = type;
    return this;
  }

  /**
   * Set max events for in-memory store
   */
  withMaxEvents(maxEvents: number): this {
    this.maxEvents = maxEvents;
    return this;
  }

  /**
   * Build the event store
   */
  build(): EventStore {
    return EventStoreFactory.create(this.type, {
      maxEvents: this.maxEvents,
    });
  }
}

/**
 * Create event store builder
 */
export function createEventStore(): EventStoreBuilder {
  return new EventStoreBuilder();
}
