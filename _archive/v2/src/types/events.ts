/**
 * NextRush v2 Event System Types
 *
 * Comprehensive type-safe event system with CQRS patterns,
 * event sourcing, and pipeline processing capabilities.
 *
 * @version 2.0.0
 * @author NextRush Core Team
 */

import type { Context } from './context';

/**
 * Base metadata for all events
 */
export interface BaseEventMetadata {
  /** Unique event ID */
  readonly id: string;
  /** Event timestamp in milliseconds */
  readonly timestamp: number;
  /** Event correlation ID for tracing */
  readonly correlationId?: string;
  /** User/system that triggered the event */
  readonly source: string;
  /** Event version for evolution */
  readonly version: number;
  /** Additional custom metadata */
  readonly [key: string]: unknown;
}

/**
 * Generic Event interface with full type safety
 *
 * @template TType - Event type identifier
 * @template TData - Event payload data
 * @template TMetadata - Additional event metadata
 */
export interface Event<
  TType extends string = string,
  TData = unknown,
  TMetadata extends BaseEventMetadata = BaseEventMetadata,
> {
  /** Event type identifier */
  readonly type: TType;
  /** Event payload data */
  readonly data: TData;
  /** Event metadata */
  readonly metadata: TMetadata;
}

/**
 * Command interface for CQRS pattern
 * Commands represent intent to change state
 */
export interface Command<
  TType extends string = string,
  TData = unknown,
  TMetadata extends BaseEventMetadata = BaseEventMetadata,
> extends Event<TType, TData, TMetadata> {
  /** Command should be processed exactly once */
  readonly idempotencyKey?: string;
  /** Command execution timeout in milliseconds */
  readonly timeout?: number;
}

/**
 * Query interface for CQRS pattern
 * Queries represent intent to read state
 */
export interface Query<
  TType extends string = string,
  TData = unknown,
  TResult = unknown,
  TMetadata extends BaseEventMetadata = BaseEventMetadata,
> extends Event<TType, TData, TMetadata> {
  /** Expected result type (for type inference) */
  readonly _resultType?: TResult;
}

/**
 * Domain Event for business logic events
 */
export interface DomainEvent<
  TType extends string = string,
  TData = unknown,
  TMetadata extends BaseEventMetadata = BaseEventMetadata,
> extends Event<TType, TData, TMetadata> {
  /** Aggregate ID that produced this event */
  readonly aggregateId: string;
  /** Aggregate type */
  readonly aggregateType: string;
  /** Event sequence number for ordering */
  readonly sequenceNumber: number;
}

/**
 * System Event for framework lifecycle events
 */
export interface SystemEvent<
  TType extends string = string,
  TData = unknown,
  TMetadata extends BaseEventMetadata = BaseEventMetadata,
> extends Event<TType, TData, TMetadata> {
  /** System component that emitted the event */
  readonly component: string;
  /** Event severity level */
  readonly level: 'debug' | 'info' | 'warn' | 'error' | 'critical';
}

/**
 * Event handler function type
 */
export type EventHandler<T extends Event = Event> = (
  event: T,
  context?: Context
) => Promise<void> | void;

/**
 * Event handler with metadata
 */
export interface EventHandlerDefinition<T extends Event = Event> {
  /** Handler function */
  readonly handler: EventHandler<T>;
  /** Handler priority (lower = higher priority) */
  readonly priority?: number;
  /** Handler should run only once */
  readonly once?: boolean;
  /** Handler timeout in milliseconds */
  readonly timeout?: number;
  /** Handler retry configuration */
  readonly retry?: {
    readonly maxAttempts: number;
    readonly delay: number;
    readonly backoffMultiplier?: number;
  };
}

/**
 * Event pipeline middleware function
 */
export type EventPipelineMiddleware<T extends Event = Event> = (
  event: T,
  next: () => Promise<void>
) => Promise<void> | void;

/**
 * Event transformer function
 */
export type EventTransformer<TInput extends Event, TOutput extends Event> = (
  event: TInput
) => Promise<TOutput> | TOutput;

/**
 * Event filter predicate
 */
export type EventFilter<T extends Event = Event> = (
  event: T
) => boolean | Promise<boolean>;

/**
 * Event pipeline stage
 */
