/**
 * NextRush v2 Event System
 *
 * Complete event-driven architecture with CQRS, Event Sourcing,
 * and pipeline processing capabilities.
 *
 * @packageDocumentation
 */

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
} from '../../../types/events';

import { NextRushEventEmitter } from '../emitter';
import { createEventStoreInstance } from '../store';
import { SYSTEM_CONSTANTS, SYSTEM_EVENT_TYPES } from '../utils/constants';
import {
    createDomainEvent,
    createEvent,
    createEventMetadata,
} from '../utils/event-helpers';

import { CQRSHandler } from './cqrs-handler';
import type { CommandHandler, EventSystemConfig, QueryHandler, ResolvedConfig } from './types';

// ============================================================================
// Event System Implementation
// ============================================================================

/**
 * Complete event system with CQRS and Event Sourcing
 *
 * Features:
 * - Event emission and subscription
 * - Pipeline processing
 * - Command/Query separation (CQRS)
 * - Event sourcing with aggregate support
 * - Performance monitoring
 *
 * @example
 * ```typescript
 * const eventSystem = new NextRushEventSystem();
 *
 * // Subscribe to events
 * eventSystem.subscribe('user.created', async (event) => {
 *   console.log('User created:', event.data);
 * });
 *
 * // Emit event
 * await eventSystem.emitEvent('user.created', { userId: '123' });
 *
 * // Register command handler
 * eventSystem.registerCommandHandler('CreateUser', async (cmd) => {
 *   return await userService.create(cmd.data);
 * });
 * ```
 */
export class NextRushEventSystem {
  private readonly config: ResolvedConfig;
  private readonly eventEmitter: NextRushEventEmitter;
  private readonly eventStore: EventStore | null;
  private readonly cqrsHandler: CQRSHandler;
  private persistSubscription: EventSubscription | undefined;

  constructor(config: EventSystemConfig = {}) {
    this.config = this.resolveConfig(config);
    this.eventEmitter = new NextRushEventEmitter();
    this.cqrsHandler = new CQRSHandler(this.eventEmitter);

    // Set monitoring state
    this.eventEmitter.setMonitoring(this.config.enableMonitoring);

    // Initialize event store if enabled
    if (this.config.enableEventStore) {
      this.eventStore = createEventStoreInstance(
        this.config.eventStoreType,
        { maxEvents: this.config.maxStoredEvents }
      );
      this.setupEventPersistence();
    } else {
      this.eventStore = null;
    }
  }

  // ============================================================================
  // Event Operations
  // ============================================================================

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

  // ============================================================================
  // Subscriptions
  // ============================================================================

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

  // ============================================================================
  // Pipeline Operations
  // ============================================================================

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

  // ============================================================================
  // CQRS Operations
  // ============================================================================

  /**
   * Register command handler
   */
  registerCommandHandler<TCommand extends Command, TResult = void>(
    commandType: string,
    handler: CommandHandler<TCommand, TResult>
  ): void {
    this.cqrsHandler.registerCommandHandler(commandType, handler);
  }

  /**
   * Execute command
   */
  async executeCommand<TCommand extends Command, TResult = void>(
    command: TCommand
  ): Promise<TResult> {
    return this.cqrsHandler.executeCommand(command);
  }

  /**
   * Register query handler
   */
  registerQueryHandler<TQuery extends Query, TResult = unknown>(
    queryType: string,
    handler: QueryHandler<TQuery, TResult>
  ): void {
    this.cqrsHandler.registerQueryHandler(queryType, handler);
  }

  /**
   * Execute query
   */
  async executeQuery<TQuery extends Query, TResult = unknown>(
    query: TQuery
  ): Promise<TResult> {
    return this.cqrsHandler.executeQuery(query);
  }

  // ============================================================================
  // Event Sourcing Operations
  // ============================================================================

  /**
   * Load events for aggregate
   */
  async loadAggregateEvents<T extends DomainEvent>(
    aggregateId: string,
    options?: { readonly afterSequence?: number; readonly limit?: number }
  ): Promise<T[]> {
    this.assertEventStoreEnabled();
    return this.eventStore!.loadByAggregateId(aggregateId, options);
  }

  /**
   * Load events by correlation ID
   */
  async loadCorrelatedEvents<T extends Event>(
    correlationId: string,
    options?: { readonly limit?: number; readonly offset?: number }
  ): Promise<T[]> {
    this.assertEventStoreEnabled();
    return this.eventStore!.loadByCorrelationId(correlationId, options);
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
    this.assertEventStoreEnabled();
    return this.eventStore!.loadByType(eventType, options);
  }

  // ============================================================================
  // Monitoring and Metrics
  // ============================================================================

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
    this.assertEventStoreEnabled();
    return this.eventStore!.getStats();
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

  // ============================================================================
  // Lifecycle Operations
  // ============================================================================

  /**
   * Clear all events and subscriptions
   */
  async clear(): Promise<void> {
    await this.eventEmitter.clear();
    this.cqrsHandler.clear();
  }

  /**
   * Shutdown the event system
   */
  async shutdown(): Promise<void> {
    // Unsubscribe from persistence
    if (this.persistSubscription) {
      await this.persistSubscription.unsubscribe();
      this.persistSubscription = undefined;
    }

    await this.clear();
    this.eventEmitter.destroy();
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

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
    return createDomainEvent<T>(
      type,
      data,
      aggregateId,
      aggregateType,
      sequenceNumber,
      metadata
    );
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private resolveConfig(config: EventSystemConfig): ResolvedConfig {
    return {
      enableEventStore: config.enableEventStore ?? true,
      eventStoreType: config.eventStoreType ?? 'memory',
      maxStoredEvents: config.maxStoredEvents ?? 100000,
      enableMonitoring: config.enableMonitoring ?? true,
      defaultTimeout: config.defaultTimeout ?? SYSTEM_CONSTANTS.DEFAULT_TIMEOUT_MS,
    };
  }

  private setupEventPersistence(): void {
    this.persistSubscription = this.eventEmitter.subscribe(
      '*',
      this.handleEventPersistence.bind(this)
    );
  }

  private async handleEventPersistence<T extends Event>(event: T): Promise<void> {
    if (!this.eventStore) return;

    try {
      await this.eventStore.save(event);
    } catch (error) {
      await this.emitSystemEvent(SYSTEM_EVENT_TYPES.EVENT_STORE_PERSIST_FAILED, {
        eventType: event.type,
        eventId: event.metadata.id,
        error: this.serializeError(error),
      });
    }
  }

  private async emitSystemEvent(
    type: string,
    data: Record<string, unknown>
  ): Promise<void> {
    const systemEvent: SystemEvent = {
      type,
      data,
      metadata: createEventMetadata({
        source: SYSTEM_CONSTANTS.SYSTEM_SOURCE,
      }),
      component: 'event-system',
      level: SYSTEM_CONSTANTS.DEFAULT_LOG_LEVEL,
    };

    await this.emit(systemEvent);
  }

  private assertEventStoreEnabled(): void {
    if (!this.eventStore) {
      throw new Error('Event store is not enabled');
    }
  }

  private serializeError(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    return { message: String(error) };
  }
}

// Re-export types and handlers
export type { CommandHandler, EventSystemConfig, QueryHandler, ResolvedConfig } from './types';
