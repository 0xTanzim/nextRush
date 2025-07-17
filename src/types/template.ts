/**
 * 🎨 Template Engine Types - Clean Type Definitions
 * Proper TypeScript types for template rendering
 */

/**
 * Template primitive values
 */
export type TemplatePrimitive = string | number | boolean | null | undefined;

/**
 * Template data structure - can contain primitives, arrays, or nested objects
 */
export interface TemplateData {
  [key: string]: TemplatePrimitive | TemplatePrimitive[] | TemplateData | TemplateData[];
}

/**
 * Template engine configuration
 */
export interface TemplateEngineConfig {
  viewsDirectory?: string;
  extension?: string;
  cache?: boolean;
  helpers?: Record<string, TemplateHelper>;
}

/**
 * Template helper function type
 */
export type TemplateHelper = (...args: TemplatePrimitive[]) => TemplatePrimitive;

/**
 * Template rendering options
 */
export interface TemplateRenderOptions {
  cache?: boolean;
  layout?: string;
  partials?: Record<string, string>;
  helpers?: Record<string, TemplateHelper>;
}

/**
 * Template engine interface
 */
export interface ITemplateEngine {
  render(template: string, data?: TemplateData, options?: TemplateRenderOptions): string;
  renderFile(filePath: string, data?: TemplateData, options?: TemplateRenderOptions): Promise<string>;
  configure(config: TemplateEngineConfig): void;
}
