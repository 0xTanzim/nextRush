/**
 * 🎯 Simple Template Engine - Super Easy DX
 * One-line setup, zero configuration needed!
 * Hide all complexity behind clean API
 */

import { TemplateHelperManager } from './helpers';
import { UltimateTemplateParser } from './parser';
import { UltimateTemplateRenderer } from './renderer';
import { validateTemplateSyntax } from './testing';
import type { HelperRegistry } from './types';

/**
 * Simple template configuration options
 */
export interface SimpleTemplateOptions {
  /** Enable caching for better performance (default: true) */
  cache?: boolean;
  /** Custom helpers for templates */
  helpers?: HelperRegistry;
  /** Enable debug mode in development */
  debug?: boolean;
}

/**
 * 🚀 Create a simple template engine with one line!
 *
 * @example
 * ```typescript
 * // Super simple setup
 * const template = createTemplate();
 * app.setTemplateEngine(template);
 *
 * // With custom helpers
 * const template = createTemplate({
 *   helpers: {
 *     currency: (amount) => `$${amount.toFixed(2)}`
 *   }
 * });
 * ```
 */
export function createTemplate(options: SimpleTemplateOptions = {}) {
  const {
    cache = true,
    helpers = {},
    debug = process.env.NODE_ENV !== 'production',
  } = options;

  // Pre-configure helper manager with common helpers
  const helperManager = new TemplateHelperManager();

  // Built-in helpers are already loaded by the constructor!
  // Just add our custom simple helpers on top
  helperManager.registerHelper(
    'currency',
    (amount: number) => `$${amount.toFixed(2)}`
  );

  helperManager.registerHelper('pluralize', (count: number, word: string) =>
    count === 1 ? word : `${word}s`
  );

  helperManager.registerHelper('uppercase', (str: string) => str.toUpperCase());
  helperManager.registerHelper('lowercase', (str: string) => str.toLowerCase());

  // Add custom helpers
  Object.entries(helpers).forEach(([name, helper]) => {
    helperManager.registerHelper(name, helper);
  });

  // Get all helpers (built-in + custom)
  const allHelpers = helperManager.getAllHelpers();

  // Create pre-configured renderer
  const renderer = new UltimateTemplateRenderer({
    cache,
    debug,
    helpers: allHelpers,
  });

  return {
    /**
     * Render template with data - super simple!
     */
    async render(
      templateContent: string,
      data: Record<string, any> = {}
    ): Promise<string> {
      try {
        const parser = new UltimateTemplateParser(templateContent, { cache });
        const parseResult = parser.parse();
        return renderer.render(parseResult.nodes, data);
      } catch (error) {
        if (debug) {
          console.error('🔥 Template Error:', error);
        }
        throw error;
      }
    },

    /**
     * Validate template syntax (optional, but helpful for debugging)
     */
    validate(templateContent: string) {
      return validateTemplateSyntax(templateContent);
    },
  };
}

/**
 * 🎯 Quick setup for NextRush apps - ONE LINE!
 *
 * @example
 * ```typescript
 * import { quickTemplate } from 'next-rush';
 *
 * const app = createApp();
 * app.setTemplateEngine(quickTemplate());
 * ```
 */
export function quickTemplate(helpers: HelperRegistry = {}) {
  return createTemplate({ helpers });
}

/**
 * 🛠️ Advanced template setup (but still simple!)
 *
 * @example
 * ```typescript
 * import { advancedTemplate } from 'next-rush';
 *
 * const template = advancedTemplate({
 *   cache: true,
 *   debug: true,
 *   helpers: {
 *     myHelper: (value) => `Custom: ${value}`
 *   }
 * });
 * ```
 */
export function advancedTemplate(options: SimpleTemplateOptions) {
  return createTemplate(options);
}

/**
 * 🎨 Template with common web helpers pre-loaded
 */
export function webTemplate() {
  return createTemplate({
    helpers: {
      json: (obj: any) => JSON.stringify(obj, null, 2),
      stripHTML: (str: string) => str.replace(/<[^>]*>/g, ''),
      urlEncode: (str: string) => encodeURIComponent(str),
      repeat: (str: string, times: number) => str.repeat(times),
    },
  });
}
