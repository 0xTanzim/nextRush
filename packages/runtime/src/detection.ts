/**
 * @nextrush/runtime - Runtime Detection
 *
 * Detect the current JavaScript runtime environment.
 *
 * @packageDocumentation
 */

import type { PlatformId, Runtime, RuntimeCapabilities, RuntimeInfo } from '@nextrush/types';

/**
 * Detect the current JavaScript runtime
 *
 * @remarks
 * Detection order matters - more specific runtimes are checked first:
 * 1. Bun (has global `Bun` object)
 * 2. Deno Deploy (has global `Deno` + `DENO_DEPLOYMENT_ID` env var)
 * 3. Deno (has global `Deno` object)
 * 4. Cloudflare Workers (has `navigator.userAgent` with 'Cloudflare-Workers')
 * 5. Node.js (has `process.versions.node`)
 * 6. Vercel Edge (has `process.env.VERCEL_REGION` but NOT `process.versions.node`)
 * 7. Generic Edge (has `Request` but no Node.js process)
 * 8. Unknown
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
    // Deno Deploy sets DENO_DEPLOYMENT_ID in the environment.
    // Detect it before falling back to generic 'deno' so that
    // consumers can apply edge-specific logic (no filesystem, etc.).
    try {
      const denoGlobal = (globalThis as Record<string, unknown>).Deno;
      if (typeof denoGlobal === 'object' && denoGlobal !== null && 'env' in denoGlobal) {
        const env = denoGlobal.env as { get?: (key: string) => string | undefined };
        if (typeof env.get === 'function') {
          const deployId = env.get('DENO_DEPLOYMENT_ID');
          if (deployId) return 'deno-deploy';
        }
      }
    } catch {
      // Env access may throw in sandboxed contexts — fall through to 'deno'
    }
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

  // Node.js - Check for process.versions.node (before Vercel Edge to avoid misclassification)
  if (
    typeof process !== 'undefined' &&
    typeof process.versions === 'object' &&
    typeof process.versions.node === 'string'
  ) {
    return 'node';
  }

  // Vercel Edge - Check for VERCEL_REGION environment variable (after Node.js check)
  if (
    typeof process !== 'undefined' &&
    typeof process.env === 'object' &&
    process.env.VERCEL_REGION !== undefined
  ) {
    return 'vercel-edge';
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

// Cache for edge detection (computed once). Declared alongside cachedRuntime so
// resetRuntimeCache() does not forward-reference a later `let` (audit R-5).
let cachedEdgeInfo: EdgeRuntimeInfo | undefined;

// Cache for platform detection (computed once, RFC-026).
let cachedPlatformInfo: PlatformInfo | undefined;

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
  cachedRuntime ??= detectRuntime();
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
      return typeof process !== 'undefined' ? process.versions.node : undefined;

    case 'bun': {
      const bun = (globalThis as unknown as Record<string, { version: string } | undefined>).Bun;
      return typeof bun !== 'undefined' ? bun.version : undefined;
    }

    case 'deno':
    case 'deno-deploy': {
      const deno = (globalThis as unknown as Record<string, { version: { deno: string } } | undefined>)
        .Deno;
      return typeof deno !== 'undefined' ? deno.version.deno : undefined;
    }

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
  return capabilitiesFor(getRuntime());
}

/**
 * Probe the current environment's Web-platform capabilities.
 *
 * @remarks
 * Used as the capability answer for `'unknown'`/future runtimes (audit R-3):
 * instead of reporting an all-`false` matrix — which would make the framework
 * disable features a capable-but-unrecognized runtime actually supports — we
 * feature-detect the relevant globals. `nodeStreams`/`fileSystem` cannot be
 * probed without importing `node:*`, so they stay conservative (`false`).
 */
function probeCapabilities(): RuntimeCapabilities {
  const hasFetch = typeof globalThis.fetch === 'function';
  const hasWebStreams = typeof (globalThis as { ReadableStream?: unknown }).ReadableStream !== 'undefined';
  const g = globalThis as {
    WebSocket?: unknown;
    crypto?: { subtle?: unknown } | null;
    Worker?: unknown;
  };
  return {
    nodeStreams: false,
    webStreams: hasWebStreams,
    fileSystem: false,
    webSocket: typeof g.WebSocket !== 'undefined',
    fetch: hasFetch,
    cryptoSubtle: typeof g.crypto === 'object' && g.crypto !== null && 'subtle' in g.crypto,
    workers: typeof g.Worker !== 'undefined',
    secureServing: false, // Cannot be probed — requires server-construction API
    http2: false, // Cannot be probed — requires server-construction API
  };
}

/**
 * Resolve the capability matrix for a given runtime.
 *
 * @remarks
 * Extracted from {@link getRuntimeCapabilities} so it is pure and unit-testable
 * (audit R-3). Known runtimes use a curated matrix; `'unknown'` (and any future
 * runtime that falls through) is answered by {@link probeCapabilities} rather
 * than a blanket all-`false`.
 *
 * @param runtime - The runtime to describe.
 * @returns The capability matrix for that runtime.
 */
