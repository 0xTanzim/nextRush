/**
 * Event System Builder
 *
 * Fluent builder for configuring and creating event systems.
 *
 * @packageDocumentation
 */

import { NextRushEventSystem } from './event-system';
import type { EventSystemConfig } from './types';

/**
 * Event system builder for fluent configuration
 *
 * @example
 * ```typescript
 * const eventSystem = createEventSystemBuilder()
 *   .withEventStore('memory', 50000)
 *   .withMonitoring()
 *   .withTimeout(10000)
 *   .build();
 * ```
 */
export class EventSystemBuilder {
  private config: EventSystemConfig = {};

  /**
   * Enable event store
   */
  withEventStore(type: 'memory' = 'memory', maxEvents = 100000): this {
    this.config = {
      ...this.config,
      enableEventStore: true,
      eventStoreType: type,
      maxStoredEvents: maxEvents,
    };
    return this;
  }

  /**
   * Disable event store
   */
  withoutEventStore(): this {
    this.config = { ...this.config, enableEventStore: false };
    return this;
  }

  /**
   * Enable monitoring
   */
  withMonitoring(): this {
    this.config = { ...this.config, enableMonitoring: true };
    return this;
  }

  /**
   * Disable monitoring
   */
  withoutMonitoring(): this {
    this.config = { ...this.config, enableMonitoring: false };
    return this;
  }

  /**
   * Set default timeout
   */
  withTimeout(timeoutMs: number): this {
    this.config = { ...this.config, defaultTimeout: timeoutMs };
    return this;
  }

  /**
   * Build the event system
   */
  build(): NextRushEventSystem {
    return new NextRushEventSystem(this.config);
  }
}

/**
 * Create event system builder
 */
export function createEventSystemBuilder(): EventSystemBuilder {
  return new EventSystemBuilder();
}

/**
 * Create event system builder (alias for backwards compatibility)
 */
export function createEventSystem(): EventSystemBuilder {
  return new EventSystemBuilder();
}

/**
 * Create default event system
 */
export function createDefaultEventSystem(): NextRushEventSystem {
  return new NextRushEventSystem();
}
