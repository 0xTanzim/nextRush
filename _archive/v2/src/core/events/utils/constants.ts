/**
 * Event System Constants for NextRush v2
 *
 * Centralized constants for the event system to avoid magic numbers
 * and enable easy configuration changes.
 *
 * @packageDocumentation
 */

/**
 * Event emitter configuration defaults
 */
export const EMITTER_CONSTANTS = {
  /** Maximum number of listeners per event type */
  MAX_LISTENERS: 100,

  /** Default handler timeout in milliseconds */
  DEFAULT_TIMEOUT_MS: 5000,

  /** Cleanup interval for inactive subscriptions (ms) */
  CLEANUP_INTERVAL_MS: 30000,

  /** Wildcard event type for global subscriptions */
  WILDCARD_EVENT_TYPE: '*',
} as const;

/**
 * Event store configuration defaults
 */
export const STORE_CONSTANTS = {
  /** Maximum events to keep in memory */
  MAX_EVENTS: 100000,

  /** Default pagination limit */
  DEFAULT_LIMIT: 1000,

  /** Percentage of events to remove during cleanup */
  CLEANUP_PERCENTAGE: 0.1,
} as const;

/**
 * Event system configuration defaults
 */
export const SYSTEM_CONSTANTS = {
  /** Default handler timeout in milliseconds */
  DEFAULT_TIMEOUT_MS: 5000,

  /** Maximum concurrent event processing */
  MAX_CONCURRENCY: 100,

  /** System event source identifier */
  SYSTEM_SOURCE: 'nextrush-event-system',

  /** Default info log level for system events */
  DEFAULT_LOG_LEVEL: 'info' as const,
} as const;

/**
 * System event types
 */
export const SYSTEM_EVENT_TYPES = {
  // Command lifecycle events
  COMMAND_STARTED: 'command.started',
  COMMAND_COMPLETED: 'command.completed',
  COMMAND_FAILED: 'command.failed',

  // Query lifecycle events
  QUERY_STARTED: 'query.started',
  QUERY_COMPLETED: 'query.completed',
  QUERY_FAILED: 'query.failed',

  // Event store events
  EVENT_STORE_PERSIST_FAILED: 'event-store.persist-failed',
} as const;

/**
 * Pipeline error handling strategies
 */
export const PIPELINE_ERROR_STRATEGIES = {
  /** Stop pipeline execution on error */
  STOP: 'stop',
  /** Retry the failed stage */
  RETRY: 'retry',
  /** Continue to next stage */
  CONTINUE: 'continue',
} as const;
