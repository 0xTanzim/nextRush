/**
 * @nextrush/runtime - Runtime Detection
 *
 * Detect the current JavaScript runtime environment.
 *
 * @packageDocumentation
 */

import type { Runtime, RuntimeCapabilities, RuntimeInfo } from '@nextrush/types';

/**
 * Detect the current JavaScript runtime
 *
 * @remarks
 * Detection order matters - more specific runtimes are checked first:
 * 1. Bun (has global `Bun` object)
 * 2. Deno (has global `Deno` object)
 * 3. Cloudflare Workers (has `navigator.userAgent` with 'Cloudflare-Workers')
 * 4. Vercel Edge (has `process.env.VERCEL_REGION`)
 * 5. Node.js (has `process.versions.node`)
 * 6. Generic Edge (has `Request` but no Node.js process)
 * 7. Unknown
 *
 * @returns The detected runtime identifier
 *
 * @example
 * ```typescript
 * import { detectRuntime } from '@nextrush/runtime';
 *
 * const runtime = detectRuntime();
 *
 * if (runtime === 'bun') {
 *   console.log('Running on Bun!');
 * } else if (runtime === 'node') {
 *   console.log('Running on Node.js');
 * }
 * ```
 */
export function detectRuntime(): Runtime {
  // Bun - Check for global Bun object
  if (typeof globalThis !== 'undefined' && 'Bun' in globalThis) {
    return 'bun';
  }

  // Deno - Check for global Deno object
  if (typeof globalThis !== 'undefined' && 'Deno' in globalThis) {
    return 'deno';
  }

  // Cloudflare Workers - Check navigator.userAgent
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.userAgent === 'string' &&
    navigator.userAgent.includes('Cloudflare-Workers')
  ) {
    return 'cloudflare-workers';
  }

  // Vercel Edge - Check for VERCEL_REGION environment variable
  if (
    typeof process !== 'undefined' &&
    typeof process.env === 'object' &&
    process.env.VERCEL_REGION !== undefined
  ) {
    return 'vercel-edge';
  }

  // Node.js - Check for process.versions.node
  if (
    typeof process !== 'undefined' &&
    typeof process.versions === 'object' &&
    typeof process.versions.node === 'string'
  ) {
    return 'node';
  }

  // Generic Edge Runtime - Has Web APIs but not Node.js
  if (
    typeof globalThis !== 'undefined' &&
    typeof globalThis.Request !== 'undefined' &&
    typeof globalThis.Response !== 'undefined'
  ) {
    return 'edge';
  }

  return 'unknown';
}

// Cache for runtime detection (computed once)
let cachedRuntime: Runtime | undefined;

/**
 * Get the current runtime (cached)
 *
 * @remarks
 * This function caches the result of `detectRuntime()` for performance.
 * Use this in production code where runtime detection happens frequently.
 *
 * @returns The cached runtime identifier
 *
 * @example
 * ```typescript
 * import { getRuntime } from '@nextrush/runtime';
 *
 * // First call detects and caches
 * const runtime1 = getRuntime();
 *
 * // Subsequent calls return cached value
 * const runtime2 = getRuntime(); // Same as runtime1, no re-detection
 * ```
 */
export function getRuntime(): Runtime {
  if (cachedRuntime === undefined) {
    cachedRuntime = detectRuntime();
  }
  return cachedRuntime;
}

/**
 * Get the runtime version string
 *
 * @returns Version string or undefined if not available
 *
 * @example
 * ```typescript
 * import { getRuntimeVersion } from '@nextrush/runtime';
 *
 * console.log(getRuntimeVersion());
 * // Node.js: '20.10.0'
 * // Bun: '1.0.0'
 * // Deno: '1.38.0'
 * ```
 */
export function getRuntimeVersion(): string | undefined {
  const runtime = getRuntime();

  switch (runtime) {
    case 'node':
      return typeof process !== 'undefined' ? process.versions?.node : undefined;

    case 'bun':
      // @ts-expect-error - Bun global is not typed in Node.js
      return typeof Bun !== 'undefined' ? Bun.version : undefined;

    case 'deno':
      // @ts-expect-error - Deno global is not typed in Node.js
      return typeof Deno !== 'undefined' ? Deno.version?.deno : undefined;

    default:
      return undefined;
  }
}

