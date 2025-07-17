/**
 * 🚀 Template Component - SOLID Architecture Implementation
 * Handles view rendering with multiple template engines
 *
 * SOLID Principles Applied:
 * - Single Responsibility: Only handles template rendering
 * - Open/Closed: Extensible for new template engines
 * - Liskov Substitution: All engines implement same interface
 * - Interface Segregation: Clean template engine interface
 * - Dependency Inversion: Depends on template engine abstraction
 */

import * as fs from 'fs';
import { ServerResponse } from 'http';
import * as path from 'path';
import { BaseComponent } from '../../core/app/base-component';
import { MinimalApplication } from '../../core/interfaces';
import {
  ComponentErrorFactory,
  ITemplateEngine,
  TemplateData,
  TemplateRenderOptions,
} from '../../types';

/**
 * Simple template engine for basic variable substitution
 */
export class SimpleTemplateEngine implements ITemplateEngine {
  render(
    template: string,
    data: TemplateData = {},
    options?: TemplateRenderOptions
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = data[key];
      return typeof value === 'string' || typeof value === 'number'
        ? String(value)
        : '';
    });
  }

  async renderFile(
    filePath: string,
    data: TemplateData = {},
    options?: TemplateRenderOptions
  ): Promise<string> {
    try {
      const template = await fs.promises.readFile(filePath, 'utf8');
      return this.render(template, data, options);
    } catch (error) {
      throw ComponentErrorFactory.createTemplateError(
        `Failed to read template file: ${filePath}`,
        'TEMPLATE_FILE_READ_ERROR',
        { template: filePath, statusCode: 500 }
      );
    }
  }

  configure(): void {
    // Simple engine has no configuration
  }
}

/**
 * Advanced template engine with conditionals and loops
 */
