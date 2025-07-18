/**
 * 🎨 NextRush Template System
 * Export all template-related functionality
 */

export { TemplatePlugin } from './template.plugin';
export {
  UltimateTemplateParser,
  UltimateTemplateRenderer,
} from './ultimate-template-engine';
export type {
  FilterRegistry,
  HelperRegistry,
  I18nConfig,
  ParseResult,
  PathAliases,
  RenderOptions,
  TemplateContext,
  TemplateNode,
  TemplateOptions,
} from './ultimate-template-engine';

// 🎯 Default export
export { TemplatePlugin as default } from './template.plugin';
