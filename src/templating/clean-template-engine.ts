/**
 * 🚀 NextRush Simple but Powerful Template Engine
 * Professional template rendering with path aliases and multiple engines
 * Zero dependencies, maximum simplicity, ultimate power
 */

import { promises as fs } from 'fs';
import * as path from 'path';

// 🎯 Path Alias Support
export interface PathAliases {
  [alias: string]: string;
}

export interface TemplateOptions {
  views?: string;
  cache?: boolean;
  engine?: string;
  pathAliases?: PathAliases;
  encoding?: BufferEncoding;
  extensions?: string[];
}

export interface TemplateEngine {
  render(template: string, data: any, options?: any): string | Promise<string>;
}

export interface RenderOptions {
  engine?: string;
  cache?: boolean;
  layout?: string;
  [key: string]: any;
}

/**
 * 🎨 Simple Template Engines that actually work
 */
export class SimpleTemplateEngines {
  /**
   * Mustache-like template engine
   */
  static mustache = {
    render(template: string, data: any): string {
      let result = template;

      // Variables: {{variable}}
      result = result.replace(/\{\{\s*([^}\s]+)\s*\}\}/g, (_, key) => {
        const value = this.getNestedValue(data, key);
        return value !== undefined ? String(value) : '';
      });

      // Conditionals: {{#if condition}}...{{/if}}
      result = result.replace(
        /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
        (_, condition, content) => {
          const value = this.getNestedValue(data, condition.trim());
          return this.isTruthy(value) ? content : '';
        }
      );

      // Loops: {{#each array}}...{{/each}}
      result = result.replace(
        /\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
        (_, arrayKey, content) => {
          const array = this.getNestedValue(data, arrayKey.trim());
          if (!Array.isArray(array)) return '';

          return array
            .map((item, index) => {
              let itemContent = content;

              // Replace {{this}} with current item
              itemContent = itemContent.replace(
                /\{\{\s*this\s*\}\}/g,
                String(item)
              );

              // Replace {{@index}} with current index
              itemContent = itemContent.replace(
                /\{\{\s*@index\s*\}\}/g,
                String(index)
              );

              // Replace item properties
              if (typeof item === 'object' && item !== null) {
                Object.entries(item).forEach(([key, value]) => {
                  const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
                  itemContent = itemContent.replace(regex, String(value));
                });
              }

              return itemContent;
            })
            .join('');
        }
      );

      return result;
    },

    getNestedValue(obj: any, path: string): any {
      return path.split('.').reduce((current, key) => current?.[key], obj);
    },

    isTruthy(value: any): boolean {
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'object' && value !== null)
        return Object.keys(value).length > 0;
      return Boolean(value);
    },
  };

  /**
   * HTML template engine with EJS-like syntax
   */
  static html = {
    render(template: string, data: any): string {
      let result = template;

      // Escaped output: <%= variable %>
      result = result.replace(/<%=\s*([^%]+)\s*%>/g, (_, expression) => {
        try {
          const value = this.evaluateExpression(expression.trim(), data);
          return value !== undefined ? this.escapeHtml(String(value)) : '';
        } catch {
          return '';
        }
      });

      // Raw output: <%- variable %>
      result = result.replace(/<%\-\s*([^%]+)\s*%>/g, (_, expression) => {
        try {
          const value = this.evaluateExpression(expression.trim(), data);
          return value !== undefined ? String(value) : '';
        } catch {
          return '';
        }
      });

      return result;
    },

    evaluateExpression(expr: string, data: any): any {
      const keys = expr.split('.');
      let value: any = data;

      for (const key of keys) {
        if (key === 'this') continue;
        value = value?.[key];
        if (value === undefined) break;
      }

      return value;
    },

    escapeHtml(value: string): string {
      return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },
  };

  /**
   * JSON template engine
   */
  static json = {
    render(template: string, data: any): string {
      try {
        const templateObj = JSON.parse(template);
        const result = this.processTemplate(templateObj, data);
        return JSON.stringify(result, null, 2);
      } catch {
        return JSON.stringify(data, null, 2);
      }
    },

    processTemplate(template: any, data: any): any {
      if (typeof template === 'string') {
        return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, key) => {
          const value = this.getNestedValue(data, key.trim());
          return value !== undefined ? String(value) : match;
        });
      }

      if (Array.isArray(template)) {
        return template.map((item) => this.processTemplate(item, data));
      }

      if (typeof template === 'object' && template !== null) {
        const result: any = {};
        Object.entries(template).forEach(([key, value]) => {
          result[key] = this.processTemplate(value, data);
        });
        return result;
      }

      return template;
    },

    getNestedValue(obj: any, path: string): any {
      return path.split('.').reduce((current, key) => current?.[key], obj);
    },
  };
}