/**
 * Get runtime capabilities
 *
 * @remarks
 * Different runtimes support different features. Use this to check
 * what's available before using runtime-specific APIs.
 *
 * @returns Object describing runtime capabilities
 *
 * @example
 * ```typescript
 * import { getRuntimeCapabilities } from '@nextrush/runtime';
 *
 * const caps = getRuntimeCapabilities();
 *
 * if (caps.fileSystem) {
 *   // Safe to use fs operations
 * }
 *
 * if (caps.webStreams) {
 *   // Safe to use ReadableStream
 * }
 * ```
 */
export function getRuntimeCapabilities(): RuntimeCapabilities {
  const runtime = getRuntime();

  const baseCapabilities: RuntimeCapabilities = {
    nodeStreams: false,
    webStreams: false,
    fileSystem: false,
    webSocket: false,
    fetch: false,
    cryptoSubtle: false,
    workers: false,
  };

  switch (runtime) {
    case 'node':
      return {
        nodeStreams: true,
        webStreams: true, // Node.js 18+ has web streams
        fileSystem: true,
        webSocket: true,
        fetch: true, // Node.js 18+ has native fetch
        cryptoSubtle: true,
        workers: true,
      };

    case 'bun':
      return {
        nodeStreams: true, // Bun supports Node.js streams
        webStreams: true,
        fileSystem: true,
        webSocket: true,
        fetch: true,
        cryptoSubtle: true,
        workers: true,
      };

    case 'deno':
      return {
        nodeStreams: false, // Deno uses web streams by default
        webStreams: true,
        fileSystem: true,
        webSocket: true,
        fetch: true,
        cryptoSubtle: true,
        workers: true,
      };

    case 'cloudflare-workers':
    case 'vercel-edge':
    case 'edge':
      return {
        nodeStreams: false,
        webStreams: true,
        fileSystem: false, // Edge runtimes have no filesystem
        webSocket: true,
        fetch: true,
        cryptoSubtle: true,
        workers: false, // Limited worker support
      };

    default:
      return baseCapabilities;
  }
}

/**
 * Get complete runtime information
 *
 * @returns Object with runtime, version, and capabilities
 *
 * @example
 * ```typescript
 * import { getRuntimeInfo } from '@nextrush/runtime';
 *
 * const info = getRuntimeInfo();
 * console.log(info);
 * // {
 * //   runtime: 'node',
 * //   version: '20.10.0',
 * //   capabilities: { nodeStreams: true, webStreams: true, ... }
 * // }
 * ```
 */
export function getRuntimeInfo(): RuntimeInfo {
  return {
    runtime: getRuntime(),
    version: getRuntimeVersion(),
    capabilities: getRuntimeCapabilities(),
  };
}

/**
 * Check if running on a specific runtime
 *
 * @param runtime - Runtime to check for
 * @returns True if running on the specified runtime
 *
 * @example
 * ```typescript
 * import { isRuntime } from '@nextrush/runtime';
 *
 * if (isRuntime('bun')) {
 *   // Bun-specific code
 * }
 * ```
 */
export function isRuntime(runtime: Runtime): boolean {
  return getRuntime() === runtime;
}

/**
 * Check if running on Node.js
 */
export function isNode(): boolean {
  return isRuntime('node');
}

/**
 * Check if running on Bun
 */
export function isBun(): boolean {
  return isRuntime('bun');
}

/**
 * Check if running on Deno
 */
export function isDeno(): boolean {
  return isRuntime('deno');
}

/**
 * Check if running on an edge runtime
 *
 * @remarks
 * Returns true for Cloudflare Workers, Vercel Edge, and generic edge runtimes.
 */
export function isEdge(): boolean {
  const runtime = getRuntime();
  return runtime === 'cloudflare-workers' || runtime === 'vercel-edge' || runtime === 'edge';
}

/**
 * Reset the cached runtime (for testing)
 * @internal
 */
export function resetRuntimeCache(): void {
  cachedRuntime = undefined;
}