export interface EventPipelineStage<T extends Event = Event> {
  /** Stage name */
  readonly name: string;
  /** Stage middleware */
  readonly middleware?: EventPipelineMiddleware<T>[];
  /** Event transformers */
  readonly transformers?: EventTransformer<T, T>[];
  /** Event filters */
  readonly filters?: EventFilter<T>[];
  /** Stage timeout in milliseconds */
  readonly timeout?: number;
}

/**
 * Event pipeline configuration
 */
export interface EventPipelineConfig<T extends Event = Event> {
  /** Pipeline name */
  readonly name: string;
  /** Pipeline stages */
  readonly stages: EventPipelineStage<T>[];
  /** Error handling strategy */
  readonly errorHandling?: 'stop' | 'continue' | 'retry';
  /** Pipeline timeout in milliseconds */
  readonly timeout?: number;
  /** Enable performance monitoring */
  readonly monitoring?: boolean;
}

/**
 * Event store interface for persistence
 */
export interface EventStore {
  /** Save event to store */
  save<T extends Event>(event: T): Promise<void>;

  /** Save multiple events atomically */
  saveMany<T extends Event>(events: T[]): Promise<void>;

  /** Load events by type */
  loadByType<T extends Event>(
    type: string,
    options?: {
      readonly after?: Date;
      readonly before?: Date;
      readonly limit?: number;
      readonly offset?: number;
    }
  ): Promise<T[]>;

  /** Load events by correlation ID */
  loadByCorrelationId<T extends Event>(
    correlationId: string,
    options?: {
      readonly limit?: number;
      readonly offset?: number;
    }
  ): Promise<T[]>;

  /** Load events for aggregate */
  loadByAggregateId<T extends DomainEvent>(
    aggregateId: string,
    options?: {
      readonly afterSequence?: number;
      readonly limit?: number;
    }
  ): Promise<T[]>;

  /** Create event stream subscription */
  subscribe<T extends Event>(
    filter: EventFilter<T>,
    handler: EventHandler<T>
  ): Promise<EventSubscription>;

  /** Get event statistics */
  getStats(): Promise<EventStoreStats>;
}

/**
 * Event subscription handle
 */
export interface EventSubscription {
  /** Subscription ID */
  readonly id: string;
  /** Unsubscribe from events */
  unsubscribe(): Promise<void>;
  /** Check if subscription is active */
  isActive(): boolean;
}

/**
 * Event store statistics
 */
export interface EventStoreStats {
  /** Total events stored */
  readonly totalEvents: number;
  /** Events by type */
  readonly eventsByType: Record<string, number>;
  /** Storage size in bytes */
  readonly storageSize: number;
  /** Last event timestamp */
  readonly lastEventTimestamp?: number;
}

/**
 * Event bus interface
 */
export interface EventBus {
  /** Emit an event */
  emit<T extends Event>(event: T): Promise<void>;

  /** Subscribe to events */
  subscribe<T extends Event>(
    eventType: string,
    handler: EventHandler<T>
  ): EventSubscription;

  /** Subscribe with handler definition */
  subscribeWithOptions<T extends Event>(
    eventType: string,
    definition: EventHandlerDefinition<T>
  ): EventSubscription;

  /** Unsubscribe all handlers for event type */
  unsubscribeAll(eventType: string): Promise<void>;

  /** Get active subscriptions count */
  getSubscriptionCount(eventType?: string): number;

  /** Clear all subscriptions */
  clear(): Promise<void>;
}

/**
 * Event emitter with pipeline support
 */
export interface EventEmitter extends EventBus {
  /** Add event pipeline */
  addPipeline<T extends Event>(
    eventType: string,
    pipeline: EventPipelineConfig<T>
  ): void;

  /** Remove event pipeline */
  removePipeline(eventType: string, pipelineName: string): void;

  /** Get pipeline names for event type */
  getPipelineNames(eventType: string): string[];

  /** Enable/disable monitoring */
  setMonitoring(enabled: boolean): void;

  /** Get event metrics */
  getMetrics(): EventMetrics;
}

/**
 * Event processing metrics
 */
