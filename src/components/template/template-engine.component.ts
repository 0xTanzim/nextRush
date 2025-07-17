/**
 * 🎨 Template Engine Component - Enterprise Template Processing
 * SOLID-compliant component for template rendering
 */

import { BaseComponent } from '../../core/app/base-component';
import type { MinimalApplication } from '../../core/interfaces';

/**
 * Template Engine Component - Provides template rendering capabilities
 */
export class TemplateEngineComponent extends BaseComponent {
  override readonly name = 'TemplateEngine';

  /**
   * Install template engine capabilities
   */
  install(app: MinimalApplication): void {
    // Template engine capabilities are installed
  }

  /**
   * Start the template engine
   */
  override async start(): Promise<void> {
    console.log('Template engine component started');
  }

  /**
   * Stop the template engine
   */
  override async stop(): Promise<void> {
    console.log('Template engine component stopped');
  }

  /**
   * Render a template with data
   */
  render(template: string, data: Record<string, any> = {}): string {
    // Simple template rendering - replace {{key}} with values
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? String(data[key]) : match;
    });
  }

  /**
   * Render a Mustache-style template
   */
  renderMustache(template: string, data: Record<string, any> = {}): string {
    // Basic Mustache-style rendering
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = data[key];
      if (value === undefined || value === null) return '';
      return String(value);
    });
  }

  /**
   * Load and render template from file
   */
  async renderFile(
    filePath: string,
    data: Record<string, any> = {}
  ): Promise<string> {
    const fs = await import('fs/promises');
    const template = await fs.readFile(filePath, 'utf-8');

    // Determine engine based on file extension
    if (filePath.endsWith('.mustache')) {
      return this.renderMustache(template, data);
    }

    return this.render(template, data);
  }
}
