/**
 * Event System Type Definitions
 *
 * @packageDocumentation
 */

import type { Command, Query } from '../../../types/events';

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
  readonly eventStoreType?: 'memory';
  /** Maximum events for in-memory store */
  readonly maxStoredEvents?: number;
  /** Enable performance monitoring */
  readonly enableMonitoring?: boolean;
  /** Default event handler timeout */
  readonly defaultTimeout?: number;
}

/**
 * Resolved event system configuration with defaults
 */
export interface ResolvedConfig {
  enableEventStore: boolean;
  eventStoreType: 'memory';
  maxStoredEvents: number;
  enableMonitoring: boolean;
  defaultTimeout: number;
}

/**
 * Serialized error format
 */
export interface SerializedError {
  name?: string;
  message: string;
  stack?: string | undefined;
}
