/**
 * 🚀 NextRush Ultimate Template Engine - Refactored
 * The most powerful, flexible, and developer-friendly template system ever built!
 *
 * Features:
 * - 🎯 Multiple engine support (Mustache, Handlebars-like, JSX-like)
 * - 🔥 Streaming rendering for performance
 * - 🧩 Component system with slots
 * - 📁 Path aliases and smart resolving
 * - 🎨 Layout system with inheritance
 * - 🛡️ Type-safe template compilation
 * - ⚡ Caching and optimization
 * - 🌐 Internationalization support
 * - 🧪 Built-in testing utilities
 * - 📝 Frontmatter support (YAML)
 * - 🎭 Partials and includes
 * - 🔧 Custom helpers and filters
 * - 🌍 Multi-syntax support
 */

// Export all types
export * from './types';

// Export core components
export { TemplateHelperManager } from './helpers';
export { UltimateTemplateParser } from './parser';
export { UltimateTemplateRenderer } from './renderer';

// Export simple template functions for easy DX
export {
  advancedTemplate,
  createTemplate,
  quickTemplate,
  webTemplate,
  type SimpleTemplateOptions,
} from './simple-template';

// Export utilities
export {
  createSlotMap,
  escapeHTML,
  evaluateCondition,
  getValue,
  MockWritableStream,
  parseFrontmatter,
  resolveTemplatePath,
} from './utils';

// Export testing utilities
export {
  benchmarkTemplate,
  compareTemplateEngines,
  testTemplateRender,
  validateTemplateSyntax,
} from './testing';

// Legacy compatibility exports
export default {
  UltimateTemplateParser: require('./parser').UltimateTemplateParser,
  UltimateTemplateRenderer: require('./renderer').UltimateTemplateRenderer,
  TemplateHelperManager: require('./helpers').TemplateHelperManager,
  testTemplateRender: require('./testing').testTemplateRender,
  validateTemplateSyntax: require('./testing').validateTemplateSyntax,
  benchmarkTemplate: require('./testing').benchmarkTemplate,
  compareTemplateEngines: require('./testing').compareTemplateEngines,
};
