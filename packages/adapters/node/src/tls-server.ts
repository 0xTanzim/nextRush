/**
 * @nextrush/adapter-node - TLS Server Construction Helper
 *
 * Extracted from adapter.ts (task 3.7 refactor) to keep the main adapter
 * within its line budget. Handles TLS certificate configuration and
 * `node:http2` secure server creation with ALPN negotiation.
 *
 * @packageDocumentation
 */

import { createSecureServer, type Http2SecureServer } from 'node:http2';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

/** TLS configuration passed through to `node:http2.createSecureServer`. */
export interface TlsConfig {
  cert: string | Buffer;
  key: string | Buffer;
  ca?: string | Buffer;
}

/**
 * Creates a Node HTTP server, selecting plain `node:http` or
 * `node:http2` secure server based on whether {@link ServeOptions.tls}
 * is present.
 *
 * When `tls` is provided, the server uses `allowHTTP1: true` so clients
 * that don't negotiate `h2` via ALPN fall back to HTTP/1.1 over TLS
 * transparently — matching design D4 (RFC-028).
 *
 * @returns The created server.
 */
export function createNodeServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
  tls?: TlsConfig
): Server {
  if (!tls) {
    return createServer(handler);
  }

  return createSecureServer(
    {
      cert: tls.cert,
      key: tls.key,
      ca: tls.ca,
      allowHTTP1: true,
    },
    // With allowHTTP1, the handler may receive http.IncomingMessage/ServerResponse
    // (HTTP/1.1 fallback) or http2.Http2ServerRequest/Http2ServerResponse (h2).
    // The handler's IncomingMessage/ServerResponse signature is the common denominator;
    // the context factory maps both types at runtime.
    handler as (...args: unknown[]) => void
  ) as unknown as Server;
}

/**
 * Returns `true` if the given server is an `Http2SecureServer` rather than
 * a plain `node:http.Server`.
 */
export function isHttp2Server(server: Server): server is Server & Http2SecureServer {
  return 'http2' in server;
}

/**
 * Safely releases idle connections from the server, if the method exists.
 * `closeIdleConnections` is available on `node:http.Server` (Node 18.2+)
 * but not on `Http2SecureServer` — callers should guard with
 * {@link isHttp2Server} or call this function unconditionally.
 */
export function safeCloseIdleConnections(server: Server): void {
  if ('closeIdleConnections' in server && typeof server.closeIdleConnections === 'function') {
    server.closeIdleConnections();
  }
}

/**
 * Safely force-closes all connections, if the method exists.
 * `closeAllConnections` is available on `node:http.Server` (Node 18.2+)
 * but not on `Http2SecureServer`.
 */
export function safeCloseAllConnections(server: Server): void {
  if ('closeAllConnections' in server && typeof server.closeAllConnections === 'function') {
    server.closeAllConnections();
  }
}
