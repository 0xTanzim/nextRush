/**
 * @nextrush/adapter-node - TLS Server Construction Helper
 *
 * Extracted from adapter.ts (task 3.7 refactor) to keep the main adapter
 * within its line budget. Handles TLS certificate configuration and
 * `node:http2` secure server creation with ALPN negotiation.
 *
 * @packageDocumentation
 */

import type { Http2SecureServer, Http2Session } from 'node:http2';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

/**
 * Live HTTP/2 sessions per server, so the drain path can end them.
 *
 * @remarks
 * `Http2SecureServer` exposes neither `closeAllConnections` nor a way to enumerate
 * its sessions, and `server.close()` does NOT resolve while any session is open —
 * even one with no in-flight streams. That makes a plain `server.close()` hang for
 * the full shutdown timeout on every HTTP/2 shutdown. Tracking sessions here is what
 * lets {@link safeCloseIdleConnections} send GOAWAY and
 * {@link safeCloseAllConnections} destroy them.
 */
const http2SessionsByServer = new WeakMap<Server, Set<Http2Session>>();

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
 *
 * @remarks
 * `node:http2` is loaded on demand, not at module scope. Its initialisation is
 * native work measured at ~19 ms on Bun and 11–23 ms on Node, and the meta
 * package re-exports this adapter, so a static import charged that cost to every
 * cold start — including the overwhelmingly common non-TLS server that never
 * touches `createSecureServer`. `serve()` is already asynchronous, so awaiting
 * the import moves the cost to the only path that needs it.
 */
export async function createNodeServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
  tls?: TlsConfig
): Promise<Server> {
  if (!tls) {
    return createServer(handler);
  }

  const { createSecureServer } = await import('node:http2');

  const server = createSecureServer(
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

  // Track h2 sessions so the drain path can end them. `session.close()` sends GOAWAY
  // and lets in-flight streams finish, which is what makes `server.close()` resolve.
  const sessions = new Set<Http2Session>();
  http2SessionsByServer.set(server, sessions);
  (server as unknown as Http2SecureServer).on('session', (session: Http2Session) => {
    sessions.add(session);
    session.once('close', () => sessions.delete(session));
  });

  return server;
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
 *
 * @remarks
 * On an HTTP/2 server this instead sends GOAWAY to every tracked session. That is the
 * h2 equivalent of releasing idle connections: the session stops accepting new streams
 * but lets in-flight ones finish, and it is required for `server.close()` to ever
 * resolve (see {@link http2SessionsByServer}).
 */
export function safeCloseIdleConnections(server: Server): void {
  if ('closeIdleConnections' in server && typeof server.closeIdleConnections === 'function') {
    server.closeIdleConnections();
  }

  // Not an `else`: on Node 22 `Http2SecureServer` DOES define `closeIdleConnections`,
  // but its implementation only forwards to the HTTP/1 fallback path when
  // `allowHTTP1` is set — it does nothing for h2 sessions. Both paths must run.
  const sessions = http2SessionsByServer.get(server);
  if (!sessions) return;
  for (const session of sessions) {
    if (!session.closed && !session.destroyed) session.close();
  }
}

/**
 * Safely force-closes all connections, if the method exists.
 * `closeAllConnections` is available on `node:http.Server` (Node 18.2+)
 * but not on `Http2SecureServer`.
 *
 * @remarks
 * On an HTTP/2 server this destroys every tracked session outright, aborting any
 * in-flight streams. Used only when the drain timeout elapses.
 */
export function safeCloseAllConnections(server: Server): void {
  if ('closeAllConnections' in server && typeof server.closeAllConnections === 'function') {
    server.closeAllConnections();
  }

  // Same reason as {@link safeCloseIdleConnections}: h2 sessions are not covered by
  // the HTTP/1 connection APIs, so destroy them explicitly.
  const sessions = http2SessionsByServer.get(server);
  if (!sessions) return;
  for (const session of sessions) {
    if (!session.destroyed) session.destroy();
  }
  sessions.clear();
}
