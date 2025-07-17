/**
 * 🎨 Template Plugin - Enterprise Template Rendering
 * High-performance template engine with caching and multiple format support
 */

import {
  BaseTemplatePlugin,
  TemplateEngineOptions,
  TemplateHelper
} from '../types/specialized-plugins';
import { PluginContext, PluginMetadata } from '../core/plugin.interface';
// Removed unused Application import
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);

/**
 * Template cache entry
 */
interface TemplateCache {
  content: string;
  compiled?: (data: Record<string, unknown>) => string;
  mtime: number;
}

/**
 * Template context for rendering
 */
interface TemplateContext {
  data: Record<string, unknown>;
  helpers: Map<string, TemplateHelper>;
  partials: Map<string, string>;
}

/**
 * Enterprise Template Plugin
 * Provides template rendering with multiple engines and caching
 */
export class TemplatePlugin extends BaseTemplatePlugin {
  public readonly metadata: PluginMetadata = {
    name: 'NextRush-Template',
    version: '1.0.0',
    description: 'Enterprise template engine with caching and multiple format support',
    author: 'NextRush Framework',
    category: 'core',
    priority: 60, // Medium priority
    dependencies: []
  };

  private templateCache = new Map<string, TemplateCache>();
  private defaultEngine = 'simple';

  protected async onInstall(context: PluginContext): Promise<void> {
    const app = context.app;

    // Bind template methods to application
    (app as any).setViews = (viewsPath: string, options?: TemplateEngineOptions) => {
      this.setViews(viewsPath, options);
      return app;
    };

    (app as any).render = (template: string, data?: Record<string, unknown>) => {
      return this.render(template, data);
    };

    context.logger.info('Template plugin methods bound to application');
  }

  protected async onStart(context: PluginContext): Promise<void> {
    // Pre-compile common templates if caching is enabled
    if (this.options.cache) {
      await this.precompileTemplates();
    }
    
    context.logger.info('Template plugin started');
  }

  protected async onStop(context: PluginContext): Promise<void> {
    // Clear template cache
    this.templateCache.clear();
    
    context.logger.info('Template plugin stopped');
  }

  protected async onUninstall(context: PluginContext): Promise<void> {
    // Clean up all template data
    this.templateCache.clear();
    this.helpers.clear();
    this.partials.clear();
    this.viewsPath = undefined;
    this.options = {};
    
    context.logger.info('Template plugin uninstalled');
  }

  public override setViews(viewsPath: string, options: TemplateEngineOptions = {}): void {
    super.setViews(viewsPath, options);
    
    // Set default engine
    this.defaultEngine = options.engine || 'simple';
    
    // Clear cache when views change
    this.templateCache.clear();
  }

  public override async render(template: string, data: Record<string, unknown> = {}): Promise<string> {
    if (!this.viewsPath) {
      throw new Error('Views directory not set. Call setViews() first.');
    }

    try {
      // Resolve template path
      const templatePath = this.resolveTemplatePath(template);
      
      // Load and compile template
      const compiled = await this.loadTemplate(templatePath);
      
      // Create rendering context
      const context: TemplateContext = {
        data,
        helpers: this.helpers,
        partials: this.partials
      };

      // Render template
      if (compiled.compiled) {
        return compiled.compiled(data);
      } else {
        return this.renderTemplate(compiled.content, context);
      }
    } catch (error) {
      this.getContext().logger.error(`Template rendering error for ${template}:`, error);
      throw new Error(`Template rendering failed: ${(error as Error).message}`);
    }
  }

  /**
   * Compile template for better performance
   */
  public async compileTemplate(templatePath: string): Promise<(data: Record<string, unknown>) => string> {
    const template = await this.loadTemplate(templatePath);
    
    if (template.compiled) {
      return template.compiled;
    }

    // Create compiled function
    const compiled = this.createCompiledTemplate(template.content);
    
    // Cache compiled template
    template.compiled = compiled;
    
    return compiled;
  }

  /**
   * Clear template cache
   */
  public clearCache(): void {
    this.templateCache.clear();
    this.getContext().logger.debug('Template cache cleared');
  }

  // Private methods
  private resolveTemplatePath(template: string): string {
    if (!this.viewsPath) {
      throw new Error('Views directory not set');
    }

    // Add default extension if none provided
    let templatePath = template;
    if (!path.extname(templatePath)) {
      const ext = this.options.extension || '.html';
      templatePath += ext;
    }

    return path.join(this.viewsPath, templatePath);
  }

