/**
 * NextRush v2 Event Emitter Implementation
 *
 * High-performance, type-safe event emitter with pipeline support,
 * error handling, retry mechanisms, and comprehensive monitoring.
 *
 * @packageDocumentation
 */

import { randomUUID } from 'node:crypto';
import { EventEmitter as NodeEventEmitter } from 'node:events';
import { performance } from 'node:perf_hooks';

import type {
    Event,
    EventEmitter,
    EventHandler,
    EventHandlerDefinition,
    EventMetrics,
    EventPipelineConfig,
    EventSubscription,
} from '../../../types/events';

import { EMITTER_CONSTANTS } from '../utils/constants';
import type { PipelineLogger, PipelineMetricsCallbacks } from './pipeline-processor';
import { processEventPipelines } from './pipeline-processor';
import type { InternalSubscription, MutableMetrics } from './types';
import { createEmptyMetrics } from './types';

// ============================================================================
// Event Emitter Implementation
// ============================================================================

/**
 * High-performance event emitter with pipeline support
 *
 * Features:
 * - Type-safe subscriptions
 * - Event pipeline processing
 * - Retry mechanisms
 * - Performance monitoring
 * - Wildcard subscriptions
 *
 * @example
 * ```typescript
 * const emitter = new NextRushEventEmitter();
 *
 * // Subscribe to events
 * const subscription = emitter.subscribe('user.created', async (event) => {
 *   console.log('User created:', event.data);
 * });
 *
 * // Emit event
 * await emitter.emitEvent({
 *   type: 'user.created',
 *   data: { userId: '123' },
 *   metadata: { id: 'evt-1', timestamp: Date.now(), source: 'api', version: 1 }
 * });
 * ```
 */
export class NextRushEventEmitter extends NodeEventEmitter implements EventEmitter {
  private readonly subscriptions = new Map<string, Map<string, InternalSubscription>>();
  private readonly pipelines = new Map<string, EventPipelineConfig[]>();
  private readonly metrics: MutableMetrics;
  private readonly cleanupInterval: NodeJS.Timeout;
  private readonly metricsCallbacks: PipelineMetricsCallbacks;
  private readonly logger: PipelineLogger;
  private monitoringEnabled = true;

