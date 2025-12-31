import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';
import {
  sidebarAPI,
  sidebarArchitecture,
  sidebarBenchmark,
  sidebarCommunity,
  sidebarExamples,
  sidebarGuide,
  sidebarPackages,
} from './sidebar';

export default withMermaid(defineConfig({
  // Site metadata
  title: 'NextRush',
  description: 'A minimal, modular, blazing fast Node.js framework',

  // Source directory
  srcDir: 'src',

  // Output directory
  outDir: 'dist',

  // Base URL
  base: '/',

  // Ignore all dead links during alpha development
  ignoreDeadLinks: true,

  // Last updated timestamp
  lastUpdated: true,

  // Clean URLs (no .html extension)
  cleanUrls: true,

  // Sitemap
  sitemap: {
    hostname: 'https://nextrush.dev',
  },

  // Head tags
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'NextRush' }],
    [
      'meta',
      {
        property: 'og:description',
        content: 'A minimal, modular, blazing fast Node.js framework',
      },
    ],
    ['meta', { property: 'og:image', content: 'https://nextrush.dev/og-image.png' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  ],

  // Theme configuration
  themeConfig: {
    logo: '/logo.svg',

    // Navigation bar with dropdown menus
    nav: [
      {
        text: 'Guide',
        activeMatch: '/getting-started/|/concepts/|/guides/',
        items: [
          {
            text: 'Getting Started',
            items: [
              { text: 'Introduction', link: '/getting-started/' },
              { text: 'Quick Start', link: '/getting-started/quick-start' },
              { text: 'Installation', link: '/getting-started/installation' },
            ],
          },
          {
            text: 'Core Concepts',
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
            items: [
              { text: 'Overview', link: '/guides/' },
              { text: 'REST API', link: '/guides/rest-api' },
              { text: 'Authentication', link: '/guides/authentication' },
              { text: 'Testing', link: '/guides/testing' },
            ],
          },
        ],
      },
      {
        text: 'Packages',
        activeMatch: '/packages/',
        items: [
          {
            text: 'Overview',
            items: [
              { text: 'Package Architecture', link: '/packages/' },
              { text: 'nextrush (Meta)', link: '/packages/nextrush' },
            ],
          },
          {
            text: 'Core',
            items: [
              { text: '@nextrush/core', link: '/packages/core' },
              { text: '@nextrush/router', link: '/packages/router' },
              { text: '@nextrush/types', link: '/packages/types' },
              { text: '@nextrush/errors', link: '/packages/errors/' },
            ],
          },
          {
            text: 'Middleware',
            items: [
              { text: 'Body Parser', link: '/packages/middleware/body-parser' },
              { text: 'CORS', link: '/packages/middleware/cors' },
              { text: 'Helmet', link: '/packages/middleware/helmet' },
              { text: 'Rate Limit', link: '/packages/middleware/rate-limit' },
            ],
          },
          {
            text: 'Adapters & Plugins',
            items: [
              { text: 'Adapters Overview', link: '/packages/adapters/' },
              { text: 'Plugins Overview', link: '/packages/plugins/' },
              { text: 'Class-Based (DI)', link: '/packages/di/' },
            ],
          },
        ],
      },
      { text: 'Architecture', link: '/architecture/' },
      { text: 'Examples', link: '/examples/' },
      { text: 'Benchmark', link: '/benchmark' },
      {
        text: 'v3.0.0-alpha',
        items: [
          { text: 'Changelog', link: '/community/changelog' },
          { text: 'Roadmap', link: '/community/roadmap' },
          { text: 'Contributing', link: '/community/contributing' },
        ],
      },
    ],

    // Sidebar configuration - unified guide sidebar prevents vanishing sections
    sidebar: {
      '/getting-started/': sidebarGuide(),
      '/concepts/': sidebarGuide(),
      '/guides/': sidebarGuide(),
      '/packages/': sidebarPackages(),
      '/api/': sidebarAPI(),
      '/architecture/': sidebarArchitecture(),
      '/examples/': sidebarExamples(),
      '/community/': sidebarCommunity(),
      '/benchmark': sidebarBenchmark(),
    },

    // Social links
    socialLinks: [{ icon: 'github', link: 'https://github.com/0xtanzim/nextrush' }],

    // Search
    search: {
      provider: 'local',
      options: {
        detailedView: true,
        miniSearch: {
          searchOptions: {
            fuzzy: 0.2,
            prefix: true,
            boost: { title: 4, text: 2, titles: 1 },
          },
        },
      },
    },

    // Edit link
    editLink: {
      pattern: 'https://github.com/0xtanzim/nextrush/edit/main/apps/docs/src/:path',
      text: 'Edit this page on GitHub',
    },

    // Footer
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025-present NextRush Contributors',
    },

    // Outline
    outline: {
      level: [2, 3],
    },
  },

  // Markdown configuration
  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
    lineNumbers: false,
  },

  // Mermaid configuration for diagrams
  // Using 'dark' theme for dark mode compatibility
  mermaid: {
    theme: 'dark',
  },
}));
