/**
 * Event System Module Index
 *
 * @packageDocumentation
 */

// Main event system
export { NextRushEventSystem } from './event-system';
export type { CommandHandler, EventSystemConfig, QueryHandler, ResolvedConfig } from './types';

// Builder
export {
    EventSystemBuilder, createDefaultEventSystem, createEventSystem, createEventSystemBuilder
} from './builder';

// CQRS Handler
export { CQRSHandler } from './cqrs-handler';
export type { CQRSEventEmitter } from './cqrs-handler';

// Simple Events API
export {
    SimpleEventsAPI,
    createSimpleEventsAPI,
    type SimpleEventHandler
} from './simple-events';
