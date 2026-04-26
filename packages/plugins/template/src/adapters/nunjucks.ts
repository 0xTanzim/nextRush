/**
 * Nunjucks Template Adapter
 *
 * Adapter for the Nunjucks template engine.
 * Requires: npm install nunjucks
 *
 * @packageDocumentation
 * @module @nextrush/template/adapters/nunjucks
 */

import { extname } from 'node:path';
import type { AdapterConfig, AdapterRenderOptions, TemplateAdapter, TemplateData } from './types';

interface NunjucksConfig extends AdapterConfig {
  root?: string;
  ext?: string;
  cache?: boolean;
  layout?: string;
  autoescape?: boolean;
  throwOnUndefined?: boolean;
  watch?: boolean;
  helpers?: Record<string, (...args: unknown[]) => unknown>;
}

interface NunjucksEnvironment {
  render: (name: string, context?: object) => string;
  renderString: (str: string, context?: object) => string;
  addFilter: (name: string, fn: (...args: unknown[]) => unknown) => void;
  addGlobal: (name: string, value: unknown) => void;
}

interface NunjucksModule {
  configure: (path: string | string[], opts?: object) => NunjucksEnvironment;
  render: (name: string, context?: object) => string;
  renderString: (str: string, context?: object) => string;
}

const DEFAULT_EXT = '.njk';
const DEFAULT_ROOT = './views';

let nunjucksModule: NunjucksModule | null = null;

async function loadNunjucks(): Promise<NunjucksModule> {
  if (nunjucksModule) return nunjucksModule;

  try {
    // @ts-ignore - Nunjucks is an optional peer dependency
    nunjucksModule = (await import('nunjucks')) as unknown as NunjucksModule;
    return nunjucksModule;
  } catch {
    throw new Error('Nunjucks is not installed. Please install it with: npm install nunjucks');
  }
}

export function createNunjucksAdapter(config: NunjucksConfig = {}): TemplateAdapter {
  const root = config.root ?? DEFAULT_ROOT;
  const ext = config.ext ?? DEFAULT_EXT;
  const cacheEnabled =
    config.cache ?? (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production');

  let env: NunjucksEnvironment | null = null;
  const customFilters: Record<string, (...args: unknown[]) => unknown> = {
    ...config.helpers,
  };

  async function getEnvironment(): Promise<NunjucksEnvironment> {
    if (env) return env;

    const nunjucks = await loadNunjucks();
    env = nunjucks.configure(root, {
      autoescape: config.autoescape ?? true,
      throwOnUndefined: config.throwOnUndefined ?? false,
      watch: config.watch ?? !cacheEnabled,
      noCache: !cacheEnabled,
    });

    // Register custom filters
    for (const [name, fn] of Object.entries(customFilters)) {
      env.addFilter(name, fn);
    }

    return env;
  }

  function resolvePath(filename: string): string {
    const hasExt = extname(filename).length > 0;
    return hasExt ? filename : `${filename}${ext}`;
  }

  async function applyLayout(
    content: string,
    layoutName: string,
    data: TemplateData
  ): Promise<string> {
    const environment = await getEnvironment();
    const layoutPath = resolvePath(layoutName);
    return environment.render(layoutPath, { ...data, body: content });
  }

  const adapter: TemplateAdapter = {
    name: 'nunjucks',

    render(source: string, data: TemplateData = {}, _options: AdapterRenderOptions = {}): string {
      if (!env) {
        throw new Error('Nunjucks not configured. Call renderAsync first to initialize.');
      }
      return env.renderString(source, data);
    },

    async renderAsync(
      source: string,
      data: TemplateData = {},
      _options: AdapterRenderOptions = {}
    ): Promise<string> {
      const environment = await getEnvironment();
      return environment.renderString(source, data);
    },

    async renderFile(
      filename: string,
      data: TemplateData = {},
      options: AdapterRenderOptions = {}
    ): Promise<string> {
      const environment = await getEnvironment();
      const templatePath = resolvePath(filename);

      let html = environment.render(templatePath, data);

      const layoutName = options.layout ?? config.layout;
      if (layoutName) {
        html = await applyLayout(html, layoutName, data);
      }

      return html;
    },

    registerHelper(name: string, fn: (...args: unknown[]) => unknown): void {
      customFilters[name] = fn;
      if (env) {
        env.addFilter(name, fn);
      }
    },

    clearCache(): void {
      // Nunjucks manages its own cache, recreate environment
      env = null;
    },
  };

  return adapter;
}
