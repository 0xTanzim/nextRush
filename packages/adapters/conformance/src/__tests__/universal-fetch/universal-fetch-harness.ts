/**
 * Test harness and runtime mock utilities for Universal Fetch (`app.fetch`)
 * and Multi-Prefix Router Mounting (`app.route(['/api', '/v1'], router)`).
 *
 * Provides typed mocks for Cloudflare Workers, Vercel Edge, Bun, and Deno runtime environments,
 * along with declaration merging to verify contract conformance.
 */

import { createApp, Application, type ApplicationOptions } from '@nextrush/core';
import { Router } from '@nextrush/router';
import '@nextrush/core';

declare module '@nextrush/types' {
  interface Context {
    /** Runtime environment bindings (Cloudflare KV, D1, etc.) */
    readonly env?: unknown;
    /** Extend request lifetime for background work */
    waitUntil(promise: Promise<unknown>): void;
  }
}

/**
 * Creates an Application pre-configured with a router (matching batteries-included `nextrush` entrypoint)
 */
export function createUniversalApp(options?: ApplicationOptions): Application {
  return createApp({
    router: new Router(),
    ...options,
  });
}

/**
 * Mock Cloudflare Workers ExecutionContext
 */
export interface MockCloudflareExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException?(): void;
  readonly scheduledPromises: Promise<unknown>[];
}

/**
 * Creates a mock Cloudflare Workers execution environment with (env, ctx)
 */
export function createMockCloudflareContext(envBindings: Record<string, unknown> = {}): {
  env: Record<string, unknown>;
  ctx: MockCloudflareExecutionContext;
} {
  const scheduledPromises: Promise<unknown>[] = [];
  const ctx: MockCloudflareExecutionContext = {
    scheduledPromises,
    waitUntil(promise: Promise<unknown>) {
      scheduledPromises.push(promise);
    },
    passThroughOnException() {
      // no-op
    },
  };
  return { env: envBindings, ctx };
}

/**
 * Mock Vercel Edge ExecutionContext
 */
export interface MockVercelExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  readonly scheduledPromises: Promise<unknown>[];
}

/**
 * Creates a mock Vercel Edge execution context (req, ctx)
 */
export function createMockVercelContext(): MockVercelExecutionContext {
  const scheduledPromises: Promise<unknown>[] = [];
  return {
    scheduledPromises,
    waitUntil(promise: Promise<unknown>) {
      scheduledPromises.push(promise);
    },
  };
}

/**
 * Mock Bun Server instance for (req, server)
 */
export interface MockBunServer {
  requestIP(request: Request): { address: string; port: number; family: string } | null;
  upgrade(request: Request, options?: unknown): boolean;
  port: number;
  development: boolean;
}

/**
 * Creates a mock Bun server
 */
export function createMockBunServer(ipAddress = '192.168.1.100'): MockBunServer {
  return {
    port: 3000,
    development: true,
    requestIP(_req: Request) {
      if (!ipAddress) return null;
      return { address: ipAddress, port: 44321, family: 'IPv4' };
    },
    upgrade(_req: Request) {
      return true;
    },
  };
}

/**
 * Mock Deno ServeHandlerInfo for (req, info)
 */
export interface MockDenoServeHandlerInfo {
  remoteAddr: {
    transport: 'tcp' | 'udp';
    hostname: string;
    port: number;
  };
}

/**
 * Creates a mock Deno ServeHandlerInfo
 */
export function createMockDenoInfo(hostname = '10.0.0.42'): MockDenoServeHandlerInfo {
  return {
    remoteAddr: {
      transport: 'tcp',
      hostname,
      port: 54321,
    },
  };
}

/**
 * Creates a standard Web Request
 */
export function createRequest(
  urlOrPath: string,
  init?: RequestInit
): Request {
  const fullUrl = urlOrPath.startsWith('http')
    ? urlOrPath
    : `http://localhost${urlOrPath.startsWith('/') ? '' : '/'}${urlOrPath}`;
  return new Request(fullUrl, init);
}

/**
 * Helper to extract response text or JSON, handling both sync Response and Promise<Response>
 */
export async function unwrapResponse(
  resOrPromise: Response | Promise<Response>
): Promise<{
  status: number;
  headers: Headers;
  text: string;
  json: <T = unknown>() => T;
}> {
  const res = await resOrPromise;
  const text = await res.text();
  return {
    status: res.status,
    headers: res.headers,
    text,
    json: <T = unknown>() => {
      try {
        return JSON.parse(text) as T;
      } catch (e) {
        throw new Error(`Failed to parse response body as JSON. Body was: "${text}"`);
      }
    },
  };
}
