/**
 * NextRush v2 Event System Integration
 *
 * Complete event-driven architecture with CQRS, Event Sourcing,
 * and pipeline processing capabilities.
 *
 * @version 2.0.0
 * @author NextRush Core Team
 */

import { performance } from 'node:perf_hooks';

import type {
  BaseEventMetadata,
  Command,
  DomainEvent,
  Event,
  EventHandler,
  EventHandlerDefinition,
  EventMetrics,
  EventPipelineConfig,
  EventStore,
  EventSubscription,
  Query,
  SystemEvent,
} from '../../types/events';

import {
  NextRushEventEmitter,
  createDomainEvent,
  createEvent,
  createEventMetadata,
} from './event-emitter';
import { EventStoreFactory } from './event-store';

/**
 * Command handler type
 */
export type CommandHandler<TCommand extends Command, TResult = void> = (
  command: TCommand
) => Promise<TResult> | TResult;

/**
 * Query handler type
 */
export type QueryHandler<TQuery extends Query, TResult = unknown> = (
  query: TQuery
) => Promise<TResult> | TResult;

/**
 * Event system configuration
 */
export interface EventSystemConfig {
  /** Enable event store persistence */
  readonly enableEventStore?: boolean;
  /** Event store type */
  readonly eventStoreType?: 'memory' | 'persistent';
  /** Maximum events for in-memory store */
  readonly maxStoredEvents?: number;
  /** Enable performance monitoring */
  readonly enableMonitoring?: boolean;
  /** Default event handler timeout */
  readonly defaultTimeout?: number;
  /** Maximum concurrent event processing */
  readonly maxConcurrency?: number;
}

/**
 * Complete event system with CQRS and Event Sourcing
 */
export class NextRushEventSystem {
  private readonly eventEmitter: NextRushEventEmitter;
  private readonly eventStore?: EventStore;
  private readonly commandHandlers = new Map<string, CommandHandler<Command>>();
  private readonly queryHandlers = new Map<string, QueryHandler<Query>>();
  private readonly config: Required<EventSystemConfig>;
  private systemSubscriptions: EventSubscription[] = []; // Track system subscriptions

  constructor(config: EventSystemConfig = {}) {
    this.config = {
      enableEventStore: config.enableEventStore ?? true,
      eventStoreType: config.eventStoreType ?? 'memory',
      maxStoredEvents: config.maxStoredEvents ?? 100000,
      enableMonitoring: config.enableMonitoring ?? true,
      defaultTimeout: config.defaultTimeout ?? 5000,
      maxConcurrency: config.maxConcurrency ?? 100,
    };

    this.eventEmitter = new NextRushEventEmitter();
    this.eventEmitter.setMonitoring(this.config.enableMonitoring);

    if (this.config.enableEventStore) {
      this.eventStore = EventStoreFactory.create(this.config.eventStoreType, {
        maxEvents: this.config.maxStoredEvents,
      });

      // Auto-persist events to store
      const subscription = this.eventEmitter.subscribe(
        '*',
        this.persistEventHandler.bind(this)
      );
      this.systemSubscriptions.push(subscription); // Track as system subscription
    }
  }

  // ==================== Event Operations ====================

  /**
   * Emit an event
   */
  async emit<T extends Event>(event: T): Promise<void> {
    await this.eventEmitter.emitEvent(event);
  }

  /**
   * Create and emit an event
   */
  async emitEvent<T extends Event>(
    type: T['type'],
    data: T['data'],
    metadata?: Partial<BaseEventMetadata>
  ): Promise<void> {
    const event = createEvent<T>(type, data, metadata);
    await this.emit(event);
  }

  /**
   * Create and emit a domain event
   */
  async emitDomainEvent<T extends DomainEvent>(
    type: T['type'],
    data: T['data'],
    aggregateId: string,
    aggregateType: string,
    sequenceNumber: number,
    metadata?: Partial<BaseEventMetadata>
  ): Promise<void> {
    const event = createDomainEvent<T>(
      type,
      data,
      aggregateId,
      aggregateType,
      sequenceNumber,
      metadata
    );
    await this.emit(event);
  }

