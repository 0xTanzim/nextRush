/**
 * NextRush v2 Event System - Complete Export
 *
 * This module provides a complete event-driven architecture with:
 * - High-performance event emission and subscription
 * - CQRS (Command/Query Responsibility Segregation)
 * - Event Sourcing with aggregate streams
 * - Pipeline-based event processing
 * - Simple string-based event API facade
 *
 * @packageDocumentation
 */

// ============================================================================
// Event System (Main entry point)
// ============================================================================

export {
  createDefaultEventSystem, createEventSystem, createEventSystemBuilder, EventSystemBuilder, NextRushEventSystem, type CommandHandler, type EventSystemConfig, type QueryHandler
} from './system';

// ============================================================================
// Simple Events API (Express-style facade)
// ============================================================================

export {
  createSimpleEventsAPI, SimpleEventsAPI, type SimpleEventHandler
} from './system';

// ============================================================================
// Event Emitter
// ============================================================================

export { NextRushEventEmitter } from './emitter';

// ============================================================================
// Event Store
// ============================================================================

export {
  createEventStore,
  createEventStoreInstance, EventStoreBuilder, EventStoreFactory, InMemoryEventStore,
  PersistentEventStore, type EventStoreOptions, type EventStoreType, type LoadByAggregateOptions, type LoadByCorrelationOptions, type LoadByTypeOptions
} from './store';

// ============================================================================
// Utility Functions
// ============================================================================

export {
  createDomainEvent, createEvent, createEventMetadata, DEFAULT_EVENT_SOURCE,
  DEFAULT_EVENT_VERSION, generateEventId,
  generatePrefixedId, isDomainEvent, isEventOfType
} from './utils/event-helpers';

// ============================================================================
// Constants
// ============================================================================

export {
  EMITTER_CONSTANTS, PIPELINE_ERROR_STRATEGIES, STORE_CONSTANTS,
  SYSTEM_CONSTANTS,
  SYSTEM_EVENT_TYPES
} from './utils/constants';

// ============================================================================
// Types (re-exported from types/events)
// ============================================================================

export type {
  ApplicationStartedEvent,
  ApplicationStoppedEvent, BaseEventMetadata,
  // Built-in events
  BuiltInEvent,
  BuiltInEventType,
  BuiltInSystemEvent, Command, DomainEvent,
  // Base types
  Event, EventBus,
  // Emitter types
  EventEmitter, EventFilter,
  // Handler types
  EventHandler,
  EventHandlerDefinition,
  // Metrics types
  EventMetrics,
  // Pipeline types
  EventPipelineConfig,
  EventPipelineMiddleware,
  EventPipelineStage,
  // Store types
  EventStore,
  EventStoreStats, EventSubscription, EventTransformer, MemoryWarningEvent,
  PerformanceWarningEvent, PipelineStats, PluginErrorEvent, PluginLoadedEvent, Query, RequestCompletedEvent,
  RequestFailedEvent, RequestStartedEvent, SystemEvent
} from '../../types/events';