export interface EventMetrics {
  /** Events emitted by type */
  readonly eventsEmitted: Record<string, number>;
  /** Events processed by type */
  readonly eventsProcessed: Record<string, number>;
  /** Processing errors by type */
  readonly processingErrors: Record<string, number>;
  /** Average processing time by type (ms) */
  readonly averageProcessingTime: Record<string, number>;
  /** Pipeline execution stats */
  readonly pipelineStats: Record<string, PipelineStats>;
  /** Memory usage stats */
  readonly memoryUsage: {
    readonly heapUsed: number;
    readonly heapTotal: number;
    readonly external: number;
  };
}

/**
 * Pipeline execution statistics
 */
export interface PipelineStats {
  /** Pipeline executions count */
  readonly executions: number;
  /** Average execution time (ms) */
  readonly averageExecutionTime: number;
  /** Successful executions */
  readonly successes: number;
  /** Failed executions */
  readonly failures: number;
  /** Stage execution stats */
  readonly stageStats: Record<
    string,
    {
      readonly executions: number;
      readonly averageTime: number;
      readonly failures: number;
    }
  >;
}

// ==================== Built-in Event Types ====================

/**
 * HTTP Request Started Event
 */
export type RequestStartedEvent = SystemEvent<
  'request.started',
  {
    readonly requestId: string;
    readonly method: string;
    readonly url: string;
    readonly headers: Record<string, string>;
    readonly remoteAddress?: string;
    readonly userAgent?: string;
  }
>;

/**
 * HTTP Request Completed Event
 */
export type RequestCompletedEvent = SystemEvent<
  'request.completed',
  {
    readonly requestId: string;
    readonly method: string;
    readonly url: string;
    readonly statusCode: number;
    readonly responseTime: number;
    readonly responseSize?: number;
  }
>;

/**
 * HTTP Request Failed Event
 */
export type RequestFailedEvent = SystemEvent<
  'request.failed',
  {
    readonly requestId: string;
    readonly method: string;
    readonly url: string;
    readonly error: {
      readonly name: string;
      readonly message: string;
      readonly stack?: string;
      readonly code?: string;
    };
    readonly responseTime: number;
  }
>;

/**
 * Application Started Event
 */
export type ApplicationStartedEvent = SystemEvent<
  'application.started',
  {
    readonly version: string;
    readonly environment: string;
    readonly port?: number;
    readonly host?: string;
    readonly plugins: string[];
  }
>;

/**
 * Application Stopped Event
 */
export type ApplicationStoppedEvent = SystemEvent<
  'application.stopped',
  {
    readonly version: string;
    readonly uptime: number;
    readonly reason: 'graceful' | 'error' | 'signal';
    readonly signal?: string;
  }
>;

/**
 * Plugin Loaded Event
 */
export type PluginLoadedEvent = SystemEvent<
  'plugin.loaded',
  {
    readonly pluginName: string;
    readonly pluginVersion: string;
    readonly loadTime: number;
  }
>;

/**
 * Plugin Error Event
 */
export type PluginErrorEvent = SystemEvent<
  'plugin.error',
  {
    readonly pluginName: string;
    readonly error: {
      readonly name: string;
      readonly message: string;
      readonly stack?: string;
    };
  }
>;

/**
 * Memory Warning Event
 */
export type MemoryWarningEvent = SystemEvent<
  'system.memory.warning',
  {
    readonly heapUsed: number;
    readonly heapTotal: number;
    readonly external: number;
    readonly threshold: number;
  }
>;

/**
 * Performance Warning Event
 */
export type PerformanceWarningEvent = SystemEvent<
  'system.performance.warning',
  {
    readonly metric: string;
    readonly value: number;
    readonly threshold: number;
    readonly requestId?: string;
  }
>;

// ==================== Event Type Unions ====================

/**
 * All built-in system events
 */
export type BuiltInSystemEvent =
  | RequestStartedEvent
  | RequestCompletedEvent
  | RequestFailedEvent
  | ApplicationStartedEvent
  | ApplicationStoppedEvent
  | PluginLoadedEvent
  | PluginErrorEvent
  | MemoryWarningEvent
  | PerformanceWarningEvent;

/**
 * All built-in event types
 */
export type BuiltInEvent = BuiltInSystemEvent;

/**
 * Event type string literals
 */
export type BuiltInEventType = BuiltInEvent['type'];
