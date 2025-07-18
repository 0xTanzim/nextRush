/**
 * 🎭 Template Plugin - NextRush Ultimate Template Engine Integration
 *
 * Enhanced template system with multi-syntax support, streaming, and caching
 */

import * as fs from 'fs';
import * as path from 'path';
import { Application } from '../../core/app/application';
import { BasePlugin, PluginRegistry } from '../core/base-plugin';
import {
  UltimateTemplateParser,
  UltimateTemplateRenderer,
} from './ultimate-template-engine';

export interface TemplateOptions {
  views?: string;
  cache?: boolean;
  encoding?: BufferEncoding;
  defaultExtension?: string;
  watchFiles?: boolean;
  streaming?: boolean;
  syntax?: 'handlebars' | 'jsx' | 'mustache' | 'auto';
}

export interface RenderOptions extends TemplateOptions {
  layout?: string;
  partials?: Record<string, string>;
  helpers?: Record<string, Function>;
  filters?: Record<string, Function>;
}

/**
 * Template Engine Wrapper combining parser and renderer
 */
class TemplateEngine {
  private options: { caching?: boolean; syntax?: string; streaming?: boolean };

  constructor(
    options: { caching?: boolean; syntax?: string; streaming?: boolean } = {}
  ) {
    this.options = {
      caching: options.caching ?? false,
      syntax: options.syntax ?? 'auto',
      streaming: options.streaming ?? false,
    };
  }

  async render(
    templateContent: string,
    data: Record<string, any>,
    options?: any
  ): Promise<string> {
    const parser = new UltimateTemplateParser(templateContent, {
      engine: this.options.syntax as any,
    });
    const renderer = new UltimateTemplateRenderer(
      this.options.caching ? { cache: true } : {}
    );

    const parseResult = parser.parse();
    return renderer.render(parseResult.nodes, data);
  }

  async renderStream(
    templatePath: string,
    data: Record<string, any>,
    options?: any
  ): Promise<NodeJS.ReadableStream> {
    const template = fs.readFileSync(templatePath, 'utf8');
    const parser = new UltimateTemplateParser(template, {
      engine: this.options.syntax as any,
    });
    const renderer = new UltimateTemplateRenderer(
      this.options.caching ? { cache: true } : {}
    );

    const parseResult = parser.parse();

    // Create a readable stream for streaming
    const { Readable } = await import('stream');
    const readable = new Readable({ read() {} });

    // Render to the stream
    renderer
      .renderStream(parseResult.nodes, data, readable as any)
      .then(() => {
        readable.push(null); // End the stream
      })
      .catch((err) => {
        readable.emit('error', err);
      });

    return readable;
  }

  clearCache(): void {
    // Cache clearing would be implemented here
  }
}

/**
 * Template Plugin for NextRush Framework
 * Provides app.setViews() and res.render() functionality
 */
export class TemplatePlugin extends BasePlugin {
  name = 'Template';

  private engine: TemplateEngine;
  private viewsDirectory: string = './views';
  private options: TemplateOptions = {
    cache: process.env.NODE_ENV === 'production',
    encoding: 'utf8',
    defaultExtension: '.html',
    watchFiles: process.env.NODE_ENV !== 'production',
    streaming: false,
    syntax: 'auto',
  };

  constructor(registry: PluginRegistry, options: TemplateOptions = {}) {
    super(registry);
    this.options = { ...this.options, ...options };
    this.engine = new TemplateEngine({
      caching: this.options.cache ?? false,
      syntax: this.options.syntax ?? 'auto',
      streaming: this.options.streaming ?? false,
    });
  }

  /**
   * Install template capabilities into the application
   */
  install(app: Application): void {
    // Initialize the template engine
    this.engine = new TemplateEngine();

    // Set the application's template engine
    if (typeof app.setTemplateEngine === 'function') {
      app.setTemplateEngine(this.engine);
    }

    console.log(
      '🎨 Template plugin installed - Ultimate Template Engine ready'
    );
  }

  start(): void {
    this.emit('template:started', {
      viewsDirectory: this.viewsDirectory,
      options: this.options,
    });

    if (this.options.watchFiles) {
      this.setupFileWatcher();
    }
  }

  stop(): void {
    this.emit('template:stopped');
    this.engine.clearCache();
  }

  /**
   * Set views directory and options
   */
  private setViewsDirectory(
    directory: string,
    options?: TemplateOptions
  ): void {
    this.viewsDirectory = path.resolve(directory);

    if (options) {
      this.options = { ...this.options, ...options };
      this.engine = new TemplateEngine({
        caching: this.options.cache ?? false,
        syntax: this.options.syntax ?? 'auto',
        streaming: this.options.streaming ?? false,
      });
    }

    // Ensure directory exists
    if (!fs.existsSync(this.viewsDirectory)) {
      fs.mkdirSync(this.viewsDirectory, { recursive: true });
    }
  }

  /**
   * Enhance NextRushResponse with render method
   */
  private enhanceResponse(): void {
    // Get response prototype from the module
    const templatePlugin = this;

    // Register render method enhancer
    this.emit('response:enhance', {
      method: 'render',
      implementation: function (
        this: any,
        template: string,
        data: Record<string, any> = {},
        options?: RenderOptions
      ): Promise<void> {
        return templatePlugin.render(this, template, data, options);
      },
    });
  }

  /**
   * Render template and send response
   */
  private async render(
    res: any,
    template: string,
    data: Record<string, any> = {},
    options?: RenderOptions
  ): Promise<void> {
    try {
      const templatePath = this.resolveTemplatePath(template);

      if (!fs.existsSync(templatePath)) {
        throw new Error(`Template not found: ${templatePath}`);
      }

      const renderOptions = { ...this.options, ...options };

      if (renderOptions.streaming) {
        const stream = await this.engine.renderStream(
          templatePath,
          data,
          renderOptions
        );
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        stream.pipe(res);
      } else {
        const html = await this.engine.render(
          templatePath,
          data,
          renderOptions
        );
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(html);
      }
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Template rendering failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Resolve template path with extension
   */
  private resolveTemplatePath(template: string, viewsDir?: string): string {
    const baseDir = viewsDir || this.viewsDirectory;
    let templatePath = path.resolve(baseDir, template);

    // Add default extension if not present
    if (!path.extname(templatePath) && this.options.defaultExtension) {
      templatePath += this.options.defaultExtension;
    }

    return templatePath;
  }

  /**
   * Setup file watcher for template changes
   */
  private setupFileWatcher(): void {
    if (fs.existsSync(this.viewsDirectory)) {
      fs.watch(
        this.viewsDirectory,
        { recursive: true },
        (eventType, filename) => {
          if (filename && (eventType === 'change' || eventType === 'rename')) {
            this.engine.clearCache();
            this.emit('template:file-changed', { filename, eventType });
          }
        }
      );
    }
  }
}
