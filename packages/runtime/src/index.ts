/**
 * @nextrush/runtime - Runtime Detection and Cross-Runtime Abstractions
 *
 * This package provides:
 * - Runtime detection for Node.js, Bun, Deno, and Edge environments
 * - BodySource abstraction for cross-runtime body parsing
 * - Runtime capability detection
 *
 * @packageDocumentation
 * @module @nextrush/runtime
 */

// ============================================================================
// Types (re-exported from @nextrush/types)
// ============================================================================

export type {
    BodySource,
    BodySourceOptions,
    Runtime,
    RuntimeCapabilities,
    RuntimeInfo
} from '@nextrush/types';

// ============================================================================
// Runtime Detection
// ============================================================================

export {
    detectRuntime,
    getRuntime,
    getRuntimeCapabilities,
    getRuntimeInfo,
    getRuntimeVersion,
    isBun,
    isDeno,
    isEdge,
    isNode,
    isRuntime,
    resetRuntimeCache
} from './detection';

// ============================================================================
// Body Source
// ============================================================================

export {
    AbstractBodySource,
    BodyConsumedError,
    BodyTooLargeError, DEFAULT_BODY_LIMIT,
    EmptyBodySource,
    WebBodySource, createEmptyBodySource,
    createWebBodySource
} from './body-source';
