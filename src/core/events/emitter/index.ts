/**
 * Event Emitter Module Index
 *
 * @packageDocumentation
 */

// Main emitter class
export { NextRushEventEmitter } from './event-emitter';

// Types
export { createEmptyMetrics } from './types';
export type {
    InternalSubscription, MemoryStats, MutableMetrics, PipelineContext, PipelineStats,
    StageStats
} from './types';

// Pipeline processor utilities
export {
    createEmptyPipelineStats,
    createEmptyStageStats, createPipelineContext, executeMiddlewareChain,
    executePipeline, executeStage, handlePipelineError,
    processEventPipelines
} from './pipeline-processor';
export type {
    PipelineLogger, PipelineMetricsCallbacks, PipelineResult
} from './pipeline-processor';

// Metrics manager
export { MetricsManager } from './metrics';
