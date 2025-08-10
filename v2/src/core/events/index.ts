/**
 * NextRush v2 Event System - Complete Export
 *
 * @version 2.0.0
 * @author NextRush Core Team
 */

// Core Event System
export {
  createDefaultEventSystem,
  createEventSystem,
  EventSystemBuilder,
  NextRushEventSystem,
} from './event-system';

export type {
  CommandHandler,
  EventSystemConfig,
  QueryHandler,
} from './event-system';

// Event Emitter
export {
  createEvent,
  createEventMetadata,
  isEventOfType,
  NextRushEventEmitter,
} from './event-emitter';

// Event Store
export {
  createEventStore,
  EventStoreBuilder,
  EventStoreFactory,
  InMemoryEventStore,
  PersistentEventStore,
} from './event-store';

// Re-export types from types/events
export type {
  ApplicationStartedEvent,
  ApplicationStoppedEvent,
  BaseEventMetadata,
  BuiltInEvent,
  BuiltInEventType,
  BuiltInSystemEvent,
  Command,
  DomainEvent,
  // Base types
  Event,
  // Bus types
  EventBus,
  EventEmitter,
  EventFilter,
  // Handler types
  EventHandler,
  EventHandlerDefinition,
  // Metrics types
  EventMetrics,
  EventPipelineConfig,
  // Pipeline types
  EventPipelineMiddleware,
  EventPipelineStage,
  // Store types
  EventStore,
  EventStoreStats,
  EventSubscription,
  EventTransformer,
  MemoryWarningEvent,
  PerformanceWarningEvent,
  PipelineStats,
  PluginErrorEvent,
  PluginLoadedEvent,
  Query,
  RequestCompletedEvent,
  RequestFailedEvent,
  // Built-in events
  RequestStartedEvent,
  SystemEvent,
} from '../../types/events';