  /**
   * Subscribe to events
   */
  subscribe<T extends Event>(
    eventType: string,
    handler: EventHandler<T>
  ): EventSubscription {
    return this.eventEmitter.subscribe(eventType, handler);
  }

  /**
   * Subscribe with options
   */
  subscribeWithOptions<T extends Event>(
    eventType: string,
    definition: EventHandlerDefinition<T>
  ): EventSubscription {
    return this.eventEmitter.subscribeWithOptions(eventType, definition);
  }

  /**
   * Unsubscribe from events
   */
  async unsubscribeAll(eventType: string): Promise<void> {
    await this.eventEmitter.unsubscribeAll(eventType);
  }

  // ==================== Pipeline Operations ====================

  /**
   * Add event pipeline
   */
  addPipeline<T extends Event>(
    eventType: string,
    pipeline: EventPipelineConfig<T>
  ): void {
    this.eventEmitter.addPipeline(eventType, pipeline);
  }

  /**
   * Remove event pipeline
   */
  removePipeline(eventType: string, pipelineName: string): void {
    this.eventEmitter.removePipeline(eventType, pipelineName);
  }

  /**
   * Get pipeline names
   */
  getPipelineNames(eventType: string): string[] {
    return this.eventEmitter.getPipelineNames(eventType);
  }

  // ==================== CQRS Operations ====================

  /**
   * Register command handler
   */
  registerCommandHandler<TCommand extends Command, TResult = void>(
    commandType: string,
    handler: CommandHandler<TCommand, TResult>
  ): void {
    this.commandHandlers.set(
      commandType,
      handler as unknown as CommandHandler<Command>
    );
  }

