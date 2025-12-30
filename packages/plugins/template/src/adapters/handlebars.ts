/**
 * Handlebars Template Adapter
 *
 * Adapter for the Handlebars template engine.
 * Requires: npm install handlebars
 *
 * @packageDocumentation
 * @module @nextrush/template/adapters/handlebars
 */

import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type {
    AdapterConfig,
    AdapterRenderOptions,
    TemplateAdapter,
    TemplateData,
} from './types';

interface HandlebarsConfig extends AdapterConfig {
  root?: string;
  ext?: string;
  cache?: boolean;
  layout?: string;
  strict?: boolean;
  preventIndent?: boolean;
  helpers?: Record<string, (...args: unknown[]) => unknown>;
  partials?: Record<string, string>;
}

type CompiledHandlebarsTemplate = (data: object) => string;

interface HandlebarsModule {
  compile: (source: string, options?: object) => CompiledHandlebarsTemplate;
  registerHelper: (name: string, fn: (...args: unknown[]) => unknown) => void;
  registerPartial: (name: string, partial: string) => void;
  SafeString: new (str: string) => unknown;
}

const DEFAULT_EXT = '.hbs';
const DEFAULT_ROOT = './views';

let hbsModule: HandlebarsModule | null = null;

async function loadHandlebars(): Promise<HandlebarsModule> {
  if (hbsModule) return hbsModule;

  try {
    // @ts-ignore - Handlebars is an optional peer dependency
    hbsModule = await import('handlebars') as unknown as HandlebarsModule;
    return hbsModule;
  } catch {
    throw new Error(
      'Handlebars is not installed. Please install it with: npm install handlebars'
    );
  }
}

export function createHandlebarsAdapter(config: HandlebarsConfig = {}): TemplateAdapter {
  const root = config.root ?? DEFAULT_ROOT;
  const ext = config.ext ?? DEFAULT_EXT;
  const cacheEnabled = config.cache ?? process.env.NODE_ENV === 'production';

  const templateCache = new Map<string, CompiledHandlebarsTemplate>();
  const customHelpers = { ...config.helpers };

  const compileOptions = {
    strict: config.strict,
    preventIndent: config.preventIndent,
  };

  function resolvePath(filename: string): string {
    const hasExt = extname(filename).length > 0;
    const fullPath = hasExt ? filename : `${filename}${ext}`;
    return join(root, fullPath);
  }

  async function compileTemplate(source: string): Promise<CompiledHandlebarsTemplate> {
    const hbs = await loadHandlebars();

    // Register custom helpers
    for (const [name, fn] of Object.entries(customHelpers)) {
      hbs.registerHelper(name, fn);
    }

    // Register partials
    if (config.partials) {
      for (const [name, partial] of Object.entries(config.partials)) {
        hbs.registerPartial(name, partial);
      }
    }

    return hbs.compile(source, compileOptions);
  }

  async function loadTemplate(filename: string): Promise<CompiledHandlebarsTemplate> {
    const filepath = resolvePath(filename);
    const cacheKey = filepath;

    if (cacheEnabled) {
      const cached = templateCache.get(cacheKey);
      if (cached) return cached;
    }

    const source = await readFile(filepath, 'utf8');
    const compiled = await compileTemplate(source);

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
    return layoutTemplate({ ...data, body: content });
  }

  const adapter: TemplateAdapter = {
    name: 'handlebars',

    render(source: string, data: TemplateData = {}, _options: AdapterRenderOptions = {}): string {
      if (!hbsModule) {
        throw new Error('Handlebars not loaded. Call renderAsync first or ensure Handlebars is loaded.');
      }
      const compiled = hbsModule.compile(source, compileOptions);
      return compiled(data);
    },

    async renderAsync(
      source: string,
      data: TemplateData = {},
      _options: AdapterRenderOptions = {}
    ): Promise<string> {
      const compiled = await compileTemplate(source);
      return compiled(data);
    },

    async renderFile(
      filename: string,
      data: TemplateData = {},
      options: AdapterRenderOptions = {}
    ): Promise<string> {
      const template = await loadTemplate(filename);
      let html = template(data);

      const layoutName = options.layout ?? config.layout;
      if (layoutName) {
        html = await applyLayout(html, layoutName, data);
      }

      return html;
    },

    registerHelper(name: string, fn: (...args: unknown[]) => unknown): void {
      customHelpers[name] = fn;
      // Also register immediately if Handlebars is loaded
      if (hbsModule) {
        hbsModule.registerHelper(name, fn);
      }
    },

    clearCache(): void {
      templateCache.clear();
    },
  };

  return adapter;
}
