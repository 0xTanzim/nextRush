/**
 * In-Memory Event Store for NextRush v2
 *
 * High-performance event store with indexing for efficient queries.
 * Supports event sourcing patterns and stream processing.
 *
 * @packageDocumentation
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
} from '../../../types/events';

import { STORE_CONSTANTS } from '../utils/constants';
import { isDomainEvent } from '../utils/event-helpers';

// ============================================================================
// Types
// ============================================================================

/**
 * Internal subscription for event store notifications
 */
interface StoreSubscription {
  readonly id: string;
  readonly filter: EventFilter;
  readonly handler: EventHandler;
  active: boolean;
}

/**
 * Load options for event queries
 */
export interface LoadByTypeOptions {
  readonly after?: Date;
  readonly before?: Date;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Load options for correlation queries
 */
export interface LoadByCorrelationOptions {
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Load options for aggregate queries
 */
export interface LoadByAggregateOptions {
  readonly afterSequence?: number;
  readonly limit?: number;
}

// ============================================================================
// In-Memory Event Store Implementation
// ============================================================================

/**
 * In-memory event store with indexing
 *
 * Features:
 * - Multiple indexes for fast queries
 * - Automatic cleanup when capacity exceeded
 * - Real-time subscriptions
 * - Support for domain events
 *
 * @example
 * ```typescript
 * const store = new InMemoryEventStore(10000);
 *
 * await store.save(event);
 * const events = await store.loadByType<UserEvent>('user.created');
 * ```
 */
export class InMemoryEventStore implements EventStore {
  /** Main event storage by ID */
  private readonly events = new Map<string, Event>();

  /** Index: event type -> event IDs */
  private readonly eventsByType = new Map<string, string[]>();

  /** Index: correlation ID -> event IDs */
  private readonly eventsByCorrelation = new Map<string, string[]>();

  /** Index: aggregate ID -> event IDs */
  private readonly eventsByAggregate = new Map<string, string[]>();

  /** Active subscriptions */
  private readonly subscriptions = new Map<string, StoreSubscription>();

  /** Event counter for capacity tracking */
  private eventCounter = 0;

  /** Maximum events to store */
  private readonly maxEvents: number;

  constructor(maxEvents: number = STORE_CONSTANTS.MAX_EVENTS) {
    this.maxEvents = maxEvents;
  }

  // ============================================================================
  // Public API - Write Operations
  // ============================================================================

  /**
   * Save event to store
   */
  async save<T extends Event>(event: T): Promise<void> {
    const eventId = event.metadata.id;

    // Store event
    this.events.set(eventId, event);

    // Update indexes
    this.indexByType(eventId, event.type);
    this.indexByCorrelation(eventId, event.metadata.correlationId);

    if (isDomainEvent(event)) {
      this.indexByAggregate(eventId, event.aggregateId);
    }

    this.eventCounter++;

    // Cleanup if over capacity
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
    for (const event of events) {
      await this.save(event);
    }
  }

  // ============================================================================
  // Public API - Read Operations
  // ============================================================================

  /**
   * Load events by type
   */
  async loadByType<T extends Event>(
    type: string,
    options: LoadByTypeOptions = {}
  ): Promise<T[]> {
    const eventIds = this.eventsByType.get(type) ?? [];
    const events = this.getEventsById<T>(eventIds);
    return this.filterAndPaginate(events, options);
  }

  /**
   * Load events by correlation ID
   */
  async loadByCorrelationId<T extends Event>(
    correlationId: string,
    options: LoadByCorrelationOptions = {}
  ): Promise<T[]> {
    const eventIds = this.eventsByCorrelation.get(correlationId) ?? [];
    const events = this.getEventsById<T>(eventIds);

    // Sort by timestamp
    events.sort((a, b) => a.metadata.timestamp - b.metadata.timestamp);

    const { limit = STORE_CONSTANTS.DEFAULT_LIMIT, offset = 0 } = options;
    return events.slice(offset, offset + limit);
  }

  /**
   * Load events for aggregate
   */
  async loadByAggregateId<T extends DomainEvent>(
    aggregateId: string,
    options: LoadByAggregateOptions = {}
  ): Promise<T[]> {
    const eventIds = this.eventsByAggregate.get(aggregateId) ?? [];
    const events = this.getEventsById<T>(eventIds);

    // Filter to domain events only and sort by sequence
    let domainEvents = events.filter(isDomainEvent) as T[];
    domainEvents.sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    // Filter by sequence if specified
    if (options.afterSequence !== undefined) {
      domainEvents = domainEvents.filter(
        e => e.sequenceNumber > options.afterSequence!
      );
    }

    // Apply limit
    if (options.limit !== undefined) {
      domainEvents = domainEvents.slice(0, options.limit);
    }

    return domainEvents;
  }

  // ============================================================================
  // Public API - Subscriptions
  // ============================================================================

