/**
 * @internal
 * Internal barrel for symbols used within @nextrush/class that must not be public.
 * This module is strictly for intra-package use only.
 *
 * DO NOT import from this file outside packages/class/src/**
 * DO NOT re-export anything from this file through index.ts
 */

// Bootstrap internals — used by registrar but not public API
export { bootstrapPipeline } from './bootstrap/pipeline.js';
export type { BootstrapContext, ResolvedBootstrapOptions } from './bootstrap/context.js';

// Graph utilities — used by bootstrap but not public API
export { deepFreeze } from './bootstrap/graph.js';

// Route builder — buildRoutes is re-exported publicly from ./index.ts because
// the registrar (ControllerRegistry) and the package's own test suite call it
// directly; it is not purely an internal implementation detail.

export type { ClassRef } from './discovery/source.js';
