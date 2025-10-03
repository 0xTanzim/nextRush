/**
 * Vitest Setup File
 * Runs before all tests to configure the test environment
 */

import { WebSocket } from 'ws';

// Polyfill WebSocket globally for all tests
if (!globalThis.WebSocket) {
  (globalThis as any).WebSocket = WebSocket;
}

// Set longer timeouts for CI environments
if (process.env.CI || process.env.ACT) {
  console.log('🔧 CI Environment detected - Using extended timeouts');
}

// Export empty to make TypeScript happy
export {};
