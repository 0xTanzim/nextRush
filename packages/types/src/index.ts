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
// Plugin Types
// ============================================================================

export {
  // Application interface for plugins
  type ApplicationLike,
  // Plugin interface
  type Plugin,
  // Plugin utilities
  type PluginFactory,
  type PluginMeta,
  type PluginWithHooks,
} from './plugin';

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
  type Runtime,
  type RuntimeCapabilities,
  type RuntimeInfo,
} from './runtime';