  /**
   * Execute command
   */
  async executeCommand<TCommand extends Command, TResult = void>(
    command: TCommand
  ): Promise<TResult> {
    const handler = this.commandHandlers.get(command.type);
    if (!handler) {
      throw new Error(
        `No handler registered for command type: ${command.type}`
      );
    }

    const startTime = performance.now();

    try {
      // Emit command started event
      await this.emitSystemEvent('command.started', {
        commandType: command.type,
        commandId: command.metadata.id,
        correlationId: command.metadata.correlationId,
        source: command.metadata.source,
      });

      const result = await Promise.resolve(handler(command as never));

      // Emit command completed event
      await this.emitSystemEvent('command.completed', {
        commandType: command.type,
        commandId: command.metadata.id,
        correlationId: command.metadata.correlationId,
        executionTime: performance.now() - startTime,
      });

      return result as TResult;
    } catch (error) {
      // Emit command failed event
      await this.emitSystemEvent('command.failed', {
        commandType: command.type,
        commandId: command.metadata.id,
        correlationId: command.metadata.correlationId,
        error: {
          name: (error as Error).name,
          message: (error as Error).message,
          stack: (error as Error).stack,
        },
        executionTime: performance.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Register query handler
   */
  registerQueryHandler<TQuery extends Query, TResult = unknown>(
    queryType: string,
    handler: QueryHandler<TQuery, TResult>
  ): void {
    this.queryHandlers.set(
      queryType,
      handler as unknown as QueryHandler<Query>
    );
  }

  /**
   * Execute query
   */
  async executeQuery<TQuery extends Query, TResult = unknown>(
    query: TQuery
  ): Promise<TResult> {
    const handler = this.queryHandlers.get(query.type);
    if (!handler) {
      throw new Error(`No handler registered for query type: ${query.type}`);
    }

    const startTime = performance.now();

    try {
      // Emit query started event
      await this.emitSystemEvent('query.started', {
        queryType: query.type,
        queryId: query.metadata.id,
        correlationId: query.metadata.correlationId,
        source: query.metadata.source,
      });

      const result = await Promise.resolve(handler(query as never));

      // Emit query completed event
      await this.emitSystemEvent('query.completed', {
        queryType: query.type,
        queryId: query.metadata.id,
        correlationId: query.metadata.correlationId,
        executionTime: performance.now() - startTime,
      });

      return result as TResult;
    } catch (error) {
      // Emit query failed event
      await this.emitSystemEvent('query.failed', {
        queryType: query.type,
        queryId: query.metadata.id,
        correlationId: query.metadata.correlationId,
        error: {
          name: (error as Error).name,
          message: (error as Error).message,
          stack: (error as Error).stack,
        },
        executionTime: performance.now() - startTime,
      });

      throw error;
    }
  }

  // ==================== Event Sourcing Operations ====================

  /**
   * Load events for aggregate
   */
  async loadAggregateEvents<T extends DomainEvent>(
    aggregateId: string,
    options?: {
      readonly afterSequence?: number;
      readonly limit?: number;
    }
  ): Promise<T[]> {
    if (!this.eventStore) {
      throw new Error('Event store is not enabled');
    }

    return this.eventStore.loadByAggregateId(aggregateId, options);
  }

  /**
   * Load events by correlation ID
   */
  async loadCorrelatedEvents<T extends Event>(
    correlationId: string,
    options?: {
      readonly limit?: number;
      readonly offset?: number;
    }
  ): Promise<T[]> {
    if (!this.eventStore) {
      throw new Error('Event store is not enabled');
    }

    return this.eventStore.loadByCorrelationId(correlationId, options);
  }

  /**
   * Load events by type
   */
  async loadEventsByType<T extends Event>(
    eventType: string,
    options?: {
      readonly after?: Date;
      readonly before?: Date;
      readonly limit?: number;
      readonly offset?: number;
    }
  ): Promise<T[]> {
    if (!this.eventStore) {
      throw new Error('Event store is not enabled');
    }

    return this.eventStore.loadByType(eventType, options);
  }

  // ==================== Monitoring and Metrics ====================

  /**
   * Get event metrics
   */
  getMetrics(): EventMetrics {
    return this.eventEmitter.getMetrics();
  }

  /**
   * Get event store statistics
   */
  async getEventStoreStats() {
    if (!this.eventStore) {
      throw new Error('Event store is not enabled');
    }

    return this.eventStore.getStats();
  }

  /**
   * Get subscription count
   */
  getSubscriptionCount(eventType?: string): number {
    return this.eventEmitter.getSubscriptionCount(eventType);
  }

  /**
   * Enable/disable monitoring
   */
  setMonitoring(enabled: boolean): void {
    this.eventEmitter.setMonitoring(enabled);
  }

  // ==================== Lifecycle Operations ====================

  /**
   * Clear all events and subscriptions
   */
  async clear(): Promise<void> {
    await this.eventEmitter.clear();
    // Note: EventStore interface doesn't define clear method
    // In a real implementation, you would add this to the interface
    this.commandHandlers.clear();
    this.queryHandlers.clear();
  }

  /**
   * Shutdown the event system
   */
  async shutdown(): Promise<void> {
    await this.clear();
    this.eventEmitter.destroy();
  }

  // ==================== Utility Methods ====================

  /**
   * Create event with metadata
   */
  createEvent<T extends Event>(
    type: T['type'],
    data: T['data'],
    metadata?: Partial<BaseEventMetadata>
  ): T {
    return createEvent<T>(type, data, metadata);
  }

  /**
   * Create command with metadata
   */
  createCommand<T extends Command>(
    type: T['type'],
    data: T['data'],
    metadata?: Partial<BaseEventMetadata>
  ): T {
    return createEvent<T>(type, data, {
      ...metadata,
      source: metadata?.source ?? 'command-handler',
    });
  }

  /**
   * Create query with metadata
   */
  createQuery<T extends Query>(
    type: T['type'],
    data: T['data'],
    metadata?: Partial<BaseEventMetadata>
  ): T {
    return createEvent<T>(type, data, {
      ...metadata,
      source: metadata?.source ?? 'query-handler',
    });
  }

  /**
   * Create domain event with aggregate info
   */
  createDomainEvent<T extends DomainEvent>(
    type: T['type'],
    data: T['data'],
    aggregateId: string,
    aggregateType: string,
    sequenceNumber: number,
    metadata?: Partial<BaseEventMetadata>
  ): T {
    const event = createEvent<T>(type, data, metadata);
    return {
      ...event,
      aggregateId,
      aggregateType,
      sequenceNumber,
    };
  }

  /**
   * Emit system event
   */
  private async emitSystemEvent(
    type: string,
    data: Record<string, unknown>
  ): Promise<void> {
    const systemEvent: SystemEvent = {
      type,
      data,
      metadata: createEventMetadata({
        source: 'nextrush-event-system',
      }),
      component: 'event-system',
      level: 'info',
    };

    await this.emit(systemEvent);
  }

  /**
   * Auto-persist events to store
   */
  private async persistEventHandler<T extends Event>(event: T): Promise<void> {
    if (this.eventStore) {
      try {
        await this.eventStore.save(event);
      } catch (error) {
        // Emit error event but don't throw to prevent cascading failures
        await this.emitSystemEvent('event-store.persist-failed', {
          eventType: event.type,
          eventId: event.metadata.id,
          error: {
            name: (error as Error).name,
            message: (error as Error).message,
          },
        });
      }
    } else {
      // eslint-disable-next-line no-console
      console.log('No event store available for persistence');
    }
  }

  // ==================== Generic Dispatch Method ====================

  /**
   * Generic dispatch method for commands, queries, or events
   * This provides a unified interface for different operation types
   */
  async dispatch<T = any>(operation: Command | Query | Event): Promise<T> {
    // Check if it's a command
    if (
      'type' in operation &&
      'metadata' in operation &&
      !('data' in operation && 'timestamp' in operation)
    ) {
      return (await this.executeCommand(operation as Command)) as T;
    }

    // Check if it's a query
    if (
      'type' in operation &&
      'metadata' in operation &&
      'parameters' in operation
    ) {
      return (await this.executeQuery(operation as Query)) as T;
    }

    // Otherwise treat as event
    if (
      'type' in operation &&
      'data' in operation &&
      'timestamp' in operation
    ) {
      await this.emit(operation as Event);
      return undefined as T;
    }

    throw new Error(
      'Invalid operation type for dispatch. Must be Command, Query, or Event.'
    );
  }
}

/**
 * Event system builder for fluent configuration
 */
export class EventSystemBuilder {
  private config: EventSystemConfig = {};

  /**
   * Enable event store
   */
  withEventStore(
    type: 'memory' | 'persistent' = 'memory',
    maxEvents = 100000
  ): this {
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
    this.config = {
      ...this.config,
      enableEventStore: false,
    };
    return this;
  }

  /**
   * Enable monitoring
   */
  withMonitoring(): this {
    this.config = {
      ...this.config,
      enableMonitoring: true,
    };
    return this;
  }

  /**
   * Disable monitoring
   */
  withoutMonitoring(): this {
    this.config = {
      ...this.config,
      enableMonitoring: false,
    };
    return this;
  }

  /**
   * Set default timeout
   */
  withTimeout(timeoutMs: number): this {
    this.config = {
      ...this.config,
      defaultTimeout: timeoutMs,
    };
    return this;
  }

  /**
   * Set max concurrency
   */
  withMaxConcurrency(maxConcurrency: number): this {
    this.config = {
      ...this.config,
      maxConcurrency,
    };
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
export function createEventSystem(): EventSystemBuilder {
  return new EventSystemBuilder();
}

/**
 * Create default event system
 */
export function createDefaultEventSystem(): NextRushEventSystem {
  return new NextRushEventSystem();
}
