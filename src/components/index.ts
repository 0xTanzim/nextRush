/**
 * 🚀 NextRush Components - SOLID Component Architecture
 * Export all available components with proper types
 */

// Component classes
export { RouterComponent } from './router/router.component';
export { StaticFilesComponent } from './static/static-files.component';
export { TemplateComponent } from './template/template.component';
export { WebSocketComponent } from './websocket/websocket.component';

// Template engine classes
export {
  SimpleTemplateEngine,
  AdvancedTemplateEngine,
  MustacheTemplateEngine,
} from './template/template.component';

// Component types - using proper interfaces
export type { ExpressRoute, ExpressRouteHandler } from './router/router.component';
export type { StaticOptions } from './static/static-files.component';
export type {
  NextRushWebSocket,
  WebSocketHandler,
} from './websocket/websocket.component';