export function capabilitiesFor(runtime: Runtime): RuntimeCapabilities {
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
        secureServing: true,
        http2: true,
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
        secureServing: true,
        http2: false, // Bun.serve() TLS does not negotiate h2 via ALPN — see RFC-028 §Risks
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
        secureServing: true,
        http2: true, // Deno.serve() negotiates HTTP/2 via ALPN automatically once cert is supplied
      };

    case 'deno-deploy':
      return {
        nodeStreams: false,
        webStreams: true,
        fileSystem: false, // Deno Deploy has no persistent filesystem
        webSocket: true,
        fetch: true,
        cryptoSubtle: true,
        workers: false, // Deno Deploy has limited worker support
        secureServing: false,
        http2: false,
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
        secureServing: false, // Platform terminates TLS
        http2: false, // Platform handles protocol negotiation
      };

    default:
      return probeCapabilities();
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
  // capability-exempt: detection helper (adapter selection / "which platform"), not a capability decision.
  return runtime === 'cloudflare-workers' || runtime === 'vercel-edge' || runtime === 'edge';
}

/**
 * Reset the cached runtime (for testing)
 * @internal
 */
export function resetRuntimeCache(): void {
  cachedRuntime = undefined;
  cachedEdgeInfo = undefined;
  cachedPlatformInfo = undefined;
}

// ============================================================================
// Edge Runtime Detection
// ============================================================================

/**
 * Detailed edge runtime information
 */
export interface EdgeRuntimeInfo {
  runtime: Runtime;
  isCloudflare: boolean;
  isVercel: boolean;
  isNetlify: boolean;
  isGenericEdge: boolean;
}

// Cache for edge detection is declared near cachedRuntime (see above).

/**
 * Detect the specific edge runtime platform.
 *
 * Provides more granular information than `detectRuntime()` for edge runtimes,
 * including platform-specific flags (Cloudflare, Vercel, Netlify).
 *
 * Result is cached after first call.
 *
 * @returns Detailed edge runtime info with platform flags
 */
export function detectEdgeRuntime(): EdgeRuntimeInfo {
  if (cachedEdgeInfo !== undefined) return cachedEdgeInfo;

  // NOTE (audit R-2): detectEdgeRuntime answers a *different* question than
  // detectRuntime() — "which edge platform am I on" (defaulting to generic
  // 'edge'), not "which JS engine". They intentionally differ (e.g. Netlify
  // Edge runs on Deno: detectRuntime()='deno', detectEdgeRuntime()='edge'
  // + isNetlify). Kept independent so the edge adapter's platform contract
  // holds; the shared code is only the small platform-flag probes below.
  let runtime: Runtime = 'edge';
  let isCloudflare = false;
  let isVercel = false;
  let isNetlify = false;

  // Cloudflare Workers
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.userAgent === 'string' &&
    navigator.userAgent.includes('Cloudflare-Workers')
  ) {
    runtime = 'cloudflare-workers';
    isCloudflare = true;
  }
  // Vercel Edge
  else if (
    typeof process !== 'undefined' &&
    typeof process.env === 'object' &&
    process.env.VERCEL_REGION !== undefined
  ) {
    runtime = 'vercel-edge';
    isVercel = true;
  }
  // Netlify Edge (uses Deno under the hood)
  else if (
    typeof (globalThis as { Deno?: unknown }).Deno !== 'undefined' &&
    typeof process !== 'undefined' &&
    typeof process.env === 'object' &&
    process.env.NETLIFY === 'true'
  ) {
    runtime = 'edge';
    isNetlify = true;
  }

  cachedEdgeInfo = {
    runtime,
    isCloudflare,
    isVercel,
    isNetlify,
    isGenericEdge: !isCloudflare && !isVercel && !isNetlify,
  };

  return cachedEdgeInfo;
}

// ============================================================================
// Named Platform Detection (RFC-026)
// ============================================================================

/**
 * Detected named deployment platform, or `undefined` when none is recognized.
 *
 * @see RFC-026
 */
export interface PlatformInfo {
  platform: PlatformId | undefined;
}

/**
 * Detect the named serverless/edge deployment platform, independent of
 * {@link Runtime}.
 *
 * @remarks
 * Deliberately reuses {@link detectEdgeRuntime}'s exact three named-platform
 * branches (Cloudflare/Vercel/Netlify) rather than adding a fourth detection
 * path — this is the *platform* dimension of the same probe, not a new one.
 * Serverless platforms (Lambda, GCF, Azure) are never detected here: each
 * Tier-1 serverless handler already knows its own platform identity and
 * passes it through explicitly (see `@nextrush/adapter-serverless`) — no
 * heuristic is needed or attempted for them.
 *
 * Result is cached after first call, mirroring {@link detectEdgeRuntime}.
 *
 * @returns The detected platform, or `undefined` if none of the three named
 *   edge platforms (or an explicitly-passed serverless platform) applies.
 */
export function detectPlatform(): PlatformInfo {
  if (cachedPlatformInfo !== undefined) return cachedPlatformInfo;

  const edge = detectEdgeRuntime();
  let platform: PlatformId | undefined;
  if (edge.isCloudflare) platform = 'cloudflare-workers';
  else if (edge.isVercel) platform = 'vercel-edge';
  else if (edge.isNetlify) platform = 'netlify-edge';

  cachedPlatformInfo = { platform };
  return cachedPlatformInfo;
}
