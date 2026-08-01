/**
 * @nextrush/class - Type Definitions (barrel)
 *
 * Aggregates the per-concern type modules so existing `from './types.js'`
 * imports (within this package and downstream) keep resolving unchanged.
 * Definitions live in the cohesive sibling modules re-exported below.
 */

// Controller concern
export type {
  ControllerMetadata,
  ControllerOptions,
  MiddlewareRef,
} from './decorators/controller-types.js';

// Route concern
export type {
  ControllerRouteMetadata,
  RedirectMetadata,
  ResponseHeaderMetadata,
  RouteMethods,
  RouteOptions,
} from './decorators/route-types.js';
// Re-exporting the deprecated alias itself (for the one-minor backward-compat window) is not a
// violation of the deprecation — the rule should only fire on NEW consumers of the old name.
// eslint-disable-next-line @typescript-eslint/no-deprecated
export type { RouteMetadata } from './decorators/route-types.js';

// Parameter concern
export type {
  BodyOptions,
  CustomParamExtractor,
  HeaderOptions,
  ParamMetadata,
  ParamOptions,
  ParamSource,
  QueryOptions,
  TransformFn,
} from './binding/param-types.js';

// Guard concern
export type {
  CanActivate,
  Constructor,
  Guard,
  GuardContext,
  GuardFn,
  GuardMetadata,
} from './guards/guard-types.js';

// Exception filter concern
export type {
  ExceptionFilter,
  ExceptionFilterClass,
  FilterMetadata,
} from './filters/filter-types.js';

// Interceptor concern
export type {
  Interceptor,
  InterceptorClass,
  InterceptorMetadata,
} from './interceptors/interceptor-types.js';

// Service lifecycle concern
export type { OnInit, OnShutdown } from './lifecycle/lifecycle-types.js';

// Runtime values (metadata keys + type-guard helpers)
export {
  DECORATOR_METADATA_KEYS,
  isGuardClass,
  isValidHttpMethod,
  isValidParamSource,
} from './metadata/metadata-keys.js';

export { isOnInit, isOnShutdown } from './lifecycle/lifecycle-types.js';
