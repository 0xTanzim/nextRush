/**
 * @nextrush/dev - Runtime Detection
 *
 * Detects the current JavaScript runtime environment.
 * Supports Node.js, Bun, and Deno.
 *
 * @packageDocumentation
 */

/**
 * Supported runtime environments
 */
export type Runtime = 'node' | 'bun' | 'deno';

/**
 * Runtime information
 */
export interface RuntimeInfo {
  runtime: Runtime;
  version: string;
  supportsTypeScript: boolean;
  supportsWatch: boolean;
  needsSwc: boolean;
}

/**
 * Detect the current JavaScript runtime
 *
 * Detection order:
 * 1. Bun (has `Bun` global)
 * 2. Deno (has `Deno` global)
 * 3. Node.js (default fallback)
 */
export function detectRuntime(): Runtime {
  // Check for Bun
  if (typeof globalThis !== 'undefined' && 'Bun' in globalThis) {
    return 'bun';
  }

  // Check for Deno
  if (typeof globalThis !== 'undefined' && 'Deno' in globalThis) {
    return 'deno';
  }

  // Default to Node.js
  return 'node';
}

/**
 * Get detailed runtime information
 */
export function getRuntimeInfo(): RuntimeInfo {
  const runtime = detectRuntime();

  switch (runtime) {
    case 'bun':
      return {
        runtime: 'bun',
        version: getBunVersion(),
        supportsTypeScript: true, // Bun has native TS support
        supportsWatch: true,
        needsSwc: false, // Bun handles decorators natively
      };

    case 'deno':
      return {
        runtime: 'deno',
        version: getDenoVersion(),
        supportsTypeScript: true, // Deno has native TS support
        supportsWatch: true,
        needsSwc: false, // Deno handles decorators with config
      };

    case 'node':
    default:
      return {
        runtime: 'node',
        version: getNodeVersion(),
        supportsTypeScript: false, // Node.js needs transpilation
        supportsWatch: true, // Node.js 18+ has --watch
        needsSwc: true, // Need SWC for decorator metadata
      };
  }
}

/**
 * Check if current runtime is Node.js
 */
export function isNode(): boolean {
  return detectRuntime() === 'node';
}

/**
 * Check if current runtime is Bun
 */
export function isBun(): boolean {
  return detectRuntime() === 'bun';
}

/**
 * Check if current runtime is Deno
 */
export function isDeno(): boolean {
  return detectRuntime() === 'deno';
}

/**
 * Get the runtime executable name
 */
export function getRuntimeExecutable(): string {
  const runtime = detectRuntime();

  switch (runtime) {
    case 'bun':
      return 'bun';
    case 'deno':
      return 'deno';
    case 'node':
    default:
      return 'node';
  }
}

// Version helpers
function getNodeVersion(): string {
  try {
    return process.version.replace('v', '');
  } catch {
    return 'unknown';
  }
}

function getBunVersion(): string {
  try {
    // @ts-expect-error Bun global exists in Bun runtime
    return globalThis.Bun?.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function getDenoVersion(): string {
  try {
    // @ts-expect-error Deno global exists in Deno runtime
    return globalThis.Deno?.version?.deno ?? 'unknown';
  } catch {
    return 'unknown';
  }
}
