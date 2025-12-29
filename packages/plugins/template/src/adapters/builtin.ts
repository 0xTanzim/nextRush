/**
 * Built-in Template Adapter
 *
 * Adapter for the built-in Mustache-like template engine.
 * This is the default adapter used when no engine is specified.
 *
 * @packageDocumentation
 * @module @nextrush/template/adapters/builtin
 */

import { readFile } from 'node:fs/promises';
import { extname, normalize, resolve, sep } from 'node:path';
import { compile } from '../compiler';
import type { CompiledTemplate } from '../template.types';
import type {
    AdapterConfig,
    AdapterRenderOptions,
    TemplateAdapter,
    TemplateData,
} from './types';

interface BuiltinConfig extends AdapterConfig {
  root?: string;
  ext?: string;
  cache?: boolean;
  layout?: string;
  helpers?: Record<string, (...args: unknown[]) => unknown>;
}

const DEFAULT_EXT = '.html';
const DEFAULT_ROOT = './views';

/**
 * Maximum nesting depth for layouts to prevent infinite recursion.
 */
const MAX_LAYOUT_DEPTH = 10;

export function createBuiltinAdapter(config: BuiltinConfig = {}): TemplateAdapter {
  const root = resolve(config.root ?? DEFAULT_ROOT);
  const ext = config.ext ?? DEFAULT_EXT;
  const cacheEnabled = config.cache ?? process.env.NODE_ENV === 'production';

  const templateCache = new Map<string, CompiledTemplate>();
  const customHelpers: Record<string, (...args: unknown[]) => unknown> = {
    ...config.helpers,
  };

  /**
   * Resolve and validate template path to prevent path traversal attacks.
   * @throws Error if path attempts to escape the root directory
   */
  function resolvePath(filename: string): string {
    // Normalize the filename to handle any sneaky path segments
    const normalizedFilename = normalize(filename);

    // Check for obvious path traversal attempts
    if (normalizedFilename.includes('..')) {
      throw new Error(`Path traversal detected: "${filename}" contains ".." segments`);
    }

    const hasExt = extname(normalizedFilename).length > 0;
    const fullFilename = hasExt ? normalizedFilename : `${normalizedFilename}${ext}`;

    // Resolve to absolute path
    const resolvedPath = resolve(root, fullFilename);

    // Security: Ensure resolved path is within root directory
    // Must start with root + separator, or be exactly the root directory
    const normalizedRoot = root.endsWith(sep) ? root : root + sep;
    if (!resolvedPath.startsWith(normalizedRoot) && resolvedPath !== root) {
      throw new Error(
        `Path traversal detected: "${filename}" resolves outside the views directory`
      );
    }

    return resolvedPath;
  }

  async function loadTemplate(filename: string): Promise<CompiledTemplate> {
    const filepath = resolvePath(filename);
    const cacheKey = filepath;

    if (cacheEnabled) {
      const cached = templateCache.get(cacheKey);
      if (cached) return cached;
    }

    const source = await readFile(filepath, 'utf8');
    const compiled = compile(source, { helpers: customHelpers });

    if (cacheEnabled) {
      templateCache.set(cacheKey, compiled);
    }

    return compiled;
  }

  async function applyLayout(
    content: string,
    layoutName: string,
    data: TemplateData,
    depth: number = 0
  ): Promise<string> {
    // Security: Prevent infinite layout recursion
    if (depth >= MAX_LAYOUT_DEPTH) {
      throw new Error(
        `Maximum layout nesting depth (${MAX_LAYOUT_DEPTH}) exceeded. ` +
        `Check for circular layout references involving "${layoutName}".`
      );
    }

    const layoutTemplate = await loadTemplate(layoutName);
    return layoutTemplate.renderAsync({ ...data, body: content });
  }

  const adapter: TemplateAdapter = {
    name: 'builtin',

    render(source: string, data: TemplateData = {}, options: AdapterRenderOptions = {}): string {
      const compiled = compile(source, { helpers: customHelpers });
      return compiled.render({ ...data }, options);
    },

    async renderAsync(
      source: string,
      data: TemplateData = {},
      options: AdapterRenderOptions = {}
    ): Promise<string> {
      const compiled = compile(source, { helpers: customHelpers });
      return compiled.renderAsync({ ...data }, options);
    },

    async renderFile(
      filename: string,
      data: TemplateData = {},
      options: AdapterRenderOptions = {}
    ): Promise<string> {
      const template = await loadTemplate(filename);

      // Separate layout from other options to avoid double rendering
      // or treating layout name as template source
      const { layout, ...renderOptions } = options;
      let html = await template.renderAsync(data, renderOptions as any);

      const layoutName = layout ?? config.layout;
      if (layoutName) {
        html = await applyLayout(html, layoutName, data, 0);
      }

      return html;
    },

    registerHelper(name: string, fn: (...args: unknown[]) => unknown): void {
      customHelpers[name] = fn;
    },

    clearCache(): void {
      templateCache.clear();
    },
  };

  return adapter;
}
