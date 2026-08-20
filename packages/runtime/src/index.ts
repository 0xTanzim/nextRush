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
  PlatformId,
  Runtime,
  RuntimeCapabilities,
  RuntimeInfo,
} from '@nextrush/types';

// ============================================================================
// Runtime Detection
// ============================================================================

export {
  detectEdgeRuntime,
  detectPlatform,
  detectRuntime,
  capabilitiesFor,
  getRuntime,
  getRuntimeCapabilities,
  getRuntimeInfo,
  getRuntimeVersion,
  isBun,
  isDeno,
  isEdge,
  isNode,
  isRuntime,
  resetRuntimeCache,
} from './detection';

export type { EdgeRuntimeInfo, PlatformInfo } from './detection';

// ============================================================================
// Named Capability Profiles (documented view of capabilitiesFor)
// ============================================================================

export {
  BunProfile,
  CloudflareProfile,
  DenoDeployProfile,
  DenoProfile,
  EdgeProfile,
  LambdaProfile,
  NodeProfile,
  VercelEdgeProfile,
  capabilityProfileFor,
} from './profiles';
export type { CapabilityProfile } from './profiles';

// ============================================================================
// Query String Parsing
// ============================================================================

export { NULL_PROTO } from './null-proto';
export { parseQueryString } from './query';

// ============================================================================
// Constants
// ============================================================================

export {
  DEFAULT_KEEP_ALIVE_TIMEOUT_MS,
  DEFAULT_SHUTDOWN_TIMEOUT_MS,
  DEFAULT_TIMEOUT_MS,
  METHODS_WITHOUT_BODY,
} from './constants';

// ============================================================================
// Headers Utilities
// ============================================================================

export {
  getClientIp,
  getEdgeClientIp,
  headersToRecord,
  isValidClientIp,
  resolveClientIp,
} from './headers';
export type { ClientIpOptions, HeaderLookup } from './headers';
export { isTrustedPeer, resolveByHopCount, resolveByPeerList } from './proxy-trust';
export type { ProxyTrust } from '@nextrush/types';

// ============================================================================
// Request Signal (timeout ↔ ctx.signal combiner)
// ============================================================================

export { combineAbortSignal, deriveDeadlineSignal } from './request-signal';
export type { CombinedAbort } from './request-signal';

// ============================================================================
// Server Startup Errors
// ============================================================================

export { normalizeStartupError, ServerStartError } from './server-error';
export type { ServerStartErrorCode } from './server-error';

// ============================================================================
// Uninitialized Capability Stubs (RFC-034)
// ============================================================================

export { UNINITIALIZED_COOKIES, UNINITIALIZED_SIGNED_COOKIES } from './capabilities';

// ============================================================================
// Web Response Builder (shared Fetch-API response logic for Bun/Deno/Edge)
// ============================================================================

export { assertHeaderSafe, isBodylessResponse, jsonErrorResponse, WebResponseBuilder } from './response-builder';

// ============================================================================
// Shared Web Context Base (F-08, ADR-0010)
// ============================================================================

export { WebContextBase } from './web-context-base';
export type { WebRawHttp, WebStreamRunners } from './web-context-base';

// ============================================================================
// Body Source
// ============================================================================

export {
  AbstractBodySource,
  BodyConsumedError,
  BodyTooLargeError,
  RequestAbortedError,
  DEFAULT_BODY_LIMIT,
  EmptyBodySource,
  WebBodySource,
  createEmptyBodySource,
  createWebBodySource,
} from './body-source';
