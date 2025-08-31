/**
 * WebSocket Plugin Type Augmentation
 *
 * This file provides type-safe WebSocket functionality through smart type casting
 * and utility types for perfect TypeScript intelligence.
 */

import type { Application, WSHandler, WSMiddleware } from '@/types/context';

// Export a type that represents an Application with WebSocket capabilities guaranteed
export interface WebSocketApplication extends Application {
  // Override optional methods to be required
  ws: (path: string, handler: WSHandler) => WebSocketApplication;
  wsUse: (middleware: WSMiddleware) => WebSocketApplication;
  wsBroadcast: (message: string, room?: string) => WebSocketApplication;
}

// Type guard to check if WebSocket plugin is installed
export function hasWebSocketSupport(
  app: Application
): app is WebSocketApplication {
  return 'ws' in app && typeof (app as any).ws === 'function';
}

// Smart type casting function for better DX
export function withWebSocket(app: Application): WebSocketApplication {
  if (!hasWebSocketSupport(app)) {
    throw new Error(
      'WebSocket plugin not installed. Install WebSocketPlugin first.'
    );
  }
  return app;
}
