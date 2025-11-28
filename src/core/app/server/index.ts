/**
 * Server Module for NextRush v2
 *
 * Exports all server lifecycle and request handling utilities.
 *
 * @packageDocumentation
 */

// Request handling
export {
  createRequestHandler,
  executeMiddleware,
  executeRoute,
  type RequestHandlerConfig
} from '../request-handler';

// Server lifecycle
export {
  createHttpServer,
  createServerLifecycle,
  shutdownServer,
  startServer,
  type ServerConfig,
  type ServerLifecycle
} from '../server-lifecycle';

// Listen helpers
export {
  createListenHandler,
  parseListenParams,
  startServerWithCompilation,
  type ListenConfig,
  type ListenParams
} from '../listen-helpers';
