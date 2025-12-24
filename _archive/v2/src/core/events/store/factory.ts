/**
 * Event Store Factory for NextRush v2
 *
 * Provides factory and builder patterns for creating event stores.
 *
 * @packageDocumentation
 */

import type { EventStore } from '../../../types/events';
import { STORE_CONSTANTS } from '../utils/constants';
import { InMemoryEventStore } from './in-memory-store';
import { PersistentEventStore } from './persistent-store';

/**
 * Event store type options
 */
export type EventStoreType = 'memory' | 'persistent';

/**
 * Event store creation options
 */
export interface EventStoreOptions {
  maxEvents?: number;
}

/**
 * Event store factory
 *
 * Creates event stores based on configuration.
 */
export class EventStoreFactory {
  /**
   * Create event store based on configuration
   */
  static create(
    type: EventStoreType = 'memory',
    options: EventStoreOptions = {}
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
 *
 * @example
 * ```typescript
 * const store = createEventStore()
 *   .withType('memory')
 *   .withMaxEvents(50000)
 *   .build();
 * ```
 */
export class EventStoreBuilder {
  private type: EventStoreType = 'memory';
  private maxEvents: number = STORE_CONSTANTS.MAX_EVENTS;

  /**
   * Set store type
   */
  withType(type: EventStoreType): this {
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
    return EventStoreFactory.create(this.type, { maxEvents: this.maxEvents });
  }
}

/**
 * Create an event store builder
 *
 * @returns Event store builder for fluent configuration
 *
 * @example
 * ```typescript
 * const store = createEventStore()
 *   .withType('memory')
 *   .withMaxEvents(50000)
 *   .build();
 * ```
 */
export function createEventStore(): EventStoreBuilder {
  return new EventStoreBuilder();
}

/**
 * Create an event store directly (without builder)
 *
 * @param type - Store type ('memory' or 'persistent')
 * @param options - Store options
 * @returns Event store instance
 */
export function createEventStoreInstance(
  type: EventStoreType = 'memory',
  options: EventStoreOptions = {}
): EventStore {
  return EventStoreFactory.create(type, options);
}
