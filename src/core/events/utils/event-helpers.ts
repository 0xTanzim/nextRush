/**
 * Event Helper Utilities for NextRush v2
 *
 * Centralized helper functions for event creation and type guards.
 * Eliminates duplication across event modules.
 *
 * @packageDocumentation
 */

import { randomUUID } from 'node:crypto';
import type {
  BaseEventMetadata,
  DomainEvent,
  Event,
} from '../../../types/events';

/**
 * Default event source identifier
 */
export const DEFAULT_EVENT_SOURCE = 'nextrush-framework';

/**
 * Default event version
 */
export const DEFAULT_EVENT_VERSION = 1;

/**
 * Create event metadata with sensible defaults
 *
 * @param overrides - Optional metadata overrides
 * @returns Complete event metadata
 *
 * @example
 * ```typescript
 * const metadata = createEventMetadata({ source: 'user-service' });
 * ```
 */
export function createEventMetadata(
  overrides: Partial<BaseEventMetadata> = {}
): BaseEventMetadata {
  const metadata: BaseEventMetadata = {
    id: overrides.id ?? randomUUID(),
    timestamp: overrides.timestamp ?? Date.now(),
    source: overrides.source ?? DEFAULT_EVENT_SOURCE,
    version: overrides.version ?? DEFAULT_EVENT_VERSION,
  };

  // Only add optional properties if they are defined
  if (overrides.correlationId !== undefined) {
    (metadata as Record<string, unknown>)['correlationId'] =
      overrides.correlationId;
  }
  if (overrides.causationId !== undefined) {
    (metadata as Record<string, unknown>)['causationId'] = overrides.causationId;
  }

  return metadata;
}

/**
 * Create a typed event with metadata
 *
 * @param type - Event type identifier
 * @param data - Event payload data
 * @param metadata - Optional metadata overrides
 * @returns Typed event object
 *
 * @example
 * ```typescript
 * const event = createEvent<UserCreatedEvent>(
 *   'user.created',
 *   { userId: '123', name: 'John' }
 * );
 * ```
 */
export function createEvent<T extends Event>(
  type: T['type'],
  data: T['data'],
  metadata?: Partial<BaseEventMetadata>
): T {
  return {
    type,
    data,
    metadata: createEventMetadata(metadata),
  } as T;
}

/**
 * Create a domain event with aggregate information
 *
 * Domain events are specialized events that include aggregate tracking
 * for event sourcing patterns.
 *
 * @param type - Event type identifier
 * @param data - Event payload data
 * @param aggregateId - Aggregate root identifier
 * @param aggregateType - Type of aggregate (e.g., 'Order', 'User')
 * @param sequenceNumber - Position in aggregate event stream
 * @param metadata - Optional metadata overrides
 * @returns Domain event object
 *
 * @example
 * ```typescript
 * const event = createDomainEvent<OrderPlacedEvent>(
 *   'order.placed',
 *   { items: [...], total: 99.99 },
 *   'order-123',
 *   'Order',
 *   1
 * );
 * ```
 */
export function createDomainEvent<T extends DomainEvent>(
  type: T['type'],
  data: T['data'],
  aggregateId: string,
  aggregateType: string,
  sequenceNumber: number,
  metadata?: Partial<BaseEventMetadata>
): T {
  return {
    type,
    data,
    aggregateId,
    aggregateType,
    sequenceNumber,
    metadata: createEventMetadata(metadata),
  } as T;
}

/**
 * Type guard to check if an event matches a specific type
 *
 * @param event - Event to check
 * @param type - Expected event type
 * @returns True if event type matches
 *
 * @example
 * ```typescript
 * if (isEventOfType<UserCreatedEvent>(event, 'user.created')) {
 *   // event is typed as UserCreatedEvent
 *   console.log(event.data.userId);
 * }
 * ```
 */
export function isEventOfType<T extends Event>(
  event: Event,
  type: T['type']
): event is T {
  return event.type === type;
}

/**
 * Type guard to check if an event is a domain event
 *
 * @param event - Event to check
 * @returns True if event has domain event properties
 */
export function isDomainEvent(event: Event): event is DomainEvent {
  return (
    'aggregateId' in event &&
    'aggregateType' in event &&
    'sequenceNumber' in event &&
    typeof (event as DomainEvent).aggregateId === 'string' &&
    typeof (event as DomainEvent).aggregateType === 'string' &&
    typeof (event as DomainEvent).sequenceNumber === 'number'
  );
}

/**
 * Generate a unique event ID
 *
 * @returns UUID string
 */
export function generateEventId(): string {
  return randomUUID();
}

/**
 * Generate a simple prefixed ID (for non-UUID scenarios)
 *
 * @param prefix - ID prefix
 * @returns Prefixed unique ID
 */
export function generatePrefixedId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
