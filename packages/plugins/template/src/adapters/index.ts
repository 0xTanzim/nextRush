/**
 * Template Engine Adapters
 *
 * This module provides adapters for popular template engines.
 * Each adapter implements the TemplateAdapter interface for a unified API.
 *
 * @packageDocumentation
 * @module @nextrush/template/adapters
 */

import type {
    AdapterConfig,
    AdapterFactory,
    EngineName,
    TemplateAdapter,
} from './types';

import { createBuiltinAdapter } from './builtin';
import { createEjsAdapter } from './ejs';
import { createEtaAdapter } from './eta';
import { createHandlebarsAdapter } from './handlebars';
import { createNunjucksAdapter } from './nunjucks';
import { createPugAdapter } from './pug';

/**
 * Registry of available template engine adapters
 */
const adapterRegistry: Map<EngineName, AdapterFactory> = new Map([
  ['builtin', createBuiltinAdapter],
  ['ejs', createEjsAdapter],
  ['handlebars', createHandlebarsAdapter],
  ['nunjucks', createNunjucksAdapter],
  ['pug', createPugAdapter],
  ['eta', createEtaAdapter],
]);

/**
 * Create a template adapter for the specified engine
 *
 * @param engine - Template engine name
 * @param config - Engine configuration
 * @returns Template adapter instance
 *
 * @example
 * ```typescript
 * // Create EJS adapter
 * const adapter = createAdapter('ejs', { root: './views' });
 *
 * // Create Handlebars adapter
 * const adapter = createAdapter('handlebars', { ext: '.hbs' });
 *
 * // Use built-in adapter (default)
 * const adapter = createAdapter('builtin');
 * ```
 */
export function createAdapter(
  engine: EngineName = 'builtin',
  config: AdapterConfig = {}
): TemplateAdapter {
  const factory = adapterRegistry.get(engine);

  if (!factory) {
    const available = Array.from(adapterRegistry.keys()).join(', ');
    throw new Error(
      `Unknown template engine: "${engine}". Available engines: ${available}`
    );
  }

  return factory(config);
}

/**
 * Register a custom template adapter
 *
 * @param name - Engine name
 * @param factory - Adapter factory function
 *
 * @example
 * ```typescript
 * // Register custom adapter
 * registerAdapter('myEngine', (config) => ({
 *   name: 'myEngine',
 *   render: (source, data) => myEngine.render(source, data),
 *   // ... implement other methods
 * }));
 *
 * // Use custom adapter
 * app.use(template('myEngine', { root: './views' }));
 * ```
 */
export function registerAdapter(name: string, factory: AdapterFactory): void {
  adapterRegistry.set(name as EngineName, factory);
}

/**
 * Check if an adapter is available for the given engine
 */
export function hasAdapter(engine: string): boolean {
  return adapterRegistry.has(engine as EngineName);
}

/**
 * Get list of available template engines
 */
export function getAvailableEngines(): string[] {
  return Array.from(adapterRegistry.keys());
}

// Re-export types
export type {
    AdapterConfig,
    AdapterFactory,
    AdapterRenderOptions,
    EngineName,
    RenderFn,
    TemplateAdapter,
    TemplateData
} from './types';

// Re-export individual adapter factories
export { createBuiltinAdapter } from './builtin';
export { createEjsAdapter } from './ejs';
export { createEtaAdapter } from './eta';
export { createHandlebarsAdapter } from './handlebars';
export { createNunjucksAdapter } from './nunjucks';
export { createPugAdapter } from './pug';
