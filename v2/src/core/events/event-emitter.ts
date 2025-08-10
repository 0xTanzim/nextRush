/**
 * NextRush v2 Event Emitter Implementation
 *
 * High-performance, type-safe event emitter with pipeline support,
 * error handling, retry mechanisms, and comprehensive monitoring.
 *
 * @version 2.0.0
 * @author NextRush Core Team
 */

import { randomUUID } from 'node:crypto';
import { EventEmitter as NodeEventEmitter } from 'node:events';
import { performance } from 'node:perf_hooks';

import type {
  BaseEventMetadata,
  DomainEvent,
  Event,
  EventEmitter,
  EventHandler,
  EventHandlerDefinition,
  EventMetrics,
  EventPipelineConfig,
  EventPipelineMiddleware,
  EventPipelineStage,
  EventSubscription,
} from '../../types/events';

/**
 * Internal subscription data
 */
interface InternalSubscription<T extends Event = Event> {
  readonly id: string;
  readonly eventType: string;
  readonly handler: EventHandler<T>;
  readonly definition: EventHandlerDefinition<T>;
  readonly createdAt: number;
  active: boolean;
}

/**
 * Pipeline execution context
 */
interface PipelineExecutionContext<T extends Event = Event> {
  readonly event: T;
  readonly pipelineName: string;
  stage: string;
  readonly startTime: number;
  transformedEvent: T;
  aborted: boolean;
}

/**
 * Mutable metrics interface for internal use
 */
interface MutableEventMetrics {
  eventsEmitted: Record<string, number>;
  eventsProcessed: Record<string, number>;
  processingErrors: Record<string, number>;
  averageProcessingTime: Record<string, number>;
  pipelineStats: Record<string, MutablePipelineStats>;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
}

/**
 * Mutable pipeline stats for internal use
 */
interface MutablePipelineStats {
  executions: number;
  averageExecutionTime: number;
  successes: number;
  failures: number;
  stageStats: Record<
    string,
    {
      executions: number;
      averageTime: number;
      failures: number;
    }
  >;
}

/**
 * High-performance event emitter with pipeline support
 */
