/**
 * @nextrush/template - Universal Template Engine for NextRush
 *
 * A flexible, adapter-based template system supporting multiple engines:
 * - Built-in Mustache-like engine (zero dependencies)
 * - EJS (Embedded JavaScript)
 * - Handlebars
 * - Nunjucks
 * - Pug
 * - Eta (modern EJS alternative)
 *
 * Features:
 * - Super simple one-liner setup
 * - Use any popular template engine
 * - Unified API across all engines
 * - Automatic caching in production
 * - Layout and partial support
 * - Custom helpers/filters
 * - Express-compatible view engine
 *
 * @packageDocumentation
 * @module @nextrush/template
 */

import type { ApplicationLike, Context, Middleware, Plugin } from '@nextrush/types';
import { createAdapter, type EngineName } from './adapters';
import type { AdapterConfig, AdapterRenderOptions } from './adapters/types';
import { compile } from './compiler';
import type { RenderOptions, TemplateData } from './template.types';

// ============================================================================
// Types
// ============================================================================

/**
 * Template middleware options
 */
export interface TemplateOptions extends AdapterConfig {
  /** Enable ctx.render() method (default: true) */
  enableContextRender?: boolean;
}

// ============================================================================
// Context Extension
// ============================================================================

declare module '@nextrush/types' {
  interface Context {
    /**
     * Render a template and send as HTML response
     *
     * @param template - Template name (relative to views directory)
     * @param data - Template data
     * @param options - Render options
     */
    render(template: string, data?: TemplateData, options?: AdapterRenderOptions): Promise<void>;
  }
}

// ============================================================================
// Template Middleware (Main Export - Super Simple DX)
// ============================================================================

/**
 * Create template middleware for NextRush
 *
 * @param engine - Template engine name ('builtin', 'ejs', 'handlebars', 'nunjucks', 'pug', 'eta')
 * @param options - Engine configuration options
 * @returns NextRush middleware
 *
 * @example Simple usage with built-in engine (default)
 * ```typescript
 * import { template } from '@nextrush/template';
 *
 * // Simplest setup - uses built-in engine
 * app.use(template());
 *
 * // With options
 * app.use(template({ root: './views' }));
 * ```
 *
 * @example Using EJS
 * ```typescript
 * // npm install ejs
 * app.use(template('ejs', { root: './views' }));
 *
 * app.get('/', async (ctx) => {
 *   await ctx.render('home', { title: 'Hello' });
 * });
 * ```
 *
 * @example Using Handlebars
 * ```typescript
 * // npm install handlebars
 * app.use(template('handlebars', {
 *   root: './views',
 *   ext: '.hbs',
 *   layout: 'layouts/main'
 * }));
 * ```
 *
 * @example Using Nunjucks
 * ```typescript
 * // npm install nunjucks
 * app.use(template('nunjucks', {
 *   root: './views',
 *   autoescape: true
 * }));
 * ```
 *
 * @example Using Pug
 * ```typescript
 * // npm install pug
 * app.use(template('pug', { root: './views', pretty: true }));
 * ```
 */
export function template(engine?: EngineName | TemplateOptions, options?: TemplateOptions): Middleware {
  // Handle overloads: template() or template(options) or template(engine, options)
  let engineName: EngineName = 'builtin';
  let config: TemplateOptions = {};

  if (typeof engine === 'string') {
    engineName = engine;
    config = options ?? {};
  } else if (typeof engine === 'object') {
    config = engine;
  }

  const adapter = createAdapter(engineName, config);
  const enableContextRender = config.enableContextRender ?? true;

  return async (ctx: Context) => {
    if (enableContextRender) {
      ctx.render = async (
        templateName: string,
        data: TemplateData = {},
        renderOptions: AdapterRenderOptions = {}
      ): Promise<void> => {
        const mergedData = { ...ctx.state, ...data };
        const html = await adapter.renderFile(templateName, mergedData, renderOptions);
        ctx.html(html);
      };
    }

    await ctx.next();
  };
}

// ============================================================================
// Template Plugin
// ============================================================================

/**
 * Create template plugin for NextRush applications
 *
 * @param engine - Template engine name
 * @param options - Engine configuration options
 * @returns NextRush plugin
 *
 * @example
 * ```typescript
 * import { createApp } from '@nextrush/core';
 * import { templatePlugin } from '@nextrush/template';
 *
 * const app = createApp();
 *
 * // Use any template engine as a plugin
 * app.use(templatePlugin('ejs', {
 *   root: './views',
 *   helpers: {
 *     formatPrice: (value) => `$${value.toFixed(2)}`,
 *   },
 * }));
 * ```
 */