/**
 * 🎯 Ultimate Template Manager
 */
export class TemplateManager {
  private options: Required<TemplateOptions>;
  private templateCache = new Map<string, string>();

  constructor(options: TemplateOptions = {}) {
    this.options = {
      views: options.views || path.join(process.cwd(), 'views'),
      cache: options.cache !== false,
      engine: options.engine || 'mustache',
      pathAliases: {
        '@': process.cwd(),
        '@views': options.views || path.join(process.cwd(), 'views'),
        ...options.pathAliases,
      },
      encoding: options.encoding || 'utf-8',
      extensions: options.extensions || ['.html', '.mustache', '.hbs', '.ejs'],
    };
  }

  /**
   * 🎨 Render template from file with path alias support
   */
  async renderFile(
    templatePath: string,
    data: any = {},
    options: RenderOptions = {}
  ): Promise<string> {
    const resolvedPath = this.resolvePath(templatePath);
    const fullPath = await this.findTemplate(resolvedPath);

    if (!fullPath) {
      throw new Error(`Template not found: ${templatePath}`);
    }

    const engine =
      options.engine ||
      this.getEngineFromExtension(fullPath) ||
      this.options.engine;
    const templateEngine = this.getEngine(engine);

    if (!templateEngine) {
      throw new Error(`Template engine '${engine}' not found`);
    }

    const cacheKey = `${fullPath}:${engine}`;
    let template = this.options.cache ? this.templateCache.get(cacheKey) : null;

    if (!template) {
      template = await fs.readFile(fullPath, this.options.encoding);
      if (this.options.cache) {
        this.templateCache.set(cacheKey, template);
      }
    }

    return await templateEngine.render(template, data, options);
  }

  /**
   * 🎭 Render template from string
   */
  async renderString(
    template: string,
    data: any = {},
    options: RenderOptions = {}
  ): Promise<string> {
    const engine = options.engine || this.options.engine;
    const templateEngine = this.getEngine(engine);

    if (!templateEngine) {
      throw new Error(`Template engine '${engine}' not found`);
    }

    return await templateEngine.render(template, data, options);
  }

  /**
   * 📁 Set views directory
   */
  setViews(viewsPath: string): void {
    this.options.views = path.resolve(viewsPath);
    this.options.pathAliases['@views'] = this.options.views;
  }

  /**
   * 🎯 Resolve path aliases (@views/template.html -> /full/path/views/template.html)
   */
  private resolvePath(templatePath: string): string {
    for (const [alias, aliasPath] of Object.entries(this.options.pathAliases)) {
      if (templatePath.startsWith(alias)) {
        return templatePath.replace(alias, aliasPath);
      }
    }

    if (!path.isAbsolute(templatePath)) {
      return path.join(this.options.views, templatePath);
    }

    return templatePath;
  }

  /**
   * 🔍 Find template with auto extension detection
   */
  private async findTemplate(templatePath: string): Promise<string | null> {
    try {
      await fs.access(templatePath);
      return templatePath;
    } catch {}

    for (const ext of this.options.extensions) {
      const pathWithExt = templatePath + ext;
      try {
        await fs.access(pathWithExt);
        return pathWithExt;
      } catch {}
    }

    return null;
  }

  /**
   * 🎨 Get template engine
   */
  private getEngine(name: string): any {
    const engines: Record<string, any> = {
      mustache: SimpleTemplateEngines.mustache,
      html: SimpleTemplateEngines.html,
      ejs: SimpleTemplateEngines.html,
      json: SimpleTemplateEngines.json,
    };

    return engines[name] || null;
  }

  /**
   * 🎨 Get template engine from file extension
   */
  private getEngineFromExtension(filePath: string): string | null {
    const ext = path.extname(filePath).toLowerCase();
    const engineMap: Record<string, string> = {
      '.mustache': 'mustache',
      '.hbs': 'mustache',
      '.handlebars': 'mustache',
      '.html': 'html',
      '.htm': 'html',
      '.ejs': 'html',
      '.json': 'json',
    };

    return engineMap[ext] || null;
  }

  /**
   * 🧹 Clear cache
   */
  clearCache(): void {
    this.templateCache.clear();
  }

  /**
   * 📊 Get cache statistics
   */
  getStats(): { templates: number } {
    return {
      templates: this.templateCache.size,
    };
  }
}

/**
 * 🚀 Create Template Manager
 */
export function createTemplateManager(
  options: TemplateOptions = {}
): TemplateManager {
  return new TemplateManager(options);
}
