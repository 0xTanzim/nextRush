/**
 * @nextrush/decorators - Type Definitions (barrel)
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
} from './controller-types.js';

// Route concern
export type {
  RedirectMetadata,
  ResponseHeaderMetadata,
  RouteMetadata,
  RouteMethods,
  RouteOptions,
} from './route-types.js';

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
} from './param-types.js';

// Guard concern
export type {
  CanActivate,
  Constructor,
  Guard,
  GuardContext,
  GuardFn,
  GuardMetadata,
} from './guard-types.js';

// Exception filter concern
export type {
  ExceptionFilter,
  ExceptionFilterClass,
  FilterMetadata,
} from './filter-types.js';

// Runtime values (metadata keys + type-guard helpers)
export {
  DECORATOR_METADATA_KEYS,
  isGuardClass,
  isValidHttpMethod,
  isValidParamSource,
} from './metadata-keys.js';