export function templatePlugin(engine?: EngineName | TemplateOptions, options?: TemplateOptions): Plugin {
  let engineName: EngineName = 'builtin';
  let config: TemplateOptions = {};

  if (typeof engine === 'string') {
    engineName = engine;
    config = options ?? {};
  } else if (typeof engine === 'object') {
    config = engine;
  }

  const adapter = createAdapter(engineName, config);
  const enableContextRender = config.enableContextRender ?? true;

  return {
    name: 'template',
    version: '3.0.5',

    install(app: ApplicationLike) {
      const middleware = async (ctx: Context, next: () => Promise<void>): Promise<void> => {
        if (enableContextRender) {
          ctx.render = async (
            templateName: string,
            data: TemplateData = {},
            renderOptions: AdapterRenderOptions = {}
          ): Promise<void> => {
            const mergedData = { ...ctx.state, ...data };
            const html = await adapter.renderFile(templateName, mergedData, renderOptions);
            ctx.html(html);
          };
        }

        await next();
      };

      app.use(middleware);

      // Expose adapter on app for advanced usage
      (app as unknown as Record<string, unknown>).templateAdapter = adapter;
    },
  };
}

// ============================================================================
// Standalone Functions
// ============================================================================

/**
 * Render a template string (using built-in engine)
 *
 * @param source - Template source string
 * @param data - Template data
 * @param options - Render options
 * @returns Rendered HTML string
 *
 * @example
 * ```typescript
 * import { render } from '@nextrush/template';
 *
 * const html = render('Hello {{name}}!', { name: 'World' });
 * // => 'Hello World!'
 * ```
 */
export function render(
  source: string,
  data: TemplateData = {},
  options: RenderOptions = {}
): string {
  const compiled = compile(source);
  return compiled.render(data, options);
}

/**
 * Render a template string asynchronously (using built-in engine)
 *
 * @param source - Template source string
 * @param data - Template data
 * @param options - Render options
 * @returns Rendered HTML string
 */
export async function renderAsync(
  source: string,
  data: TemplateData = {},
  options: RenderOptions = {}
): Promise<string> {
  const compiled = compile(source);
  return compiled.renderAsync(data, options);
}

// ============================================================================
// Re-exports
// ============================================================================

// Adapters
export {
    createAdapter,
    createBuiltinAdapter,
    createEjsAdapter,
    createEtaAdapter,
    createHandlebarsAdapter,
    createNunjucksAdapter,
    createPugAdapter,
    getAvailableEngines,
    hasAdapter,
    registerAdapter
} from './adapters';

// Core
export { compile } from './compiler';
export { createEngine, createViewEngine, TemplateEngine } from './engine';
export {
    abs,
    add, and, at, builtinHelpers, capitalize, ceil, compact, conditional, createHelperRegistry, currency, day, defaultValue, divide, entries,
    // Comparison helpers
    eq,
    // Array helpers
    first, flatten, floor,
    // Date helpers
    formatDate,
    // Number helpers
    formatNumber, get, gt,
    gte, includes,
    indexOf,
    // Type helpers
    isArray, isEmpty, isNumber, isObject,
    isString, join,
    // Output helpers
    json,
    // Object helpers
    keys, last, length, lower, lt,
    lte, mod, month, multiply, ne, not, now, or, padEnd, padStart, percent, replace, reverse, round, safe, slice,
    sort, split, stripHtml, subtract, timeAgo, titleCase,
    trim,
    truncate, unique,
    // String helpers
    upper, values, year
} from './helpers';
export { parse, TemplateParseError, validate } from './parser';

// ============================================================================
// Type Exports
// ============================================================================

export type {
    // Adapter types
    AdapterConfig,
    AdapterFactory,
    AdapterRenderOptions,
    EngineName,
    TemplateAdapter
} from './adapters';

export type {
    AST,
    ASTNode,
    BlockNode,
    CommentNode,
    CompiledTemplate,
    CompileOptions,
    EngineOptions,
    ExpressionArg,
    HelperCall,
    HelperContext,
    HelperFn,
    NormalizedEngineOptions,
    NormalizedPluginOptions,
    PartialNode,
    RawNode, RenderFileFunction, RenderFunction, RenderOptions,
    TemplateData,
    TemplateError,
    TemplateErrorCode,
    TemplatePluginOptions,
    TextNode,
    ValueHelper,
    VariableNode
} from './template.types';
