/**
 * 🎯 Template Engine Types
 * Core interfaces and types for the NextRush template system
 */

import { Writable } from 'stream';

/**
 * Template context for variable substitution
 */
export interface TemplateContext {
  [key: string]: any;
}

/**
 * Path aliases for template resolution
 */
export interface PathAliases {
  [alias: string]: string;
}

/**
 * Helper function registry
 */
export interface HelperRegistry {
  [name: string]: (...args: any[]) => any;
}

/**
 * Filter function registry
 */
export interface FilterRegistry {
  [name: string]: (value: any, ...args: any[]) => any;
}

/**
 * Internationalization configuration
 */
export interface I18nConfig {
  locale?: string;
  fallback?: string;
  translations?: { [locale: string]: { [key: string]: string } };
  directory?: string;
  defaultLocale?: string;
  locales?: string[];
}

/**
 * Template engine configuration options
 */
export interface TemplateOptions {
  views?: string;
  layouts?: string;
  partials?: string;
  components?: string;
  cache?: boolean;
  engine?: 'mustache' | 'handlebars' | 'jsx' | 'auto';
  pathAliases?: PathAliases;
  encoding?: BufferEncoding;
  extensions?: string[];
  globals?: TemplateContext;
  helpers?: HelperRegistry;
  filters?: FilterRegistry;
  i18n?: I18nConfig;
  minify?: boolean;
  debug?: boolean;
  watchFiles?: boolean;
  streaming?: boolean;
  defaultExtension?: string;
}

/**
 * Template rendering options
 */
export interface RenderOptions {
  engine?: string;
  cache?: boolean;
  layout?: string;
  locals?: TemplateContext;
  streaming?: boolean;
  partials?: Record<string, string>;
  helpers?: Record<string, Function>;
  filters?: Record<string, Function>;
  [key: string]: any;
}

/**
 * Template AST node types
 */
export interface TemplateNode {
  type:
    | 'text'
    | 'variable'
    | 'block'
    | 'component'
    | 'partial'
    | 'layout'
    | 'helper';
  content?: string;
  key?: string;
  props?: TemplateContext;
  children?: TemplateNode[];
  escape?: boolean;
  condition?: string;
  iterator?: { array: string; item: string; index?: string };
  name?: string;
  args?: any[];
  start?: number;
  end?: number;
}

/**
 * Template parsing result
 */
export interface ParseResult {
  nodes: TemplateNode[];
  metadata: {
    dependencies: string[];
    components: string[];
    partials: string[];
    layout?: string;
    frontmatter?: any;
    title?: string;
    author?: string;
    date?: string;
    tags?: string[];
  };
}

/**
 * Compiled template result
 */
export interface CompileResult {
  render: (
    context: TemplateContext,
    options?: RenderOptions
  ) => Promise<string>;
  renderStream: (
    context: TemplateContext,
    stream: Writable,
    options?: RenderOptions
  ) => Promise<void>;
  metadata: ParseResult['metadata'];
}

/**
 * Test rendering result interface
 */
export interface TestRenderResult {
  html: string;
  errors: string[];
  metadata?: ParseResult['metadata'];
}
