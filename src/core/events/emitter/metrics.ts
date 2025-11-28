/**
 * Event Emitter Metrics for NextRush v2
 *
 * Handles metrics collection and reporting for the event emitter.
 *
 * @packageDocumentation
 */

import type { EventMetrics } from '../../../types/events';
import type {
    MemoryStats,
    MutableMetrics,
    PipelineStats,
    StageStats,
} from './types';

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_MEMORY_STATS: MemoryStats = {
  heapUsed: 0,
  heapTotal: 0,
  external: 0,
};

// =============================================================================
// METRICS MANAGER CLASS
// =============================================================================

/**
 * Manages event emitter metrics
 */
export class MetricsManager {
  private readonly metrics: MutableMetrics;
  private readonly processingTimes: Map<string, number[]>;
  private readonly maxSamples: number;

  constructor(maxSamples: number = 100) {
    this.maxSamples = maxSamples;
    this.processingTimes = new Map();
    this.metrics = {
      eventsEmitted: {},
      eventsProcessed: {},
      processingErrors: {},
      averageProcessingTime: {},
      pipelineStats: {},
      memoryUsage: { ...DEFAULT_MEMORY_STATS },
    };
  }

  // ---------------------------------------------------------------------------
  // Event Metrics
  // ---------------------------------------------------------------------------

  /**
   * Record event emission
   */
  recordEmission(eventType: string): void {
    this.metrics.eventsEmitted[eventType] =
      (this.metrics.eventsEmitted[eventType] || 0) + 1;
  }

  /**
   * Record event processing
   */
  recordProcessing(eventType: string, processingTime: number): void {
    this.metrics.eventsProcessed[eventType] =
      (this.metrics.eventsProcessed[eventType] || 0) + 1;

    // Track processing time samples
    let times = this.processingTimes.get(eventType);
    if (!times) {
      times = [];
      this.processingTimes.set(eventType, times);
    }

    times.push(processingTime);
    if (times.length > this.maxSamples) {
      times.shift();
    }

    // Calculate average
    this.metrics.averageProcessingTime[eventType] =
      times.reduce((sum, t) => sum + t, 0) / times.length;
  }

  /**
   * Record processing error
   */
  recordError(eventType: string): void {
    this.metrics.processingErrors[eventType] =
      (this.metrics.processingErrors[eventType] || 0) + 1;
  }

  // ---------------------------------------------------------------------------
  // Pipeline Metrics
  // ---------------------------------------------------------------------------

  /**
   * Initialize pipeline stats
   */
  initializePipelineStats(pipelineName: string): void {
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
   * Record pipeline execution start
   */
  recordPipelineExecution(pipelineName: string): void {
    this.initializePipelineStats(pipelineName);
    this.metrics.pipelineStats[pipelineName].executions++;
  }

  /**
   * Record pipeline success
   */
  recordPipelineSuccess(pipelineName: string, executionTime: number): void {
    const stats = this.metrics.pipelineStats[pipelineName];
    if (stats) {
      stats.successes++;
      this.updatePipelineAverageTime(stats, executionTime);
    }
  }

  /**
   * Record pipeline failure
   */
  recordPipelineFailure(pipelineName: string, executionTime: number): void {
    const stats = this.metrics.pipelineStats[pipelineName];
    if (stats) {
      stats.failures++;
      this.updatePipelineAverageTime(stats, executionTime);
    }
  }

  /**
   * Update pipeline average execution time
   */
  private updatePipelineAverageTime(
    stats: PipelineStats,
    executionTime: number
  ): void {
    const totalExecutions = stats.successes + stats.failures;
    stats.averageExecutionTime =
      (stats.averageExecutionTime * (totalExecutions - 1) + executionTime) /
      totalExecutions;
  }

  // ---------------------------------------------------------------------------
  // Stage Metrics
  // ---------------------------------------------------------------------------

  /**
   * Record stage execution
   */
  recordStageExecution(
    pipelineName: string,
    stageName: string,
    executionTime: number,
    failed: boolean = false
  ): void {
    const pipelineStats = this.metrics.pipelineStats[pipelineName];
    if (!pipelineStats) return;

    let stageStats = pipelineStats.stageStats[stageName];
    if (!stageStats) {
      stageStats = { executions: 0, averageTime: 0, failures: 0 };
      pipelineStats.stageStats[stageName] = stageStats;
    }

    stageStats.executions++;
    if (failed) {
      stageStats.failures++;
    }

    // Update average time
    stageStats.averageTime =
      (stageStats.averageTime * (stageStats.executions - 1) + executionTime) /
      stageStats.executions;
  }

  // ---------------------------------------------------------------------------
  // Memory Metrics
  // ---------------------------------------------------------------------------

  /**
   * Update memory usage stats
   */
  updateMemoryUsage(): void {
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage = {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
    };
  }

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  /**
   * Get current metrics snapshot
   */
  getMetrics(): EventMetrics {
    this.updateMemoryUsage();
    return {
      ...this.metrics,
      eventsEmitted: { ...this.metrics.eventsEmitted },
      eventsProcessed: { ...this.metrics.eventsProcessed },
      processingErrors: { ...this.metrics.processingErrors },
      averageProcessingTime: { ...this.metrics.averageProcessingTime },
      pipelineStats: { ...this.metrics.pipelineStats },
      memoryUsage: { ...this.metrics.memoryUsage },
    };
  }

  /**
   * Get pipeline stats
   */
  getPipelineStats(pipelineName: string): PipelineStats | undefined {
    return this.metrics.pipelineStats[pipelineName];
  }

  /**
   * Get stage stats
   */
  getStageStats(pipelineName: string, stageName: string): StageStats | undefined {
    return this.metrics.pipelineStats[pipelineName]?.stageStats[stageName];
  }
}
