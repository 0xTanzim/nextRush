/**
 * Eta Template Adapter
 *
 * Adapter for the Eta template engine - a fast, lightweight alternative to EJS.
 * Requires: npm install eta
 *
 * @packageDocumentation
 * @module @nextrush/template/adapters/eta
 */

import { extname } from 'node:path';
import type {
  AdapterConfig,
  AdapterRenderOptions,
  TemplateAdapter,
  TemplateData,
} from './types';

interface EtaConfig extends AdapterConfig {
  root?: string;
  ext?: string;
  cache?: boolean;
  layout?: string;
  autoEscape?: boolean;
  autoTrim?: boolean | [boolean, boolean];
  helpers?: Record<string, (...args: unknown[]) => unknown>;
}

interface EtaInstance {
  render: (template: string, data?: object) => string;
  renderAsync: (template: string, data?: object) => Promise<string>;
  renderFile: (path: string, data?: object) => string;
  renderFileAsync: (path: string, data?: object) => Promise<string>;
  loadTemplate: (name: string, template: string) => void;
}

interface EtaModule {
  Eta: new (options?: object) => EtaInstance;
}

const DEFAULT_EXT = '.eta';
const DEFAULT_ROOT = './views';

let etaModule: EtaModule | null = null;

async function loadEta(): Promise<EtaModule> {
  if (etaModule) return etaModule;

  try {
    // @ts-expect-error - Eta is an optional peer dependency
    etaModule = await import('eta') as unknown as EtaModule;
    return etaModule;
  } catch {
    throw new Error(
      'Eta is not installed. Please install it with: npm install eta'
    );
  }
}

export function createEtaAdapter(config: EtaConfig = {}): TemplateAdapter {
  const root = config.root ?? DEFAULT_ROOT;
  const ext = config.ext ?? DEFAULT_EXT;
  const cacheEnabled = config.cache ?? process.env.NODE_ENV === 'production';

  let eta: EtaInstance | null = null;
  const customHelpers: Record<string, (...args: unknown[]) => unknown> = {
    ...config.helpers,
  };

  async function getEta(): Promise<EtaInstance> {
    if (eta) return eta;

    const module = await loadEta();
    eta = new module.Eta({
      views: root,
      cache: cacheEnabled,
      autoEscape: config.autoEscape ?? true,
      autoTrim: config.autoTrim ?? false,
      defaultExtension: ext.replace('.', ''),
    });

    return eta;
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
    const etaInstance = await getEta();
    const layoutPath = resolvePath(layoutName);
    return etaInstance.renderFileAsync(layoutPath, { ...data, ...customHelpers, body: content });
  }

  const adapter: TemplateAdapter = {
    name: 'eta',

    render(source: string, data: TemplateData = {}, _options: AdapterRenderOptions = {}): string {
      if (!eta) {
        throw new Error('Eta not configured. Call renderAsync first to initialize.');
      }
      return eta.render(source, { ...data, ...customHelpers });
    },

    async renderAsync(
      source: string,
      data: TemplateData = {},
      _options: AdapterRenderOptions = {}
    ): Promise<string> {
      const etaInstance = await getEta();
      return etaInstance.renderAsync(source, { ...data, ...customHelpers });
    },

    async renderFile(
      filename: string,
      data: TemplateData = {},
      options: AdapterRenderOptions = {}
    ): Promise<string> {
      const etaInstance = await getEta();
      const templatePath = resolvePath(filename);

      let html = await etaInstance.renderFileAsync(templatePath, { ...data, ...customHelpers });

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
      // Recreate Eta instance to clear cache
      eta = null;
    },
  };

  return adapter;
}