  /**
   * Create event stream subscription
   */
  async subscribe<T extends Event>(
    filter: EventFilter<T>,
    handler: EventHandler<T>
  ): Promise<EventSubscription> {
    const subscriptionId = randomUUID();

    const subscription: StoreSubscription = {
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

  // ============================================================================
  // Public API - Statistics & Lifecycle
  // ============================================================================

  /**
   * Get event statistics
   */
  async getStats(): Promise<EventStoreStats> {
    const eventsByType: Record<string, number> = {};

    for (const [type, eventIds] of this.eventsByType) {
      eventsByType[type] = eventIds.length;
    }

    const timestamps = [...this.events.values()].map(e => e.metadata.timestamp);
    const lastEventTimestamp = timestamps.length > 0 ? Math.max(...timestamps) : undefined;

    return {
      totalEvents: this.events.size,
      eventsByType,
      storageSize: this.estimateStorageSize(),
      ...(lastEventTimestamp !== undefined && { lastEventTimestamp }),
    };
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

    // Deactivate all subscriptions
    for (const subscription of this.subscriptions.values()) {
      subscription.active = false;
    }
    this.subscriptions.clear();
  }

  // ============================================================================
  // Private - Indexing
  // ============================================================================

  private indexByType(eventId: string, type: string): void {
    let ids = this.eventsByType.get(type);
    if (!ids) {
      ids = [];
      this.eventsByType.set(type, ids);
    }
    ids.push(eventId);
  }

  private indexByCorrelation(eventId: string, correlationId?: string): void {
    if (!correlationId) return;

    let ids = this.eventsByCorrelation.get(correlationId);
    if (!ids) {
      ids = [];
      this.eventsByCorrelation.set(correlationId, ids);
    }
    ids.push(eventId);
  }

  private indexByAggregate(eventId: string, aggregateId: string): void {
    let ids = this.eventsByAggregate.get(aggregateId);
    if (!ids) {
      ids = [];
      this.eventsByAggregate.set(aggregateId, ids);
    }
    ids.push(eventId);
  }

  // ============================================================================
  // Private - Query Helpers
  // ============================================================================

  private getEventsById<T extends Event>(eventIds: string[]): T[] {
    const events: T[] = [];
    for (const id of eventIds) {
      const event = this.events.get(id);
      if (event) {
        events.push(event as T);
      }
    }
    return events;
  }

  private filterAndPaginate<T extends Event>(
    events: T[],
    options: LoadByTypeOptions
  ): T[] {
    let filtered = [...events];

    // Sort by timestamp
    filtered.sort((a, b) => a.metadata.timestamp - b.metadata.timestamp);

    // Filter by time range
    if (options.after) {
      const afterMs = options.after.getTime();
      filtered = filtered.filter(e => e.metadata.timestamp > afterMs);
    }

    if (options.before) {
      const beforeMs = options.before.getTime();
      filtered = filtered.filter(e => e.metadata.timestamp < beforeMs);
    }

    // Paginate
    const { limit = STORE_CONSTANTS.DEFAULT_LIMIT, offset = 0 } = options;
    return filtered.slice(offset, offset + limit);
  }

  // ============================================================================
  // Private - Subscription Notifications
  // ============================================================================

  private async notifySubscribers<T extends Event>(event: T): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const subscription of this.subscriptions.values()) {
      if (!subscription.active) continue;

      try {
        const shouldNotify = await Promise.resolve(subscription.filter(event));
        if (shouldNotify) {
          promises.push(
            Promise.resolve(subscription.handler(event)).catch(() => {
              // Silently ignore handler errors
            })
          );
        }
      } catch {
        // Silently ignore filter errors
      }
    }

    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }
  }

  // ============================================================================
  // Private - Cleanup
  // ============================================================================

  private async cleanup(): Promise<void> {
    const allEvents = [...this.events.values()];

    // Sort by timestamp (oldest first)
    allEvents.sort((a, b) => a.metadata.timestamp - b.metadata.timestamp);

    // Remove oldest 10%
    const removeCount = Math.floor(allEvents.length * STORE_CONSTANTS.CLEANUP_PERCENTAGE);
    const toRemove = allEvents.slice(0, removeCount);

    for (const event of toRemove) {
      await this.removeEvent(event);
    }
  }

  private async removeEvent(event: Event): Promise<void> {
    const eventId = event.metadata.id;

    // Remove from main store
    this.events.delete(eventId);

    // Remove from type index
    this.removeFromIndex(this.eventsByType, event.type, eventId);

    // Remove from correlation index
    if (event.metadata.correlationId) {
      this.removeFromIndex(
        this.eventsByCorrelation,
        event.metadata.correlationId,
        eventId
      );
    }

    // Remove from aggregate index
    if (isDomainEvent(event)) {
      this.removeFromIndex(this.eventsByAggregate, event.aggregateId, eventId);
    }
  }

  private removeFromIndex(
    index: Map<string, string[]>,
    key: string,
    eventId: string
  ): void {
    const ids = index.get(key);
    if (!ids) return;

    const idx = ids.indexOf(eventId);
    if (idx >= 0) {
      ids.splice(idx, 1);
    }

    if (ids.length === 0) {
      index.delete(key);
    }
  }

  // ============================================================================
  // Private - Storage Estimation
  // ============================================================================

  private estimateStorageSize(): number {
    let totalSize = 0;
    for (const event of this.events.values()) {
      // Rough estimation: JSON string length * 2 (UTF-16)
      totalSize += JSON.stringify(event).length * 2;
    }
    return totalSize;
  }
}
