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
import { extname, join } from 'node:path';
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

export function createBuiltinAdapter(config: BuiltinConfig = {}): TemplateAdapter {
  const root = config.root ?? DEFAULT_ROOT;
  const ext = config.ext ?? DEFAULT_EXT;
  const cacheEnabled = config.cache ?? process.env.NODE_ENV === 'production';

  const templateCache = new Map<string, CompiledTemplate>();
  const customHelpers: Record<string, (...args: unknown[]) => unknown> = {
    ...config.helpers,
  };

  function resolvePath(filename: string): string {
    const hasExt = extname(filename).length > 0;
    const fullPath = hasExt ? filename : `${filename}${ext}`;
    return join(root, fullPath);
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
    data: TemplateData
  ): Promise<string> {
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
      let html = await template.renderAsync(data, options);

      const layoutName = options.layout ?? config.layout;
      if (layoutName) {
        html = await applyLayout(html, layoutName, data);
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
