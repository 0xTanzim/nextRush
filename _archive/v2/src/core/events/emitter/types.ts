/**
 * Event Emitter Types for NextRush v2
 *
 * Internal type definitions for the event emitter module.
 *
 * @packageDocumentation
 */

import type {
    Event,
    EventHandler,
    EventHandlerDefinition,
} from '../../../types/events';

/**
 * Internal subscription data structure
 */
export interface InternalSubscription<T extends Event = Event> {
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
export interface PipelineContext<T extends Event = Event> {
  readonly event: T;
  readonly pipelineName: string;
  stage: string;
  readonly startTime: number;
  transformedEvent: T;
  aborted: boolean;
}

/**
 * Mutable metrics for internal tracking
 */
export interface MutableMetrics {
  eventsEmitted: Record<string, number>;
  eventsProcessed: Record<string, number>;
  processingErrors: Record<string, number>;
  averageProcessingTime: Record<string, number>;
  pipelineStats: Record<string, PipelineStats>;
  memoryUsage: MemoryStats;
}

/**
 * Pipeline statistics
 */
export interface PipelineStats {
  executions: number;
  averageExecutionTime: number;
  successes: number;
  failures: number;
  stageStats: Record<string, StageStats>;
}

/**
 * Stage statistics
 */
export interface StageStats {
  executions: number;
  averageTime: number;
  failures: number;
}

/**
 * Memory usage statistics
 */
export interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
}

/**
 * Create empty metrics object
 */
export function createEmptyMetrics(): MutableMetrics {
  return {
    eventsEmitted: {},
    eventsProcessed: {},
    processingErrors: {},
    averageProcessingTime: {},
    pipelineStats: {},
    memoryUsage: { heapUsed: 0, heapTotal: 0, external: 0 },
  };
}
