/**
 * @nextrush/adapter-node - Node.js HTTP Adapter
 *
 * This package provides the Node.js HTTP adapter for NextRush.
 * It connects the Application to Node.js's http.createServer.
 *
 * @packageDocumentation
 * @module @nextrush/adapter-node
 */

// Adapter
export { createHandler, listen, serve } from './adapter';
export type { ServeOptions, ServerInstance } from './adapter';

// Context
export { HttpError, NodeContext, createNodeContext } from './context';

// Utilities
export { getContentLength, getContentType, parseQueryString } from './utils';

// Re-export types
export type { Application } from '@nextrush/core';
export type { Context, HttpMethod, Middleware } from '@nextrush/types';
