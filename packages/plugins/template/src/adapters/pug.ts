/**
 * Pug Template Adapter
 *
 * Adapter for the Pug template engine.
 * Requires: npm install pug
 *
 * @packageDocumentation
 * @module @nextrush/template/adapters/pug
 */

import { extname, join } from 'node:path';
import type {
  AdapterConfig,
  AdapterRenderOptions,
  TemplateAdapter,
  TemplateData,
} from './types';

interface PugConfig extends AdapterConfig {
  root?: string;
  ext?: string;
  cache?: boolean;
  layout?: string;
  pretty?: boolean;
  doctype?: string;
  helpers?: Record<string, (...args: unknown[]) => unknown>;
}

type CompiledPugTemplate = (locals?: object) => string;

interface PugModule {
  compile: (source: string, options?: object) => CompiledPugTemplate;
  compileFile: (path: string, options?: object) => CompiledPugTemplate;
  render: (source: string, options?: object) => string;
  renderFile: (path: string, options?: object) => string;
}

const DEFAULT_EXT = '.pug';
const DEFAULT_ROOT = './views';

let pugModule: PugModule | null = null;

async function loadPug(): Promise<PugModule> {
  if (pugModule) return pugModule;

  try {
    // @ts-expect-error - Pug is an optional peer dependency
    pugModule = await import('pug') as unknown as PugModule;
    return pugModule;
  } catch {
    throw new Error(
      'Pug is not installed. Please install it with: npm install pug'
    );
  }
}

export function createPugAdapter(config: PugConfig = {}): TemplateAdapter {
  const root = config.root ?? DEFAULT_ROOT;
  const ext = config.ext ?? DEFAULT_EXT;
  const cacheEnabled = config.cache ?? process.env.NODE_ENV === 'production';

  const templateCache = new Map<string, CompiledPugTemplate>();
  const globalLocals: Record<string, unknown> = { ...config.helpers };

  const pugOptions = {
    cache: cacheEnabled,
    pretty: config.pretty ?? false,
    doctype: config.doctype ?? 'html',
    basedir: root,
  };

  function resolvePath(filename: string): string {
    const hasExt = extname(filename).length > 0;
    const fullPath = hasExt ? filename : `${filename}${ext}`;
    return join(root, fullPath);
  }

  async function loadTemplate(filename: string): Promise<CompiledPugTemplate> {
    const filepath = resolvePath(filename);
    const cacheKey = filepath;

    if (cacheEnabled) {
      const cached = templateCache.get(cacheKey);
      if (cached) return cached;
    }

    const pug = await loadPug();
    const compiled = pug.compileFile(filepath, pugOptions);

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
    return layoutTemplate({ ...globalLocals, ...data, body: content });
  }

  const adapter: TemplateAdapter = {
    name: 'pug',

    render(source: string, data: TemplateData = {}, _options: AdapterRenderOptions = {}): string {
      if (!pugModule) {
        throw new Error('Pug not loaded. Call renderAsync first or ensure Pug is loaded.');
      }
      return pugModule.render(source, { ...pugOptions, ...globalLocals, ...data });
    },

    async renderAsync(
      source: string,
      data: TemplateData = {},
      _options: AdapterRenderOptions = {}
    ): Promise<string> {
      const pug = await loadPug();
      return pug.render(source, { ...pugOptions, ...globalLocals, ...data });
    },

    async renderFile(
      filename: string,
      data: TemplateData = {},
      options: AdapterRenderOptions = {}
    ): Promise<string> {
      const template = await loadTemplate(filename);
      let html = template({ ...globalLocals, ...data });

      const layoutName = options.layout ?? config.layout;
      if (layoutName) {
        html = await applyLayout(html, layoutName, data);
      }

      return html;
    },

    registerHelper(name: string, fn: (...args: unknown[]) => unknown): void {
      globalLocals[name] = fn;
    },

    clearCache(): void {
      templateCache.clear();
    },
  };

  return adapter;
}
