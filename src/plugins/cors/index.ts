/**
 * 🔥 CORS Module - Complete Export
 * Optimized CORS system with all components
 */

// Main plugin
export { CorsPlugin } from './cors.plugin';

// Types
export * from './types';

// Utilities
export { CorsMetricsCollector } from './metrics-collector';
export { OriginValidator } from './origin-validator';
export { SecurityHeadersManager, SecurityPresets } from './security-headers';

// Presets
export { CorsPresets } from './presets';

// Re-export for convenience
export { CorsPresets as Presets } from './presets';
