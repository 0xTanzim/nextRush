/**
 * 🔧 Framework Adapter Registry
 *
 * Centralized registry for all framework adapters with smart loading
 */

import { FrameworkAdapter } from '../core/types.js';

// Type for adapter constructor
type AdapterConstructor = new () => FrameworkAdapter;

// Registry of available adapters
const adapterRegistry = new Map<string, AdapterConstructor>();

/**
 * Register a framework adapter
 */
export function registerAdapter(
  name: string,
  AdapterClass: AdapterConstructor
): void {
  adapterRegistry.set(name.toLowerCase(), AdapterClass);
}

/**
 * Get all registered adapter names
 */
export function getRegisteredAdapters(): string[] {
  return Array.from(adapterRegistry.keys());
}

/**
 * Create an adapter instance if available
 */
export async function createAdapter(
  name: string
): Promise<FrameworkAdapter | null> {
  const AdapterClass = adapterRegistry.get(name.toLowerCase());
  if (!AdapterClass) {
    return null;
  }

  const adapter = new AdapterClass();

  // Check if the framework is actually available
  const isAvailable = await adapter.isAvailable();
  if (!isAvailable) {
    const info = await adapter.getInfo();
    console.warn(
      `⚠️  ${info.name} is not available. Install with: ${info.installCommand}`
    );
    return null;
  }

  return adapter;
}

/**
 * Get available adapters (only those that can actually run)
 */
export async function getAvailableAdapters(): Promise<string[]> {
  const available: string[] = [];

  for (const name of adapterRegistry.keys()) {
    const adapter = await createAdapter(name);
    if (adapter) {
      available.push(name);
      await adapter.cleanup(); // Clean up test instance
    }
  }

  return available;
}

/**
 * Auto-register adapters based on availability
 */
export async function autoRegisterAdapters(): Promise<void> {
  // Always register NextRush (built-in)
  try {
    const { NextRushAdapter } = await import('./nextrush.js');
    registerAdapter('nextrush', NextRushAdapter);
  } catch (error) {
    console.warn('⚠️  NextRush adapter failed to load:', error);
  }

  // Try to register Express
  try {
    const { ExpressAdapter } = await import('./express.js');
    registerAdapter('express', ExpressAdapter);
  } catch (error) {
    console.warn(
      '⚠️  Express adapter failed to load - framework may not be installed'
    );
  }

  // Try to register Fastify
  try {
    const { FastifyAdapter } = await import('./fastify.js');
    registerAdapter('fastify', FastifyAdapter);
  } catch (error) {
    console.warn(
      '⚠️  Fastify adapter failed to load - framework may not be installed'
    );
  }

  // Try to register Koa
  try {
    const { KoaAdapter } = await import('./koa.js');
    registerAdapter('koa', KoaAdapter);
  } catch (error) {
    console.warn(
      '⚠️  Koa adapter failed to load - framework may not be installed'
    );
  }

  // Try to register Hapi
  try {
    const { HapiAdapter } = await import('./hapi.js');
    registerAdapter('hapi', HapiAdapter);
  } catch (error) {
    console.warn(
      '⚠️  Hapi adapter failed to load - framework may not be installed'
    );
  }
}
