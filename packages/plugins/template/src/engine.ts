/**
 * @nextrush/template - Template Engine
 *
 * High-level template engine with file loading, caching, layouts, and partials.
 * This is the main interface for file-based template rendering.
 *
 * @packageDocumentation
 */

import { readFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { compile } from './compiler';
import { builtinHelpers } from './helpers';
import type {
  CompiledTemplate,
  CompileOptions,
  EngineOptions,
  HelperFn,
  NormalizedEngineOptions,
  RenderOptions,
  TemplateData,
  ValueHelper,
} from './template.types';

// ============================================================================
// Engine Implementation
// ============================================================================

/**
 * Template Engine class
 *
 * Provides file-based template loading, caching, and rendering.
 *
 * @example
 * ```typescript
 * const engine = createEngine({
 *   root: './views',
 *   ext: '.html',
 *   cache: true,
 * });
 *
 * const html = await engine.render('home', { title: 'Hello' });
 * ```
 */
export class TemplateEngine {
  private readonly options: NormalizedEngineOptions;
  private readonly cache: Map<string, CompiledTemplate>;

  constructor(options: EngineOptions = {}) {
    this.options = normalizeOptions(options);
    this.cache = new Map();
  }

  /**
   * Render a template file
   *
   * @param name - Template file name (without extension)
   * @param data - Template data
   * @param options - Render options
   * @returns Rendered HTML string
   */
  async render(
    name: string,
    data: TemplateData = {},
    options: RenderOptions = {}
  ): Promise<string> {
    const template = await this.getTemplate(name);

    const renderOptions = this.buildRenderOptions(options);
    let result = await template.renderAsync(data, renderOptions);

    const layoutName = options.layout !== undefined ? options.layout : this.options.layout;
    if (layoutName) {
      const layoutTemplate = await this.getTemplate(layoutName);
      const layoutData = { ...data, ...options.layoutData, body: result };
      result = await layoutTemplate.renderAsync(layoutData, renderOptions);
    }

    return result;
  }

  /**
   * Render a template string
   *
   * @param source - Template source string
   * @param data - Template data
   * @param options - Render options
   * @returns Rendered HTML string
   */
  renderString(source: string, data: TemplateData = {}, options: RenderOptions = {}): string {
    const template = compile(source, this.options.compile);
    const renderOptions = this.buildRenderOptions(options);
    return template.render(data, renderOptions);
  }

  /**
   * Render a template string asynchronously
   *
   * @param source - Template source string
   * @param data - Template data
   * @param options - Render options
   * @returns Rendered HTML string
   */
  async renderStringAsync(
    source: string,
    data: TemplateData = {},
    options: RenderOptions = {}
  ): Promise<string> {
    const template = compile(source, this.options.compile);
    const renderOptions = this.buildRenderOptions(options);
    return template.renderAsync(data, renderOptions);
  }

  /**
   * Compile a template string
   *
   * @param source - Template source string
   * @returns Compiled template
   */
  compile(source: string): CompiledTemplate {
    return compile(source, this.options.compile);
  }

  /**
   * Register a helper function
   *
   * @param name - Helper name
   * @param fn - Helper function
   */
  registerHelper(name: string, fn: HelperFn | ValueHelper): void {
    this.options.helpers.set(name, fn);
  }

  /**
   * Register multiple helpers
   *
   * @param helpers - Object of helper functions
   */
  registerHelpers(helpers: Record<string, HelperFn | ValueHelper>): void {
    for (const [name, fn] of Object.entries(helpers)) {
      this.options.helpers.set(name, fn);
    }
  }

  /**
   * Register a partial template
   *
   * @param name - Partial name
   * @param source - Partial template source
   */
  registerPartial(name: string, source: string): void {
    this.options.partials.set(name, source);
  }

  /**
   * Register multiple partials
   *
   * @param partials - Object of partial templates
   */
  registerPartials(partials: Record<string, string>): void {
    for (const [name, source] of Object.entries(partials)) {
      this.options.partials.set(name, source);
    }
  }

  /**
   * Clear the template cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get compiled template, loading from file if needed
   */
  private async getTemplate(name: string): Promise<CompiledTemplate> {
    const cacheKey = name;

    if (this.options.cache && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const source = await this.loadTemplate(name);
    const template = compile(source, this.options.compile);

    if (this.options.cache) {
      this.cache.set(cacheKey, template);
    }

    return template;
  }

  /**
   * Load template source from file
   */
  private async loadTemplate(name: string): Promise<string> {
    const ext = extname(name) || this.options.ext;
    const filename = extname(name) ? name : `${name}${ext}`;
    const filepath = resolve(this.options.root, filename);

    try {
      return await readFile(filepath, 'utf-8');
    } catch {
      throw new Error(`Template not found: ${filepath}`);
    }
  }

  /**
   * Load partials from directory
   */
  async loadPartials(): Promise<void> {
    if (!this.options.partialsDir) return;

    const partialsPath = resolve(this.options.root, this.options.partialsDir);

    try {
      const { readdir } = await import('node:fs/promises');
      const files = await readdir(partialsPath);

      for (const file of files) {
        if (file.endsWith(this.options.ext)) {
          const name = file.slice(0, -this.options.ext.length);
          const source = await readFile(join(partialsPath, file), 'utf-8');
          this.options.partials.set(name, source);
        }
      }
    } catch {
      // Directory doesn't exist or can't be read - ignore
    }
  }

  /**
   * Build render options with defaults
   */
  private buildRenderOptions(options: RenderOptions): RenderOptions {
    const helpers: Record<string, HelperFn | ValueHelper> = {};
    for (const [name, fn] of this.options.helpers) {
      helpers[name] = fn;
    }
    if (options.helpers) {
      Object.assign(helpers, options.helpers);
    }

    const partials: Record<string, string | CompiledTemplate> = {};
    for (const [name, source] of this.options.partials) {
      partials[name] = source;
    }
    if (options.partials) {
      Object.assign(partials, options.partials);
    }

    return {
      ...options,
      helpers,
      partials,
    };
  }

  /**
   * Get the root directory
   */
  get root(): string {
    return this.options.root;
  }

  /**
   * Get the default extension
   */
  get ext(): string {
    return this.options.ext;
  }
}

// ============================================================================
// Option Normalization
// ============================================================================

function normalizeOptions(options: EngineOptions): NormalizedEngineOptions {
  const root = options.root || (typeof process !== 'undefined' ? process.cwd() : '.');
  const ext = options.ext?.startsWith('.') ? options.ext : `.${options.ext || 'html'}`;
  const cache =
    options.cache ?? (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production');
  const layout = options.layout ?? null;
  const partialsDir = options.partialsDir ?? null;

  const helpers = new Map<string, HelperFn | ValueHelper>(Object.entries(builtinHelpers));
  if (options.helpers) {
    for (const [name, fn] of Object.entries(options.helpers)) {
      helpers.set(name, fn);
    }
  }

  const partials = new Map<string, string>();
  if (options.partials) {
    for (const [name, source] of Object.entries(options.partials)) {
      partials.set(name, source);
    }
  }

  const compile: Required<CompileOptions> = {
    escape: options.compile?.escape ?? true,
    strict: options.compile?.strict ?? false,
    async: options.compile?.async ?? false,
    delimiters: options.compile?.delimiters ?? ['{{', '}}'],
    helpers: options.compile?.helpers ?? {},
    partials: options.compile?.partials ?? {},
  };

  return {
    root,
    ext,
    cache,
    layout,
    partialsDir,
    helpers,
    partials,
    compile,
  };
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new template engine instance
 *
 * @param options - Engine options
 * @returns Template engine instance
 *
 * @example
 * ```typescript
 * const engine = createEngine({
 *   root: './views',
 *   ext: '.html',
 *   cache: true,
 *   layout: 'layouts/main',
 *   helpers: {
 *     formatPrice: (value) => `$${value.toFixed(2)}`,
 *   },
 * });
 * ```
 */
export function createEngine(options: EngineOptions = {}): TemplateEngine {
  return new TemplateEngine(options);
}

// ============================================================================
// Express-style View Engine
// ============================================================================

/**
 * Create an Express-compatible view engine
 *
 * @param options - Engine options
 * @returns Express view engine function
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { createViewEngine } from '@nextrush/template';
 *
 * const app = express();
 * app.engine('html', createViewEngine({ cache: true }));
 * app.set('view engine', 'html');
 * app.set('views', './views');
 * ```
 */
export function createViewEngine(
  options: EngineOptions = {}
): (
  filepath: string,
  data: TemplateData,
  callback: (err: Error | null, html?: string) => void
) => void {
  const cache = new Map<string, CompiledTemplate>();
  const opts = normalizeOptions(options);

  return async (
    filepath: string,
    data: TemplateData,
    callback: (err: Error | null, html?: string) => void
  ): Promise<void> => {
    try {
      let template: CompiledTemplate;

      if (opts.cache && cache.has(filepath)) {
        template = cache.get(filepath)!;
      } else {
        const source = await readFile(filepath, 'utf-8');
        template = compile(source, opts.compile);

        if (opts.cache) {
          cache.set(filepath, template);
        }
      }

      const helpers: Record<string, HelperFn | ValueHelper> = {};
      for (const [name, fn] of opts.helpers) {
        helpers[name] = fn;
      }

      const partials: Record<string, string> = {};
      for (const [name, source] of opts.partials) {
        partials[name] = source;
      }

      let result = await template.renderAsync(data, { helpers, partials });

      if (opts.layout) {
        const layoutPath = resolve(dirname(filepath), `${opts.layout}${opts.ext}`);
        const layoutSource = await readFile(layoutPath, 'utf-8');
        const layoutTemplate = compile(layoutSource, opts.compile);
        result = await layoutTemplate.renderAsync({ ...data, body: result }, { helpers, partials });
      }

      callback(null, result);
    } catch (err) {
      callback(err as Error);
    }
  };
}
