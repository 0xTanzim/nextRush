/**
 * Template Engine Utilities - Template processing helpers
 */

export interface TemplateEngine {
  render(template: string, data: Record<string, any>): string;
  renderFile(filePath: string, data: Record<string, any>): Promise<string>;
}

export class SimpleTemplateEngine implements TemplateEngine {
  render(template: string, data: Record<string, any> = {}): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? String(data[key]) : match;
    });
  }

  async renderFile(
    filePath: string,
    data: Record<string, any> = {}
  ): Promise<string> {
    const fs = await import('fs/promises');
    const template = await fs.readFile(filePath, 'utf-8');
    return this.render(template, data);
  }
}

export class MustacheTemplateEngine implements TemplateEngine {
  render(template: string, data: Record<string, any> = {}): string {
    // Basic Mustache-style rendering
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = data[key];
      if (value === undefined || value === null) return '';
      return String(value);
    });
  }

  async renderFile(
    filePath: string,
    data: Record<string, any> = {}
  ): Promise<string> {
    const fs = await import('fs/promises');
    const template = await fs.readFile(filePath, 'utf-8');
    return this.render(template, data);
  }
}

export function createTemplateEngine(
  type: 'simple' | 'mustache' = 'simple'
): TemplateEngine {
  switch (type) {
    case 'mustache':
      return new MustacheTemplateEngine();
    case 'simple':
    default:
      return new SimpleTemplateEngine();
  }
}
