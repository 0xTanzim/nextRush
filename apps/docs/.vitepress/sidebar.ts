/**
 * NextRush Documentation Sidebar Configuration
 *
 * Modern UX with:
 * - Unified sidebars for related content (no vanishing sections)
 * - Collapsible groups for better organization
 * - Clear visual hierarchy
 */

import type { DefaultTheme } from 'vitepress';

/**
 * Unified Guide Sidebar
 *
 * Used for: /getting-started/, /concepts/, /guides/
 * This ensures the sidebar stays consistent when navigating between these sections.
 */
export function sidebarGuide(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: 'Getting Started',
      collapsed: false,
      items: [
        { text: 'Introduction', link: '/getting-started/' },
        { text: 'Quick Start', link: '/getting-started/quick-start' },
        { text: 'Installation', link: '/getting-started/installation' },
      ],
    },
    {
      text: 'Core Concepts',
      collapsed: false,
      items: [
        { text: 'Overview', link: '/concepts/' },
        { text: 'Application', link: '/concepts/application' },
        { text: 'Context', link: '/concepts/context' },
        { text: 'Middleware', link: '/concepts/middleware' },
        { text: 'Routing', link: '/concepts/routing' },
        { text: 'Plugins', link: '/concepts/plugins' },
        { text: 'Guards', link: '/concepts/guards' },
      ],
    },
    {
      text: 'Guides',
      collapsed: true,
      items: [
        { text: 'Overview', link: '/guides/' },
        { text: 'Development Tools', link: '/guides/dev-tools' },
        { text: 'Class-Based Development', link: '/guides/class-based-development' },
        { text: 'REST API', link: '/guides/rest-api' },
        { text: 'Authentication', link: '/guides/authentication' },
        { text: 'Error Handling', link: '/guides/error-handling' },
        { text: 'Testing', link: '/guides/testing' },
      ],
    },
  ];
}

/**
 * Packages Sidebar with Collapsible Groups
 *
 * Used for: /packages/
 * Organizes the many packages into collapsible categories.
 */
export function sidebarPackages(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: 'Overview',
      items: [
        { text: 'Package Architecture', link: '/packages/' },
        { text: 'nextrush (Meta Package)', link: '/packages/nextrush' },
      ],
    },
    {
      text: 'Core Packages',
      collapsed: false,
      items: [
        { text: '@nextrush/core', link: '/packages/core' },
        { text: '@nextrush/router', link: '/packages/router' },
        { text: '@nextrush/types', link: '/packages/types' },
        { text: '@nextrush/errors', link: '/packages/errors/' },
        { text: '@nextrush/runtime', link: '/packages/runtime' },
        { text: '@nextrush/dev', link: '/packages/dev' },
      ],
    },
    {
      text: 'Adapters',
      collapsed: true,
      items: [
        { text: 'Overview', link: '/packages/adapters/' },
        { text: '@nextrush/adapter-node', link: '/packages/adapters/node' },
        { text: '@nextrush/adapter-bun', link: '/packages/adapters/bun' },
        { text: '@nextrush/adapter-deno', link: '/packages/adapters/deno' },
        { text: '@nextrush/adapter-edge', link: '/packages/adapters/edge' },
      ],
    },
    {
      text: 'Middleware',
      collapsed: true,
      items: [
        { text: 'Overview', link: '/packages/middleware/' },
        { text: 'Body Parser', link: '/packages/middleware/body-parser' },
        { text: 'CORS', link: '/packages/middleware/cors' },
        { text: 'Helmet', link: '/packages/middleware/helmet' },
        { text: 'Rate Limit', link: '/packages/middleware/rate-limit' },
        { text: 'Compression', link: '/packages/middleware/compression' },
        { text: 'Cookies', link: '/packages/middleware/cookies' },
        { text: 'Request ID', link: '/packages/middleware/request-id' },
        { text: 'Timer', link: '/packages/middleware/timer' },
      ],
    },
    {
      text: 'Plugins',
      collapsed: true,
      items: [
        { text: 'Overview', link: '/packages/plugins/' },
        { text: 'Logger', link: '/packages/plugins/logger' },
        { text: 'Static', link: '/packages/plugins/static' },
        { text: 'Template', link: '/packages/plugins/template' },
        { text: 'WebSocket', link: '/packages/plugins/websocket' },
        { text: 'Events', link: '/packages/plugins/events' },
      ],
    },
    {
      text: 'Class-Based Development',
      collapsed: true,
      items: [
        { text: '@nextrush/controllers', link: '/packages/controllers/' },
        { text: '@nextrush/di', link: '/packages/di/' },
        { text: '@nextrush/decorators', link: '/packages/decorators/' },
      ],
    },
  ];
}

/**
 * Architecture Sidebar
 *
 * Used for: /architecture/
 */
export function sidebarArchitecture(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: 'Architecture',
      collapsed: false,
      items: [
        { text: 'Overview', link: '/architecture/' },
        { text: 'Core & Application', link: '/architecture/core-application' },
        { text: 'Router Internals', link: '/architecture/routing' },
        { text: 'Adapter Architecture', link: '/architecture/adapters' },
        { text: 'Error Handling', link: '/architecture/error-handling' },
        { text: 'DI & Decorators', link: '/architecture/di-and-decorators' },
        { text: 'Runtime Compatibility', link: '/architecture/runtime-compatibility' },
      ],
    },
  ];
}

/**
 * API Reference Sidebar
 *
 * Used for: /api/
 */
export function sidebarAPI(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: 'API Reference',
      collapsed: false,
      items: [
        { text: 'Context', link: '/api/context' },
        { text: 'Application', link: '/api/application' },
        { text: 'Router', link: '/api/router' },
        { text: 'Middleware', link: '/api/middleware' },
        { text: 'Plugin', link: '/api/plugin' },
      ],
    },
  ];
}

/**
 * Examples Sidebar
 *
 * Used for: /examples/
 */
export function sidebarExamples(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: 'Examples',
      collapsed: false,
      items: [
        { text: 'Overview', link: '/examples/' },
        { text: 'Hello World', link: '/examples/hello-world' },
        { text: 'REST CRUD', link: '/examples/rest-crud' },
        { text: 'Class-Based API', link: '/examples/class-based-api' },
      ],
    },
  ];
}

/**
 * Community Sidebar
 *
 * Used for: /community/
 */
export function sidebarCommunity(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: 'Community',
      collapsed: false,
      items: [
        { text: 'Contributing', link: '/community/contributing' },
        { text: 'Changelog', link: '/community/changelog' },
      ],
    },
  ];
}

/**
 * Benchmark Sidebar
 *
 * Used for: /benchmark
 */
export function sidebarBenchmark(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: 'Performance',
      collapsed: false,
      items: [
        { text: 'Benchmarks', link: '/benchmark' },
      ],
    },
    {
      text: 'Related',
      collapsed: false,
      items: [
        { text: 'Architecture', link: '/architecture/' },
        { text: '@nextrush/router', link: '/packages/router' },
      ],
    },
  ];
}

// Legacy exports for backward compatibility
export const sidebarGettingStarted = sidebarGuide;
export const sidebarConcepts = sidebarGuide;
export const sidebarGuides = sidebarGuide;
