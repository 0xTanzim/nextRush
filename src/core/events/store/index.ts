/**
 * Event Store Module Index
 *
 * @packageDocumentation
 */

export {
    InMemoryEventStore, type LoadByAggregateOptions, type LoadByCorrelationOptions, type LoadByTypeOptions
} from './in-memory-store';

export { PersistentEventStore } from './persistent-store';

export {
    EventStoreBuilder, EventStoreFactory, createEventStore,
    createEventStoreInstance, type EventStoreOptions, type EventStoreType
} from './factory';