export class AdvancedTemplateEngine implements ITemplateEngine {
  render(
    template: string,
    data: TemplateData = {},
    options?: TemplateRenderOptions
  ): string {
    let result = template;

    try {
      // Handle conditionals: {{#if variable}}content{{/if}}
      result = result.replace(
        /\{\{#if\s+(\w+)\}\}(.*?)\{\{\/if\}\}/gs,
        (match, condition, content) => {
          const value = data[condition];
          return this.isTruthy(value) ? content : '';
        }
      );

      // Handle loops: {{#each items}}{{name}}{{/each}}
      result = result.replace(
        /\{\{#each\s+(\w+)\}\}(.*?)\{\{\/each\}\}/gs,
        (match, arrayKey, itemTemplate) => {
          const array = data[arrayKey];
          if (!Array.isArray(array)) return '';

          return array
            .map((item) => {
              if (typeof item === 'object' && item !== null) {
                return this.render(itemTemplate, item as TemplateData, options);
              }
              return String(item);
            })
            .join('');
        }
      );

      // Handle simple variables: {{variable}}
      result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        const value = data[key];
        return typeof value === 'string' || typeof value === 'number'
          ? String(value)
          : '';
      });

      return result;
    } catch (error) {
      throw ComponentErrorFactory.createTemplateError(
        `Template rendering failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        'TEMPLATE_RENDER_ERROR',
        { statusCode: 500 }
      );
    }
  }

  async renderFile(
    filePath: string,
    data: TemplateData = {},
    options?: TemplateRenderOptions
  ): Promise<string> {
    try {
      const template = await fs.promises.readFile(filePath, 'utf8');
      return this.render(template, data, options);
    } catch (error) {
      throw ComponentErrorFactory.createTemplateError(
        `Failed to read template file: ${filePath}`,
        'TEMPLATE_FILE_READ_ERROR',
        { template: filePath, statusCode: 500 }
      );
    }
  }

  configure(): void {
    // Advanced engine has no configuration
  }

  /**
   * Check if value is truthy for template conditions
   */
  private isTruthy(value: unknown): boolean {
    return Boolean(value) && value !== 0 && value !== '';
  }
}

/**
 * Mustache-compatible template engine
 */
export class MustacheTemplateEngine implements ITemplateEngine {
  render(
    template: string,
    data: TemplateData = {},
    options?: TemplateRenderOptions
  ): string {
    let result = template;

    try {
      // Handle sections: {{#section}}content{{/section}}
      result = result.replace(
        /\{\{#(\w+)\}\}(.*?)\{\{\/\1\}\}/gs,
        (match, section, content) => {
          const value = data[section];
          if (Array.isArray(value)) {
            return value
              .map((item) =>
                typeof item === 'object' && item !== null
                  ? this.render(content, item as TemplateData, options)
                  : content
              )
              .join('');
          } else if (this.isTruthy(value)) {
            return typeof value === 'object' && value !== null
              ? this.render(content, value as TemplateData, options)
              : content;
          }
          return '';
        }
      );

      // Handle inverted sections: {{^section}}content{{/section}}
      result = result.replace(
        /\{\{\^(\w+)\}\}(.*?)\{\{\/\1\}\}/gs,
        (match, section, content) => {
          const value = data[section];
          if (!value || (Array.isArray(value) && value.length === 0)) {
            return content;
          }
          return '';
        }
      );

      // Handle variables: {{variable}} or {{{variable}}} (unescaped)
      result = result.replace(/\{\{\{(\w+)\}\}\}/g, (match, key) => {
        const value = data[key];
        return typeof value === 'string' || typeof value === 'number'
          ? String(value)
          : '';
      });

      result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        const value = data[key];
        const strValue =
          typeof value === 'string' || typeof value === 'number'
            ? String(value)
            : '';
        return this.escapeHtml(strValue);
      });

      return result;
    } catch (error) {
      throw ComponentErrorFactory.createTemplateError(
        `Mustache template rendering failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        'MUSTACHE_RENDER_ERROR',
        { statusCode: 500 }
      );
    }
  }

  async renderFile(
    filePath: string,
    data: TemplateData = {},
    options?: TemplateRenderOptions
  ): Promise<string> {
    try {
      const template = await fs.promises.readFile(filePath, 'utf8');
      return this.render(template, data, options);
    } catch (error) {
      throw ComponentErrorFactory.createTemplateError(
        `Failed to read template file: ${filePath}`,
        'TEMPLATE_FILE_READ_ERROR',
        { template: filePath, statusCode: 500 }
      );
    }
  }

  configure(): void {
    // Mustache engine has no configuration
  }

  private isTruthy(value: unknown): boolean {
    return Boolean(value) && value !== 0 && value !== '';
  }

  private escapeHtml(unsafe: string): string {
    return String(unsafe)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

/**
 * Template Component - SOLID Implementation
 */
export class TemplateComponent extends BaseComponent {
  override readonly name = 'Template';
  private engines = new Map<string, ITemplateEngine>();
  private viewsPath = 'views';
  private defaultEngine = 'simple';

  constructor() {
    super('Template');
    this.initializeEngines();
  }

  /**
   * Install template methods on application (Type-safe approach)
   */
  install(app: MinimalApplication): void {
    this.setApp(app);

    // Install view configuration methods
    this.installViewConfiguration(app);
    this.installEngineRegistration(app);
    this.enhanceResponse();

    this.log('info', 'Template component installed with type safety');
  }

  /**
   * Install view configuration in a type-safe way
   */
  private installViewConfiguration(app: MinimalApplication): void {
    (app as MinimalApplication & { set: Function }).set = (
      setting: string,
      value: string
    ) => {
      if (setting === 'views') {
        this.viewsPath = value;
      } else if (setting === 'view engine') {
        this.defaultEngine = value;
      }
      return app;
    };
  }

  /**
   * Install engine registration in a type-safe way
   */
  private installEngineRegistration(app: MinimalApplication): void {
    (app as MinimalApplication & { engine: Function }).engine = (
      ext: string,
      engine: ITemplateEngine
    ) => {
      this.engines.set(ext, engine);
      return app;
    };
  }

  /**
   * Initialize default template engines
   */
  private initializeEngines(): void {
    this.engines.set('simple', new SimpleTemplateEngine());
    this.engines.set('advanced', new AdvancedTemplateEngine());
    this.engines.set('mustache', new MustacheTemplateEngine());
  }

  /**
   * Enhance response object with render method (Type-safe enhancement)
   */
  private enhanceResponse(): void {
    const component = this;

    // Type-safe response enhancement
    if (
      !(
        ServerResponse.prototype as ServerResponse & {
          __templateEnhanced?: boolean;
        }
      ).__templateEnhanced
    ) {
      (
        ServerResponse.prototype as ServerResponse & { render?: Function }
      ).render = function (
        view: string,
        data: TemplateData = {},
        callback?: (error: Error | null, html?: string) => void
      ) {
        component.renderView(view, data, this, callback);
      };
      (
        ServerResponse.prototype as ServerResponse & {
          __templateEnhanced?: boolean;
        }
      ).__templateEnhanced = true;
    }
  }

  /**
   * Render view with proper error handling
   */
  async renderView(
    view: string,
    data: TemplateData,
    res: ServerResponse,
    callback?: (error: Error | null, html?: string) => void
  ): Promise<void> {
    try {
      // Determine file path and engine
      const { filePath, engine } = this.resolveView(view);

      // Render template
      const html = await engine.renderFile(filePath, data);

      // Send response
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'text/html');
        res.end(html);
      }

      if (callback) callback(null, html);
    } catch (error) {
      const templateError =
        error instanceof Error ? error : new Error(String(error));
      this.log(
        'error',
        `Template render error: ${templateError.message}`,
        templateError
      );

      if (callback) {
        callback(templateError);
      } else if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Template Error');
      }
    }
  }

  /**
   * Resolve view path and engine
   */
  private resolveView(view: string): {
    filePath: string;
    engine: ITemplateEngine;
  } {
    let filePath: string;
    let engineName: string;

    // Check if view has extension
    const ext = path.extname(view);
    if (ext) {
      filePath = path.join(this.viewsPath, view);
      engineName = ext.slice(1); // Remove dot
    } else {
      filePath = path.join(this.viewsPath, `${view}.${this.defaultEngine}`);
      engineName = this.defaultEngine;
    }

    // Get engine
    const engine = this.engines.get(engineName);
    if (!engine) {
      throw ComponentErrorFactory.createTemplateError(
        `Template engine '${engineName}' not found`,
        'TEMPLATE_ENGINE_NOT_FOUND',
        { engine: engineName, statusCode: 500 }
      );
    }

    return { filePath, engine };
  }

  /**
   * Register custom template engine
   */
  registerEngine(name: string, engine: ITemplateEngine): void {
    this.engines.set(name, engine);
    this.log('info', `Template engine '${name}' registered`);
  }

  /**
   * Start component
   */
  override async start(): Promise<void> {
    await super.start();
    this.log(
      'info',
      `Template component ready with ${this.engines.size} engines`
    );
  }

  /**
   * Stop component
   */
  override async stop(): Promise<void> {
    this.engines.clear();
    await super.stop();
    this.log('info', 'Template component stopped and engines cleared');
  }
}
