/**
 * Event System Utilities Index
 *
 * @packageDocumentation
 */

export {
    DEFAULT_EVENT_SOURCE,
    DEFAULT_EVENT_VERSION, createDomainEvent, createEvent, createEventMetadata, generateEventId,
    generatePrefixedId, isDomainEvent, isEventOfType
} from './event-helpers';

export {
    EMITTER_CONSTANTS, PIPELINE_ERROR_STRATEGIES, STORE_CONSTANTS,
    SYSTEM_CONSTANTS,
    SYSTEM_EVENT_TYPES
} from './constants';