  constructor() {
    super();
    this.setMaxListeners(EMITTER_CONSTANTS.MAX_LISTENERS);

    // Initialize metrics
    this.metrics = createEmptyMetrics();

    // Create metrics callbacks for pipeline processor
    this.metricsCallbacks = this.createMetricsCallbacks();
    this.logger = this.createLogger();

    // Start periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSubscriptions();
      this.updateMemoryMetrics();
    }, EMITTER_CONSTANTS.CLEANUP_INTERVAL_MS);
  }

  // ============================================================================
  // Public API - Event Emission
  // ============================================================================

  /**
   * Emit an event through the pipeline system
   */
  async emitEvent<T extends Event>(event: T): Promise<void> {
    const startTime = performance.now();

    try {
      if (this.monitoringEnabled) {
        this.incrementCounter(this.metrics.eventsEmitted, event.type);
      }

      // Process through pipelines
      const processedEvent = await processEventPipelines(
        event,
        this.pipelines,
        this.monitoringEnabled,
        this.logger,
        this.metricsCallbacks
      );

      // Emit to subscribers if not filtered
      if (processedEvent !== null) {
        await this.emitToSubscribers(processedEvent);
      }

      if (this.monitoringEnabled) {
        this.recordProcessingTime(event.type, performance.now() - startTime);
      }
    } catch (error) {
      if (this.monitoringEnabled) {
        this.incrementCounter(this.metrics.processingErrors, event.type);
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
   * Override emit for dual support (NextRush events + Node.js events)
   */
  override async emit<T extends Event>(event: T): Promise<void>;
  override emit(eventName: string | symbol, ...args: unknown[]): boolean;
  override emit<T extends Event>(
    eventOrName: T | string | symbol,
    ...args: unknown[]
  ): Promise<void> | boolean {
    // NextRush event detection
    if (this.isNextRushEvent(eventOrName)) {
      return this.emitEvent(eventOrName as T);
    }
    // Node.js EventEmitter fallback
    return super.emit(eventOrName as string | symbol, ...args);
  }

  // ============================================================================
  // Public API - Subscriptions
  // ============================================================================

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

    // Get or create subscriptions map
    let typeSubscriptions = this.subscriptions.get(eventType);
    if (!typeSubscriptions) {
      typeSubscriptions = new Map();
      this.subscriptions.set(eventType, typeSubscriptions);
    }
    typeSubscriptions.set(subscriptionId, subscription as InternalSubscription);

    return this.createSubscriptionHandle(subscriptionId, eventType, subscription);
  }

  /**
   * Unsubscribe all handlers for event type
   */
  async unsubscribeAll(eventType: string): Promise<void> {
    const typeSubscriptions = this.subscriptions.get(eventType);
    if (!typeSubscriptions) return;

    // Mark all as inactive
    for (const sub of typeSubscriptions.values()) {
      sub.active = false;
    }
    this.subscriptions.delete(eventType);
  }

  /**
   * Get active subscriptions count
   */
  getSubscriptionCount(eventType?: string): number {
    if (eventType) {
      return this.subscriptions.get(eventType)?.size ?? 0;
    }
    let total = 0;
    for (const subs of this.subscriptions.values()) {
      total += subs.size;
    }
    return total;
  }

  /**
   * Clear all subscriptions and pipelines
   */
  async clear(): Promise<void> {
    // Mark all subscriptions inactive
    for (const typeSubscriptions of this.subscriptions.values()) {
      for (const sub of typeSubscriptions.values()) {
        sub.active = false;
      }
    }

    this.subscriptions.clear();
    this.pipelines.clear();
    Object.assign(this.metrics, createEmptyMetrics());
  }

  // ============================================================================
  // Public API - Pipelines
  // ============================================================================

  /**
   * Add event pipeline
   */
  addPipeline<T extends Event>(
    eventType: string,
    pipeline: EventPipelineConfig<T>
  ): void {
    let typePipelines = this.pipelines.get(eventType);
    if (!typePipelines) {
      typePipelines = [];
      this.pipelines.set(eventType, typePipelines);
    }

    // Remove existing pipeline with same name
    const existingIndex = typePipelines.findIndex(p => p.name === pipeline.name);
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
    return this.pipelines.get(eventType)?.map(p => p.name) ?? [];
  }

  // ============================================================================
  // Public API - Monitoring
  // ============================================================================

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
      memoryUsage: { ...process.memoryUsage() },
    } as EventMetrics;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.subscriptions.clear();
    this.pipelines.clear();
    this.removeAllListeners();
  }

  // ============================================================================
  // Private - Subscription Execution
  // ============================================================================

  private async emitToSubscribers<T extends Event>(event: T): Promise<void> {
    const promises: Promise<void>[] = [];

    // Direct subscribers
    const directSubs = this.subscriptions.get(event.type);
    if (directSubs) {
      for (const sub of directSubs.values()) {
        if (sub.active) {
          promises.push(this.executeSubscription(event, sub));
        }
      }
    }

    // Wildcard subscribers
    const wildcardSubs = this.subscriptions.get(EMITTER_CONSTANTS.WILDCARD_EVENT_TYPE);
    if (wildcardSubs) {
      for (const sub of wildcardSubs.values()) {
        if (sub.active) {
          promises.push(this.executeSubscription(event, sub));
        }
      }
    }

    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }
  }

  private async executeSubscription<T extends Event>(
    event: T,
    subscription: InternalSubscription
  ): Promise<void> {
    const { handler, definition } = subscription;
    const timeout = definition.timeout ?? EMITTER_CONSTANTS.DEFAULT_TIMEOUT_MS;

    try {
      await Promise.race([
        Promise.resolve(handler(event as never)),
        this.createTimeoutPromise(timeout),
      ]);

      if (definition.once) {
        subscription.active = false;
      }
    } catch (error) {
      this.logger.error(`Event handler failed for ${event.type}:`, error);

      if (definition.retry) {
        await this.retryHandler(event, subscription, error as Error);
      }
    }
  }

  private async retryHandler<T extends Event>(
    event: T,
    subscription: InternalSubscription,
    lastError: Error,
    attempt = 1
  ): Promise<void> {
    const retry = subscription.definition.retry!;

    if (attempt > retry.maxAttempts) {
      this.logger.error(
        `Handler retry failed after ${retry.maxAttempts} attempts for ${event.type}:`,
        lastError
      );
      return;
    }

    const delay = retry.delay * Math.pow(retry.backoffMultiplier ?? 1, attempt - 1);
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      await Promise.resolve(subscription.handler(event as never));
    } catch (error) {
      await this.retryHandler(event, subscription, error as Error, attempt + 1);
    }
  }

  // ============================================================================
  // Private - Helpers
  // ============================================================================

  private isNextRushEvent(value: unknown): boolean {
    return (
      typeof value === 'object' &&
      value !== null &&
      'type' in value &&
      'data' in value
    );
  }

  private createSubscriptionHandle<T extends Event>(
    subscriptionId: string,
    eventType: string,
    subscription: InternalSubscription<T>
  ): EventSubscription {
    return {
      id: subscriptionId,
      unsubscribe: async () => {
        subscription.active = false;
        const typeSubscriptions = this.subscriptions.get(eventType);
        if (typeSubscriptions) {
          typeSubscriptions.delete(subscriptionId);
          if (typeSubscriptions.size === 0) {
            this.subscriptions.delete(eventType);
          }
        }
      },
      isActive: () => subscription.active,
    };
  }

  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error(`Handler timeout after ${timeoutMs}ms`)),
        timeoutMs
      );
    });
  }

  // ============================================================================
  // Private - Metrics
  // ============================================================================

  private incrementCounter(counter: Record<string, number>, key: string): void {
    counter[key] = (counter[key] ?? 0) + 1;
  }

  private recordProcessingTime(eventType: string, time: number): void {
    this.incrementCounter(this.metrics.eventsProcessed, eventType);
    const current = this.metrics.averageProcessingTime[eventType] ?? 0;
    const count = this.metrics.eventsProcessed[eventType];
    this.metrics.averageProcessingTime[eventType] =
      (current * (count - 1) + time) / count;
  }

  private updateMemoryMetrics(): void {
    const mem = process.memoryUsage();
    this.metrics.memoryUsage = {
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
    };
  }

  private cleanupInactiveSubscriptions(): void {
    for (const [eventType, typeSubscriptions] of this.subscriptions) {
      for (const [subId, sub] of typeSubscriptions) {
        if (!sub.active) {
          typeSubscriptions.delete(subId);
        }
      }
      if (typeSubscriptions.size === 0) {
        this.subscriptions.delete(eventType);
      }
    }
  }

  // ============================================================================
  // Private - Factory Methods
  // ============================================================================

  private createMetricsCallbacks(): PipelineMetricsCallbacks {
    return {
      initializePipelineStats: (pipelineName: string) => {
        if (!this.metrics.pipelineStats[pipelineName]) {
          this.metrics.pipelineStats[pipelineName] = {
            executions: 0,
            averageExecutionTime: 0,
            successes: 0,
            failures: 0,
            stageStats: {},
          };
        }
      },
      recordPipelineExecution: (
        pipelineName: string,
        time: number,
        success: boolean
      ) => {
        const stats = this.metrics.pipelineStats[pipelineName];
        if (!stats) return;

        stats.executions++;
        stats[success ? 'successes' : 'failures']++;
        stats.averageExecutionTime =
          (stats.averageExecutionTime * (stats.executions - 1) + time) /
          stats.executions;
      },
      recordStageExecution: (
        pipelineName: string,
        stageName: string,
        time: number,
        success: boolean
      ) => {
        const pipelineStats = this.metrics.pipelineStats[pipelineName];
        if (!pipelineStats) return;

        if (!pipelineStats.stageStats[stageName]) {
          pipelineStats.stageStats[stageName] = {
            executions: 0,
            averageTime: 0,
            failures: 0,
          };
        }

        const stageStats = pipelineStats.stageStats[stageName];
        stageStats.executions++;
        if (!success) stageStats.failures++;
        stageStats.averageTime =
          (stageStats.averageTime * (stageStats.executions - 1) + time) /
          stageStats.executions;
      },
      recordError: (eventType: string) => {
        this.incrementCounter(this.metrics.processingErrors, eventType);
      },
    };
  }

  private createLogger(): PipelineLogger {
    return {
      warn: (message: string, error?: unknown) => {
        if (process.env['NODE_ENV'] !== 'test') {
          console.warn(message, error);
        }
      },
      error: (message: string, error?: unknown) => {
        if (process.env['NODE_ENV'] !== 'test') {
          console.error(message, error);
        }
      },
    };
  }
}
