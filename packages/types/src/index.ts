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
  // Method types
  type HttpMethod,
  type CommonHttpMethod,

  // Header types
  type IncomingHeaders,
  type OutgoingHeaders,

  // Status codes
  HttpStatus,
  type HttpStatusCode,

  // Body types
  type ParsedBody,
  type ResponseBody,

  // Raw HTTP
  type RawHttp,

  // Content types
  ContentType,
  type ContentTypeValue,
} from './http';

// ============================================================================
// Context Types
// ============================================================================

export {
  // Context interface
  type Context,

  // Parameter types
  type RouteParams,
  type QueryParams,

  // State
  type ContextState,

  // Middleware
  type Middleware,
  type Next,
  type RouteHandler,

  // Factory options
  type ContextOptions,
} from './context';

// ============================================================================
// Plugin Types
// ============================================================================

export {
  // Plugin interface
  type Plugin,
  type PluginWithHooks,

  // Plugin utilities
  type PluginFactory,
  type PluginMeta,

  // Application interface for plugins
  type ApplicationLike,
} from './plugin';

// ============================================================================
// Router Types
// ============================================================================

export {
  // Router interface
  type Router,

  // Route types
  type Route,
  type RouteMatch,

  // Router options
  type RouterOptions,

  // Pattern types
  type RoutePattern,
  type RouteParam,
} from './router';