export class NextRushEventEmitter
  extends NodeEventEmitter
  implements EventEmitter
{
  private readonly subscriptions = new Map<
    string,
    Map<string, InternalSubscription>
  >();
  private readonly pipelines = new Map<string, EventPipelineConfig[]>();
  private readonly metrics: MutableEventMetrics = {
    eventsEmitted: {},
    eventsProcessed: {},
    processingErrors: {},
    averageProcessingTime: {},
    pipelineStats: {},
    memoryUsage: {
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
    },
  };

  private monitoringEnabled = true;
  private readonly maxListeners = 100;
  private readonly defaultTimeout = 5000; // 5 seconds
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor() {
    super();
    this.setMaxListeners(this.maxListeners);

    // Start cleanup interval for inactive subscriptions
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSubscriptions();
      this.updateMemoryMetrics();
    }, 30000); // Every 30 seconds
  }

  /**
   * Emit an event through the pipeline system
   */
  async emitEvent<T extends Event>(event: T): Promise<void> {
    const startTime = performance.now();

    try {
      // Update metrics
      if (this.monitoringEnabled) {
        this.updateEmissionMetrics(event.type);
      }

      // Process event through pipelines
      let processedEvent: T | null = event;
      const pipelines = this.pipelines.get(event.type) || [];

      for (const pipelineConfig of pipelines) {
        if (processedEvent === null) break; // Stop if previous pipeline aborted

        try {
          processedEvent = await this.executePipeline(
            processedEvent,
            pipelineConfig
          );
        } catch (error) {
          if (this.monitoringEnabled) {
            this.updateErrorMetrics(event.type);
          }

          if (pipelineConfig.errorHandling === 'stop') {
            throw error;
          }

          if (pipelineConfig.errorHandling === 'retry') {
            // Implement retry logic here
            this.logWarning(
              `Pipeline ${pipelineConfig.name} failed, retrying...`,
              error
            );
            continue;
          }

          // Continue with next pipeline on error
          this.logWarning(
            `Pipeline ${pipelineConfig.name} failed, continuing...`,
            error
          );
        }
      }

      // Only emit to subscribers if event wasn't filtered out
      if (processedEvent !== null) {
        await this.emitToSubscribers(processedEvent);
      }

      // Update processing metrics
      if (this.monitoringEnabled) {
        const processingTime = performance.now() - startTime;
        this.updateProcessingMetrics(event.type, processingTime);
      }
    } catch (error) {
      if (this.monitoringEnabled) {
        this.updateErrorMetrics(event.type);
      }
      throw error;
    }
  }

  /**
   * Emit a NextRush event - implements EventEmitter interface
   */
  async emitEventAsync<T extends Event>(event: T): Promise<void> {
    return this.emitEvent(event);
  }

  /**
   * Emit an event (EventBus interface implementation)
   * This shadows Node.js EventEmitter.emit for our interface
   */
  override async emit<T extends Event>(event: T): Promise<void>;
  override emit(eventName: string | symbol, ...args: unknown[]): boolean;
  override emit<T extends Event>(
    eventOrName: T | string | symbol,
    ...args: unknown[]
  ): Promise<void> | boolean {
    // If first argument is our Event type, handle as NextRush event
    if (
      typeof eventOrName === 'object' &&
      eventOrName !== null &&
      'type' in eventOrName &&
      'data' in eventOrName
    ) {
      return this.emitEvent(eventOrName as T);
    }

    // Otherwise, delegate to Node.js EventEmitter
    return super.emit(eventOrName as string | symbol, ...args);
  }

  /**
   * Subscribe to events with basic handler
   */
  subscribe<T extends Event>(
    eventType: string,
    handler: EventHandler<T>
  ): EventSubscription {
    return this.subscribeWithOptions(eventType, { handler });
  }

  /**
   * Subscribe to events with full handler definition
   */
  subscribeWithOptions<T extends Event>(
    eventType: string,
    definition: EventHandlerDefinition<T>
  ): EventSubscription {
    const subscriptionId = randomUUID();

    const subscription: InternalSubscription<T> = {
      id: subscriptionId,
      eventType,
      handler: definition.handler,
      definition,
      createdAt: Date.now(),
      active: true,
    };

    // Get or create subscriptions map for this event type
    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, new Map());
    }

    const typeSubscriptions = this.subscriptions.get(eventType)!;
    typeSubscriptions.set(subscriptionId, subscription as InternalSubscription);

    // Return subscription handle
    return {
      id: subscriptionId,
      unsubscribe: async () => {
        subscription.active = false;
        typeSubscriptions.delete(subscriptionId);

        if (typeSubscriptions.size === 0) {
          this.subscriptions.delete(eventType);
        }
      },
      isActive: () => subscription.active,
    };
  }

  /**
   * Unsubscribe all handlers for event type
   */
  async unsubscribeAll(eventType: string): Promise<void> {
    const typeSubscriptions = this.subscriptions.get(eventType);
    if (!typeSubscriptions) return;

    // Mark all subscriptions as inactive
    for (const subscription of Array.from(typeSubscriptions.values())) {
      subscription.active = false;
    }

    // Clear the map
    this.subscriptions.delete(eventType);
  }

  /**
   * Get active subscriptions count
   */
  getSubscriptionCount(eventType?: string): number {
    if (eventType) {
      const typeSubscriptions = this.subscriptions.get(eventType);
      return typeSubscriptions?.size || 0;
    }

    let total = 0;
    for (const typeSubscriptions of Array.from(this.subscriptions.values())) {
      total += typeSubscriptions.size;
    }
    return total;
  }

  /**
   * Clear all subscriptions
   */
  async clear(): Promise<void> {
    // Mark all subscriptions as inactive
    for (const typeSubscriptions of Array.from(this.subscriptions.values())) {
      for (const subscription of Array.from(typeSubscriptions.values())) {
        subscription.active = false;
      }
    }

    // Clear all maps
    this.subscriptions.clear();
    this.pipelines.clear();

    // Reset metrics
    Object.assign(this.metrics, {
      eventsEmitted: {},
      eventsProcessed: {},
      processingErrors: {},
      averageProcessingTime: {},
      pipelineStats: {},
    });
  }

  /**
   * Add event pipeline
   */
  addPipeline<T extends Event>(
    eventType: string,
    pipeline: EventPipelineConfig<T>
  ): void {
    if (!this.pipelines.has(eventType)) {
      this.pipelines.set(eventType, []);
    }

    const typePipelines = this.pipelines.get(eventType)!;

    // Remove existing pipeline with same name
    const existingIndex = typePipelines.findIndex(
      p => p.name === pipeline.name
    );
    if (existingIndex >= 0) {
      typePipelines.splice(existingIndex, 1);
    }

    typePipelines.push(pipeline as unknown as EventPipelineConfig);
  }

  /**
   * Remove event pipeline
   */
  removePipeline(eventType: string, pipelineName: string): void {
    const typePipelines = this.pipelines.get(eventType);
    if (!typePipelines) return;

    const index = typePipelines.findIndex(p => p.name === pipelineName);
    if (index >= 0) {
      typePipelines.splice(index, 1);
    }

    if (typePipelines.length === 0) {
      this.pipelines.delete(eventType);
    }
  }

  /**
   * Get pipeline names for event type
   */
  getPipelineNames(eventType: string): string[] {
    const typePipelines = this.pipelines.get(eventType);
    return typePipelines ? typePipelines.map(p => p.name) : [];
  }

  /**
   * Enable/disable monitoring
   */
  setMonitoring(enabled: boolean): void {
    this.monitoringEnabled = enabled;
  }

  /**
   * Get event metrics
   */
  getMetrics(): EventMetrics {
    return {
      ...this.metrics,
      memoryUsage: {
        ...process.memoryUsage(),
      },
    } as EventMetrics;
  }

  /**
   * Execute pipeline for an event
   */
  private async executePipeline<T extends Event>(
    event: T,
    config: EventPipelineConfig
  ): Promise<T | null> {
    const startTime = performance.now();
    const context: PipelineExecutionContext<T> = {
      event,
      pipelineName: config.name,
      stage: '',
      startTime,
      transformedEvent: event,
      aborted: false,
    };

    // Initialize pipeline metrics if monitoring is enabled
    if (this.monitoringEnabled) {
      this.initializePipelineStats(config.name);
    }

    try {
      // Execute each stage
      for (const stage of config.stages) {
        if (context.aborted) break;

        context.stage = stage.name;
        const stageStartTime = performance.now();

        try {
          await this.executeStage(context, stage);

          if (this.monitoringEnabled) {
            this.updateStageMetrics(
              config.name,
              stage.name,
              performance.now() - stageStartTime,
              true
            );
          }
        } catch (error) {
          if (this.monitoringEnabled) {
            this.updateStageMetrics(
              config.name,
              stage.name,
              performance.now() - stageStartTime,
              false
            );
          }
          throw error;
        }
      }

      if (this.monitoringEnabled) {
        this.updatePipelineMetrics(
          config.name,
          performance.now() - startTime,
          true
        );
      }

      // Return null if event was aborted by filters
      if (context.aborted) {
        return null;
      }

      return context.transformedEvent;
    } catch (error) {
      if (this.monitoringEnabled) {
        this.updatePipelineMetrics(
          config.name,
          performance.now() - startTime,
          false
        );
      }
      throw error;
    }
  }

  /**
   * Execute pipeline stage
   */
  private async executeStage<T extends Event>(
    context: PipelineExecutionContext<T>,
    stage: EventPipelineStage
  ): Promise<void> {
    // Apply filters first
    if (stage.filters) {
      for (const filter of stage.filters) {
        const shouldContinue = await Promise.resolve(
          filter(context.transformedEvent)
        );
        if (!shouldContinue) {
          context.aborted = true;
          return;
        }
      }
    }

    // Apply transformers
    if (stage.transformers) {
      for (const transformer of stage.transformers) {
        context.transformedEvent = (await Promise.resolve(
          transformer(context.transformedEvent)
        )) as T;
      }
    }

    // Execute middleware
    if (stage.middleware && stage.middleware.length > 0) {
      await this.executeMiddlewareChain(context, stage.middleware);
    }
  }

  /**
   * Execute middleware chain
   */
  private async executeMiddlewareChain<T extends Event>(
    context: PipelineExecutionContext<T>,
    middleware: EventPipelineMiddleware[]
  ): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index >= middleware.length || context.aborted) return;

      const currentMiddleware = middleware[index++];
      if (currentMiddleware) {
        await Promise.resolve(
          currentMiddleware(context.transformedEvent, next)
        );
      }
    };

    await next();
  }

  /**
   * Emit event to all subscribers
   */
  private async emitToSubscribers<T extends Event>(event: T): Promise<void> {
    const subscriptionPromises: Promise<void>[] = [];

    // Get direct type subscriptions
    const typeSubscriptions = this.subscriptions.get(event.type);
    if (typeSubscriptions) {
      for (const subscription of Array.from(typeSubscriptions.values())) {
        if (!subscription.active) continue;
        subscriptionPromises.push(
          this.executeSubscription(event, subscription)
        );
      }
    }

    // Get wildcard subscriptions
    const wildcardSubscriptions = this.subscriptions.get('*');
    if (wildcardSubscriptions) {
      for (const subscription of Array.from(wildcardSubscriptions.values())) {
        if (!subscription.active) continue;
        subscriptionPromises.push(
          this.executeSubscription(event, subscription)
        );
      }
    }

    if (subscriptionPromises.length > 0) {
      await Promise.allSettled(subscriptionPromises);
    }
  }

  /**
   * Execute individual subscription
   */
  private async executeSubscription<T extends Event>(
    event: T,
    subscription: InternalSubscription
  ): Promise<void> {
    const { handler, definition } = subscription;
    const timeout = definition.timeout || this.defaultTimeout;

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Handler timeout after ${timeout}ms`));
        }, timeout);
      });

      // Execute handler with timeout
      const handlerPromise = Promise.resolve(handler(event as never));
      await Promise.race([handlerPromise, timeoutPromise]);

      // Mark as one-time if specified
      if (definition.once) {
        subscription.active = false;
      }
    } catch (error) {
      this.logError(`Event handler failed for ${event.type}:`, error);

      // Implement retry logic if configured
      if (definition.retry) {
        await this.retryHandler(event, subscription, error as Error);
      }

      // Don't rethrow to prevent one handler failure from affecting others
    }
  }

  /**
   * Retry failed handler execution
   */
  private async retryHandler<T extends Event>(
    event: T,
    subscription: InternalSubscription,
    lastError: Error,
    attempt: number = 1
  ): Promise<void> {
    const retry = subscription.definition.retry!;

    if (attempt > retry.maxAttempts) {
      this.logError(
        `Handler retry failed after ${retry.maxAttempts} attempts for ${event.type}:`,
        lastError
      );
      return;
    }

    const delay =
      retry.delay * Math.pow(retry.backoffMultiplier || 1, attempt - 1);

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      await Promise.resolve(subscription.handler(event as never));
    } catch (error) {
      await this.retryHandler(event, subscription, error as Error, attempt + 1);
    }
  }

  /**
   * Update emission metrics
   */
  private updateEmissionMetrics(eventType: string): void {
    this.metrics.eventsEmitted[eventType] =
      (this.metrics.eventsEmitted[eventType] || 0) + 1;
  }

  /**
   * Update processing metrics
   */
  private updateProcessingMetrics(
    eventType: string,
    processingTime: number
  ): void {
    this.metrics.eventsProcessed[eventType] =
      (this.metrics.eventsProcessed[eventType] || 0) + 1;

    const current = this.metrics.averageProcessingTime[eventType] || 0;
    const count = this.metrics.eventsProcessed[eventType];
    this.metrics.averageProcessingTime[eventType] =
      (current * (count - 1) + processingTime) / count;
  }

  /**
   * Update error metrics
   */
  private updateErrorMetrics(eventType: string): void {
    this.metrics.processingErrors[eventType] =
      (this.metrics.processingErrors[eventType] || 0) + 1;
  }

  /**
   * Initialize pipeline stats if not exists
   */
  private initializePipelineStats(pipelineName: string): void {
    if (!this.metrics.pipelineStats[pipelineName]) {
      this.metrics.pipelineStats[pipelineName] = {
        executions: 0,
        averageExecutionTime: 0,
        successes: 0,
        failures: 0,
        stageStats: {},
      };
    }
  }

  /**
   * Update pipeline metrics
   */
  private updatePipelineMetrics(
    pipelineName: string,
    executionTime: number,
    success: boolean
  ): void {
    // Pipeline stats should already be initialized
    const stats = this.metrics.pipelineStats[pipelineName];
    if (!stats) return;

    stats.executions++;

    if (success) {
      stats.successes++;
    } else {
      stats.failures++;
    }

    stats.averageExecutionTime =
      (stats.averageExecutionTime * (stats.executions - 1) + executionTime) /
      stats.executions;
  }

  /**
   * Update stage metrics
   */
  private updateStageMetrics(
    pipelineName: string,
    stageName: string,
    executionTime: number,
    success: boolean
  ): void {
    if (!this.metrics.pipelineStats[pipelineName]) return;

    const pipelineStats = this.metrics.pipelineStats[pipelineName];
    if (!pipelineStats.stageStats[stageName]) {
      pipelineStats.stageStats[stageName] = {
        executions: 0,
        averageTime: 0,
        failures: 0,
      };
    }

    const stageStats = pipelineStats.stageStats[stageName];
    stageStats.executions++;

    if (!success) {
      stageStats.failures++;
    }

    stageStats.averageTime =
      (stageStats.averageTime * (stageStats.executions - 1) + executionTime) /
      stageStats.executions;
  }

  /**
   * Update memory metrics
   */
  private updateMemoryMetrics(): void {
    const memoryUsage = process.memoryUsage();
    this.metrics.memoryUsage = {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
    };
  }

  /**
   * Cleanup inactive subscriptions
   */
  private cleanupInactiveSubscriptions(): void {
    for (const [eventType, typeSubscriptions] of Array.from(
      this.subscriptions.entries()
    )) {
      for (const [subscriptionId, subscription] of Array.from(
        typeSubscriptions.entries()
      )) {
        if (!subscription.active) {
          typeSubscriptions.delete(subscriptionId);
        }
      }

      if (typeSubscriptions.size === 0) {
        this.subscriptions.delete(eventType);
      }
    }
  }

  /**
   * Log warning message
   */
  private logWarning(message: string, error?: unknown): void {
    // In production, use proper logger
    if (process.env['NODE_ENV'] !== 'test') {
      // eslint-disable-next-line no-console
      console.warn(message, error);
    }
  }

  /**
   * Log error message
   */
  private logError(message: string, error?: unknown): void {
    // In production, use proper logger
    if (process.env['NODE_ENV'] !== 'test') {
      // eslint-disable-next-line no-console
      console.error(message, error);
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    void this.clear();
    this.removeAllListeners();
  }
}

/**
 * Create event metadata with defaults
 */
export function createEventMetadata(
  overrides: Partial<BaseEventMetadata> = {}
): BaseEventMetadata {
  return {
    id: randomUUID(),
    timestamp: Date.now(),
    source: 'nextrush-framework',
    version: 1,
    ...overrides,
  };
}

/**
 * Create a domain event
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
 * Create a domain event
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
 * Type guard for checking event types
 */
export function isEventOfType<T extends Event>(
  event: Event,
  type: T['type']
): event is T {
  return event.type === type;
}
