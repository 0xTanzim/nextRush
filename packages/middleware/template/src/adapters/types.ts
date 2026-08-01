/**
 * Template Adapter Types
 *
 * Defines the contract for template engine adapters.
 * All adapters must implement the TemplateAdapter interface.
 *
 * @packageDocumentation
 * @module @nextrush/template/adapters
 */

/**
 * Template data object - any key-value pairs
 */
export type TemplateData = Record<string, unknown>;

/**
 * Options passed to the adapter during rendering
 */
export interface AdapterRenderOptions {
  /** Template file path (for file-based rendering) */
  filename?: string;
  /** Layout template name */
  layout?: string;
  /** Additional adapter-specific options */
  [key: string]: unknown;
}

/**
 * Configuration options for template adapters
 */
export interface AdapterConfig {
  /** Root directory for templates */
  root?: string;
  /** Default file extension */
  ext?: string;
  /** Enable template caching */
  cache?: boolean;
  /** Default layout template */
  layout?: string;
  /** Custom helpers/filters */
  helpers?: Record<string, (...args: unknown[]) => unknown>;
  /** Additional adapter-specific options */
  [key: string]: unknown;
}

/**
 * Render function signature
 */
export type RenderFn = (
  template: string,
  data?: TemplateData,
  options?: AdapterRenderOptions
) => string | Promise<string>;

/**
 * Template Adapter Interface
 *
 * All template engine adapters must implement this interface.
 * This enables a unified API across different template engines.
 */
export interface TemplateAdapter {
  /** Adapter name (e.g., 'ejs', 'handlebars', 'nunjucks') */
  readonly name: string;

  /**
   * Render a template string
   *
   * @param source - Template source string
   * @param data - Template data
   * @param options - Render options
   * @returns Rendered HTML string
   */
  render(source: string, data?: TemplateData, options?: AdapterRenderOptions): string;

  /**
   * Render a template string asynchronously
   *
   * @param source - Template source string
   * @param data - Template data
   * @param options - Render options
   * @returns Promise resolving to rendered HTML string
   */
  renderAsync(
    source: string,
    data?: TemplateData,
    options?: AdapterRenderOptions
  ): Promise<string>;

  /**
   * Render a template file
   *
   * @param filename - Template file path (relative to root)
   * @param data - Template data
   * @param options - Render options
   * @returns Promise resolving to rendered HTML string
   */
  renderFile(
    filename: string,
    data?: TemplateData,
    options?: AdapterRenderOptions
  ): Promise<string>;

  /**
   * Register a helper function
   *
   * @param name - Helper name
   * @param fn - Helper function
   */
  registerHelper(name: string, fn: (...args: unknown[]) => unknown): void;

  /**
   * Clear the template cache
   */
  clearCache(): void;
}

/**
 * Adapter factory function signature
 */
export type AdapterFactory = (config?: AdapterConfig) => TemplateAdapter;

/**
 * Supported template engine names
 */
export type EngineName = 'builtin' | 'ejs' | 'handlebars' | 'nunjucks' | 'pug' | 'eta';

/**
 * Engine configuration map
 */
export interface EngineConfigMap {
  builtin: AdapterConfig;
  ejs: AdapterConfig & { delimiter?: string; openDelimiter?: string; closeDelimiter?: string };
  handlebars: AdapterConfig & { strict?: boolean; preventIndent?: boolean };
  nunjucks: AdapterConfig & { autoescape?: boolean; throwOnUndefined?: boolean; watch?: boolean };
  pug: AdapterConfig & { pretty?: boolean; doctype?: string };
  eta: AdapterConfig & { autoEscape?: boolean; autoTrim?: boolean | [boolean, boolean] };
}
