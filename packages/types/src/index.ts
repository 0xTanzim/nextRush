/**
 * @nextrush/types - NextRush Framework Type Definitions
 *
 * This package provides shared TypeScript types for the NextRush framework.
 * It has zero runtime dependencies and is used by all other NextRush packages.
 *
 * @packageDocumentation
 * @module @nextrush/types
 */

// ============================================================================
// HTTP Types
// ============================================================================

export {
  // Content types
  ContentType,
  // HTTP methods tuple for iteration
  HTTP_METHODS,
  // Status codes
  HttpStatus,
  type CommonHttpMethod,
  type ContentTypeValue,
  // Method types
  type HttpMethod,
  type HttpStatusCode,
  // Header types
  type IncomingHeaders,
  // Stream types
  type NodeStreamLike,
  type OutgoingHeaders,
  // Body types
  type ParsedBody,
  // Raw HTTP
  type RawHttp,
  type ResponseBody,
  type WebStreamLike,
} from './http';

// ============================================================================
// Context Types
// ============================================================================

export {
  // Context interface
  type Context,
  // Factory options
  type ContextOptions,
  // State
  type ContextState,

  // Middleware
  type Middleware,
  type Next,
  type QueryParams,
  type RouteHandler,
  // Parameter types
  type RouteParams,
} from './context';

// ============================================================================
// Deferred Request-Body Reader Contract (RFC-047, internal)
// ----------------------------------------------------------------------------
// The slot a lazy body parser installs on a context and `Context.readBody()`
// delegates to. Marked `@internal`: a protocol between the body parser and the
// context, not documented application surface.
// ============================================================================

export {
  BODY_READER,
  type BodyReaderCarrier,
  type DeferredBodyReader,
} from './body-reader';

// ============================================================================
// Cookie Capability Contracts (RFC-034) — implemented by @nextrush/cookies
// ============================================================================

export {
  type CookieCapability,
  type CookieOptions,
  type CookiePriority,
  type ParsedCookies,
  type SameSiteValue,
  type SignedCookieCapability,
} from './cookies';

// ============================================================================
// Adapter Context Contracts (F-13) — additive supersets of Context
// ============================================================================

export {
  // Lifecycle primitive exposed by every adapter
  type AdapterContext,
  // Shared context-factory shape (adapters build Context via a factory)
  type AdapterContextFactory,
  // Web/fetch adapter surface (getResponse/waitUntil/env)
  type FetchContext,
} from './adapter-context';

// ============================================================================
// Adapter Conformance Contract (F-01) — light `satisfies` shapes
// ============================================================================

export {
  type FetchAdapter,
  type FetchHandler,
  type FetchHandlerOptions,
  type HandlerOptions,
  // Adapter shapes
  type ServerAdapter,
  // Canonical address + handle
  type ServerAddress,
  type ServerHandle,
} from './adapter';

// ============================================================================
// Extension Types (see docs/RFC/class-runtime/005-plugin-system.md)
// ============================================================================

export {
  // Extension contract
  type Extension,
  // The setup() argument
  type ExtensionContext,
  // Structural app surface available to extensions
  type ExtensionHost,
} from './extension';

// ============================================================================
// Logger Contract
// ============================================================================

export { type Logger } from './logger';

// ============================================================================
// Dependency Injection Contract
// ============================================================================

export {
  type ClassProvider,
  type Constructor,
  type Container,
  type FactoryProvider,
  type Provider,
  type RegisterOptions,
  type Scope,
  type ServiceOptions,
  type Token,
  type ValueProvider,
} from './container';

// ============================================================================
// Router Types
// ============================================================================

export {
  // Route types
  type Route,
  type RouteMatch,
  type RouteParam,
  // Pattern types
  type RoutePattern,
  // Router interface
  type Router,
  // Router options
  type RouterOptions,
} from './router';

// ============================================================================
// Runtime Types
// ============================================================================

export {
  // Body source abstraction
  type BodySource,
  type BodySourceOptions,
  // Runtime detection
  type PlatformId,
  type ProxyTrust,
  type Runtime,
  type RuntimeCapabilities,
  type RuntimeInfo,
} from './runtime';

// ============================================================================
// Response Streaming Contracts
// ============================================================================

export {
  // Writer contracts
  type BaseStreamWriter,
  type NDJSONStreamWriter,
  // Event shape
  type SSEEvent,
  type SSEStreamWriter,
  // Source + callback shapes
  type StreamRun,
  type StreamSource,
  type TextStreamWriter,
} from './stream';

// ============================================================================
// Standard Schema Contract (shared by validation, route metadata, openapi)
// ============================================================================

export {
  type InferOutput,
  type StandardSchemaIssue,
  type StandardSchemaPathSegment,
  type StandardSchemaProps,
  type StandardSchemaResult,
  type StandardSchemaV1,
} from './standard-schema';

// ============================================================================
// Route Metadata Contracts (source of truth for OpenAPI & future renderers)
// ============================================================================

export {
  // Contribution protocol symbol (value export)
  ROUTE_METADATA,
  type MetadataContribution,
  // The canonical endpoint descriptor
  type RouteDefinition,
  type RouteEntry,
  type RouteMetadata,
  type RouteMetaMarker,
} from './route-metadata';

// ============================================================================
// Security Audit Contribution Contract (`security-boundaries` capability)
// ============================================================================

export {
  // Contribution protocol symbol (value export)
  SECURITY_AUDIT,
  type AuditableMiddleware,
  type SecurityAuditCheck,
  type SecurityAudited,
  type SecurityAuditVerdict,
} from './security-audit';

// ============================================================================
// Recorded Outgoing Response Contract (internal)
// ----------------------------------------------------------------------------
// `@nextrush/runtime` owns the record; this is the symbol a context exposes it
// under and the shape a response-aware middleware may rely on. Marked
// `@internal`: no semver guarantee and not part of the documented `Context`
// surface.
// ============================================================================

export {
  OUTGOING_RESPONSE,
  type OutgoingResponseHandle,
} from './outgoing-response';

// ============================================================================
// Synchronous Dispatch Marker (internal)
// ----------------------------------------------------------------------------
// Set by a route executor whose handler settled without leaving work pending,
// read by the Web runner to answer without awaiting. Marked `@internal`: it is a
// protocol between the router and the adapters, not public application surface.
// ============================================================================

export { DISPATCH_SETTLED_SYNC, type DispatchMarkerCarrier } from './dispatch-marker';

