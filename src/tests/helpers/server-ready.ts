/**
 * Helper function to wait for server to be ready in CI/CD environment
 * Ensures server has bound to port before tests execute
 */

import type { Application } from '@/types/context';

/**
 * Wait for server to be ready after calling app.listen()
 * This handles the async nature of server.listen() callback
 */
export async function waitForServerReady(
  app: Application,
  port: number,
  host?: string
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      // Server is now listening
      resolve(server);
    });

    // Cast to any to access .on() method since listen() returns unknown
    const serverWithEvents = server as any;
    if (serverWithEvents && typeof serverWithEvents.on === 'function') {
      serverWithEvents.on('error', (err: Error) => {
        console.error('Server failed to start:', err);
        reject(err);
      });
    }
  });
}

/**
 * Start server and wait for it to be ready with additional delay
 * Use this in beforeAll/beforeEach hooks
 */
export async function startServerAndWait(
  app: Application,
  port: number,
  host?: string,
  extraWaitMs = 100
): Promise<unknown> {
  const server = await waitForServerReady(app, port, host);
  
  // Additional wait for network stack readiness (important in Docker/CI)
  if (extraWaitMs > 0) {
    await new Promise(resolve => setTimeout(resolve, extraWaitMs));
  }
  
  return server;
}