  private async loadTemplate(templatePath: string): Promise<TemplateCache> {
    // Check cache
    const cached = this.templateCache.get(templatePath);
    if (cached && this.options.cache) {
      // Verify file hasn't changed
      try {
        const stats = await stat(templatePath);
        if (stats.mtime.getTime() === cached.mtime) {
          return cached;
        }
      } catch (error) {
        // File doesn't exist anymore
        this.templateCache.delete(templatePath);
      }
    }

    // Load template file
    const content = await readFile(templatePath, 'utf8');
    const stats = await stat(templatePath);
    
    const template: TemplateCache = {
      content,
      mtime: stats.mtime.getTime()
    };

    // Cache template
    if (this.options.cache) {
      this.templateCache.set(templatePath, template);
    }

    return template;
  }

  private renderTemplate(content: string, context: TemplateContext): string {
    let rendered = content;

    // Simple template engine - replace {{variable}} patterns
    rendered = rendered.replace(/\{\{([^}]+)\}\}/g, (match, expression) => {
      const trimmed = expression.trim();
      
      // Handle partials {{> partialName}}
      if (trimmed.startsWith('>')) {
        const partialName = trimmed.substring(1).trim();
        const partial = context.partials.get(partialName);
        return partial || '';
      }

      // Handle helpers {{helperName arg1 arg2}}
      const parts = trimmed.split(/\s+/);
      if (parts.length > 1) {
        const helperName = parts[0];
        const helper = context.helpers.get(helperName);
        if (helper) {
          const args = parts.slice(1).map((arg: string) => this.resolveValue(arg, context.data));
          return helper(...args);
        }
      }

      // Handle simple variables {{variable}}
      return this.resolveValue(trimmed, context.data);
    });

    // Handle conditionals {{#if condition}} ... {{/if}}
    rendered = rendered.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, block) => {
      const value = this.resolveValue(condition.trim(), context.data);
      return this.isTruthy(value) ? block : '';
    });

    // Handle loops {{#each array}} ... {{/each}}
    rendered = rendered.replace(/\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, arrayName, block) => {
      const array = this.resolveValue(arrayName.trim(), context.data);
      if (!Array.isArray(array)) {
        return '';
      }

      return array.map((item, index) => {
        let itemBlock = block;
        // Replace {{this}} with current item
        itemBlock = itemBlock.replace(/\{\{this\}\}/g, String(item));
        // Replace {{@index}} with current index
        itemBlock = itemBlock.replace(/\{\{@index\}\}/g, String(index));
        return itemBlock;
      }).join('');
    });

    return rendered;
  }

  private createCompiledTemplate(content: string): (data: Record<string, unknown>) => string {
    // Pre-compile template for better performance
    return (data: Record<string, unknown>) => {
      const context: TemplateContext = {
        data,
        helpers: this.helpers,
        partials: this.partials
      };
      return this.renderTemplate(content, context);
    };
  }

  private resolveValue(expression: string, data: Record<string, unknown>): string {
    try {
      // Handle dot notation (e.g., user.name)
      const parts = expression.split('.');
      let value: any = data;
      
      for (const part of parts) {
        if (value && typeof value === 'object') {
          value = value[part];
        } else {
          value = undefined;
          break;
        }
      }

      return value !== undefined ? String(value) : '';
    } catch (error) {
      return '';
    }
  }

  private isTruthy(value: any): boolean {
    if (value === null || value === undefined || value === false) {
      return false;
    }
    if (typeof value === 'string' && value.length === 0) {
      return false;
    }
    if (Array.isArray(value) && value.length === 0) {
      return false;
    }
    return true;
  }

  private async precompileTemplates(): Promise<void> {
    if (!this.viewsPath) {
      return;
    }

    try {
      // Pre-compile common templates like index.html
      const commonTemplates = ['index.html', 'layout.html', 'error.html'];
      
      for (const template of commonTemplates) {
        try {
          const templatePath = path.join(this.viewsPath, template);
          await this.loadTemplate(templatePath);
        } catch (error) {
          // Template doesn't exist, that's ok
        }
      }
    } catch (error) {
      this.getContext().logger.warn('Error precompiling templates:', error);
    }
  }
}
