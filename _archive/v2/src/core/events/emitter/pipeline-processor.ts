/**
 * Pipeline Processor for NextRush v2 Event Emitter
 *
 * Handles event pipeline execution, including stages, filters, transformers, and middleware.
 *
 * @packageDocumentation
 */

import type {
    Event,
    EventPipelineConfig,
    EventPipelineMiddleware,
    EventPipelineStage,
} from '../../../types/events';
import { PIPELINE_ERROR_STRATEGIES } from '../utils/constants';
import type { PipelineContext, PipelineStats, StageStats } from './types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Pipeline execution result
 */
export interface PipelineResult<T extends Event = Event> {
  readonly event: T | null;
  readonly aborted: boolean;
  readonly executionTime: number;
}

/**
 * Pipeline metrics callback interface
 */
export interface PipelineMetricsCallbacks {
  initializePipelineStats(pipelineName: string): void;
  recordPipelineExecution(pipelineName: string, time: number, success: boolean): void;
  recordStageExecution(
    pipelineName: string,
    stageName: string,
    time: number,
    success: boolean
  ): void;
  recordError(eventType: string): void;
}

/**
 * Logger interface for pipeline processor
 */
export interface PipelineLogger {
  warn(message: string, error?: unknown): void;
  error(message: string, error?: unknown): void;
}

// =============================================================================
// PIPELINE CONTEXT FACTORY
// =============================================================================

/**
 * Create a pipeline execution context
 */
export function createPipelineContext<T extends Event>(
  event: T,
  pipelineName: string
): PipelineContext<T> {
  return {
    event,
    pipelineName,
    stage: '',
    startTime: performance.now(),
    transformedEvent: event,
    aborted: false,
  };
}

// =============================================================================
// STAGE EXECUTION
// =============================================================================

/**
 * Execute a single pipeline stage
 */
export async function executeStage<T extends Event>(
  context: PipelineContext<T>,
  stage: EventPipelineStage<T>,
  pipelineName: string,
  metricsEnabled: boolean,
  metrics?: PipelineMetricsCallbacks
): Promise<void> {
  context.stage = stage.name;
  const stageStart = performance.now();
  let success = true;

  try {
    // Apply filters
    if (stage.filters) {
      for (const filter of stage.filters) {
        if (!(await Promise.resolve(filter(context.transformedEvent)))) {
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
    if (stage.middleware?.length) {
      await executeMiddlewareChain(context, stage.middleware);
    }
  } catch (error) {
    success = false;
    throw error;
  } finally {
    if (metricsEnabled && metrics) {
      metrics.recordStageExecution(
        pipelineName,
        stage.name,
        performance.now() - stageStart,
        success
      );
    }
  }
}

/**
 * Execute middleware chain
 */
export async function executeMiddlewareChain<T extends Event>(
  context: PipelineContext<T>,
  middleware: EventPipelineMiddleware<T>[]
): Promise<void> {
  let index = 0;

  const next = async (): Promise<void> => {
    if (index >= middleware.length || context.aborted) return;
    const mw = middleware[index++];
    if (mw) {
      await Promise.resolve(mw(context.transformedEvent, next));
    }
  };

  await next();
}

// =============================================================================
// PIPELINE EXECUTION
// =============================================================================

/**
 * Execute a single pipeline configuration
 */
export async function executePipeline<T extends Event>(
  event: T,
  config: EventPipelineConfig<T>,
  metricsEnabled: boolean,
  metrics?: PipelineMetricsCallbacks
): Promise<PipelineResult<T>> {
  const startTime = performance.now();
  const context = createPipelineContext(event, config.name);

  if (metricsEnabled && metrics) {
    metrics.initializePipelineStats(config.name);
  }

  try {
    for (const stage of config.stages) {
      if (context.aborted) break;
      await executeStage(
        context,
        stage as EventPipelineStage<T>,
        config.name,
        metricsEnabled,
        metrics
      );
    }

    if (metricsEnabled && metrics) {
      metrics.recordPipelineExecution(
        config.name,
        performance.now() - startTime,
        true
      );
    }

    return {
      event: context.aborted ? null : context.transformedEvent,
      aborted: context.aborted,
      executionTime: performance.now() - startTime,
    };
  } catch (error) {
    if (metricsEnabled && metrics) {
      metrics.recordPipelineExecution(
        config.name,
        performance.now() - startTime,
        false
      );
    }
    throw error;
  }
}

/**
 * Handle pipeline error based on error handling strategy
 */
export function handlePipelineError<T extends Event>(
  config: EventPipelineConfig<T>,
  event: T,
  error: unknown,
  logger: PipelineLogger,
  metricsEnabled: boolean,
  metrics?: PipelineMetricsCallbacks
): T | null {
  if (metricsEnabled && metrics) {
    metrics.recordError(event.type);
  }

  if (config.errorHandling === PIPELINE_ERROR_STRATEGIES.STOP) {
    return null; // Signal to throw
  }

  if (config.errorHandling === PIPELINE_ERROR_STRATEGIES.RETRY) {
    logger.warn(`Pipeline ${config.name} failed, retrying...`, error);
  } else {
    logger.warn(`Pipeline ${config.name} failed, continuing...`, error);
  }

  return event;
}

/**
 * Process all pipelines for an event
 */
export async function processEventPipelines<T extends Event>(
  event: T,
  pipelinesMap: Map<string, EventPipelineConfig[]>,
  metricsEnabled: boolean,
  logger: PipelineLogger,
  metrics?: PipelineMetricsCallbacks
): Promise<T | null> {
  const pipelines = pipelinesMap.get(event.type) ?? [];
  let processedEvent: Event | null = event;

  for (const pipelineConfig of pipelines) {
    if (processedEvent === null) break;

    try {
      const pipelineResult: PipelineResult<Event> = await executePipeline(
        processedEvent,
        pipelineConfig,
        metricsEnabled,
        metrics
      );
      processedEvent = pipelineResult.event;
    } catch (error) {
      processedEvent = handlePipelineError(
        pipelineConfig,
        processedEvent!,
        error,
        logger,
        metricsEnabled,
        metrics
      );
      if (processedEvent === null) throw error;
    }
  }

  return processedEvent as T | null;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Initialize pipeline stats object
 */
export function createEmptyPipelineStats(): PipelineStats {
  return {
    executions: 0,
    averageExecutionTime: 0,
    successes: 0,
    failures: 0,
    stageStats: {},
  };
}

/**
 * Initialize stage stats object
 */
export function createEmptyStageStats(): StageStats {
  return {
    executions: 0,
    averageTime: 0,
    failures: 0,
  };
}
