/**
 * EJS Template Adapter
 *
 * Adapter for the EJS template engine.
 * Requires: npm install ejs
 *
 * @packageDocumentation
 * @module @nextrush/template/adapters/ejs
 */

import { extname, join } from 'node:path';
import type {
    AdapterConfig,
    AdapterRenderOptions,
    TemplateAdapter,
    TemplateData,
} from './types';

interface EjsConfig extends AdapterConfig {
  root?: string;
  ext?: string;
  cache?: boolean;
  layout?: string;
  delimiter?: string;
  openDelimiter?: string;
  closeDelimiter?: string;
  strict?: boolean;
  rmWhitespace?: boolean;
}

interface EjsModule {
  render: (str: string, data?: object, options?: object) => string;
  renderFile: (path: string, data?: object, options?: object) => Promise<string>;
  compile: (str: string, options?: object) => (data?: object) => string;
}

const DEFAULT_EXT = '.ejs';
const DEFAULT_ROOT = './views';

let ejsModule: EjsModule | null = null;

async function loadEjs(): Promise<EjsModule> {
  if (ejsModule) return ejsModule;

  try {
    // @ts-ignore - EJS is an optional peer dependency
    ejsModule = await import('ejs') as unknown as EjsModule;
    return ejsModule;
  } catch {
    throw new Error(
      'EJS is not installed. Please install it with: npm install ejs'
    );
  }
}

export function createEjsAdapter(config: EjsConfig = {}): TemplateAdapter {
  const root = config.root ?? DEFAULT_ROOT;
  const ext = config.ext ?? DEFAULT_EXT;
  const cacheEnabled = config.cache ?? process.env.NODE_ENV === 'production';

  const compiledCache = new Map<string, (data?: object) => string>();

  const ejsOptions = {
    cache: cacheEnabled,
    delimiter: config.delimiter,
    openDelimiter: config.openDelimiter,
    closeDelimiter: config.closeDelimiter,
    strict: config.strict,
    rmWhitespace: config.rmWhitespace,
    views: [root],
  };

  function resolvePath(filename: string): string {
    const hasExt = extname(filename).length > 0;
    const fullPath = hasExt ? filename : `${filename}${ext}`;
    return join(root, fullPath);
  }

  async function applyLayout(
    content: string,
    layoutName: string,
    data: TemplateData
  ): Promise<string> {
    const ejs = await loadEjs();
    const layoutPath = resolvePath(layoutName);
    return ejs.renderFile(layoutPath, { ...data, body: content }, ejsOptions);
  }

  const adapter: TemplateAdapter = {
    name: 'ejs',

    render(source: string, data: TemplateData = {}, _options: AdapterRenderOptions = {}): string {
      // Synchronous render - must throw if ejs not loaded
      if (!ejsModule) {
        throw new Error('EJS not loaded. Call renderAsync first or ensure EJS is loaded.');
      }
      return ejsModule.render(source, data, ejsOptions);
    },

    async renderAsync(
      source: string,
      data: TemplateData = {},
      _options: AdapterRenderOptions = {}
    ): Promise<string> {
      const ejs = await loadEjs();
      return ejs.render(source, data, { ...ejsOptions, async: true });
    },

    async renderFile(
      filename: string,
      data: TemplateData = {},
      options: AdapterRenderOptions = {}
    ): Promise<string> {
      const ejs = await loadEjs();
      const filepath = resolvePath(filename);

      // Use cache if enabled
      if (cacheEnabled) {
        const cached = compiledCache.get(filepath);
        if (cached) {
          let html = cached(data);
          const layoutName = options.layout ?? config.layout;
          if (layoutName) {
            html = await applyLayout(html, layoutName, data);
          }
          return html;
        }
      }

      let html = await ejs.renderFile(filepath, data, { ...ejsOptions, filename: filepath });

      const layoutName = options.layout ?? config.layout;
      if (layoutName) {
        html = await applyLayout(html, layoutName, data);
      }

      return html;
    },

    registerHelper(name: string, fn: (...args: unknown[]) => unknown): void {
      (ejsOptions as Record<string, unknown>)[name] = fn;
    },

    clearCache(): void {
      compiledCache.clear();
    },
  };

  return adapter;
}
