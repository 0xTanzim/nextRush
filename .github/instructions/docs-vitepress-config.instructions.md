---
description: 'VitePress configuration and setup standards for NextRush documentation site. Defines theme, sidebar, navigation, and search configuration.'
applyTo: 'apps/docs/.vitepress/**/*.ts, apps/docs/.vitepress/**/*.mts'
---

# NextRush VitePress Configuration Standards

This instruction file defines how to configure the **VitePress documentation site** for NextRush v3.

---

## Project Structure

```
apps/docs/
├── .vitepress/
│   ├── config.mts              # Main VitePress config
│   ├── theme/
│   │   ├── index.ts            # Custom theme setup
│   │   └── style.css           # Custom styles
│   └── components/             # Vue components (optional)
├── src/
│   ├── index.md                # Homepage
│   ├── getting-started/
│   ├── concepts/
│   ├── guides/
│   ├── packages/
│   ├── api/
│   └── examples/
├── public/
│   ├── logo.svg
│   └── og-image.png
├── package.json
└── tsconfig.json
```

---

## Main Configuration

```typescript
// apps/docs/.vitepress/config.mts

import { defineConfig } from 'vitepress';

export default defineConfig({
  // Site metadata
  title: 'NextRush',
  description: 'A minimal, modular, blazing fast Node.js framework',

  // Source directory
  srcDir: 'src',

  // Output directory
  outDir: 'dist',

  // Base URL (for GitHub Pages: /nextrush/)
  base: '/',

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
    ['meta', { property: 'og:description', content: 'A minimal, modular, blazing fast Node.js framework' }],
    ['meta', { property: 'og:image', content: 'https://nextrush.dev/og-image.png' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
  ],

  // Theme configuration
  themeConfig: {
    logo: '/logo.svg',

    // Navigation bar
    nav: [
      { text: 'Guide', link: '/getting-started/introduction' },
      { text: 'API', link: '/api/context' },
      { text: 'Packages', link: '/packages/core' },
      {
        text: 'v3.0.0',
        items: [
          { text: 'Changelog', link: '/community/changelog' },
          { text: 'Roadmap', link: '/community/roadmap' },
        ],
      },
    ],

    // Sidebar configuration
    sidebar: {
      '/getting-started/': sidebarGettingStarted(),
      '/concepts/': sidebarConcepts(),
      '/guides/': sidebarGuides(),
      '/packages/': sidebarPackages(),
      '/api/': sidebarAPI(),
      '/examples/': sidebarExamples(),
    },

    // Social links
    socialLinks: [
      { icon: 'github', link: 'https://github.com/0xtanzim/nextrush' },
    ],

    // Search
    search: {
      provider: 'local',
      options: {
        detailedView: true,
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
      copyright: 'Copyright © 2024-present NextRush Contributors',
    },

    // Carbon ads (optional)
    // carbonAds: {
    //   code: 'your-carbon-code',
    //   placement: 'your-carbon-placement',
    // },
  },

  // Markdown configuration
  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
    lineNumbers: false,  // Enable for API reference pages if needed
  },

  // Vue configuration
  vue: {
    template: {
      compilerOptions: {
        // Custom element handling if needed
      },
    },
  },
});
```

---

## Sidebar Configuration

### Getting Started Sidebar

```typescript
function sidebarGettingStarted() {
  return [
    {
      text: 'Getting Started',
      items: [
        { text: 'Introduction', link: '/getting-started/introduction' },
        { text: 'Quick Start', link: '/getting-started/quick-start' },
        { text: 'Installation', link: '/getting-started/installation' },
        { text: 'First Application', link: '/getting-started/first-app' },
      ],
    },
    {
      text: 'Core Concepts',
      items: [
        { text: 'Application', link: '/concepts/application' },
        { text: 'Context', link: '/concepts/context' },
        { text: 'Middleware', link: '/concepts/middleware' },
        { text: 'Routing', link: '/concepts/routing' },
      ],
    },
  ];
}
```

### Concepts Sidebar

```typescript
function sidebarConcepts() {
  return [
    {
      text: 'Core Concepts',
      items: [
        { text: 'Application', link: '/concepts/application' },
        { text: 'Context', link: '/concepts/context' },
        { text: 'Middleware', link: '/concepts/middleware' },
        { text: 'Routing', link: '/concepts/routing' },
        { text: 'Plugins', link: '/concepts/plugins' },
        { text: 'Error Handling', link: '/concepts/error-handling' },
      ],
    },
    {
      text: 'Architecture',
      items: [
        { text: 'Package Structure', link: '/concepts/package-structure' },
        { text: 'Design Decisions', link: '/concepts/design-decisions' },
      ],
    },
  ];
}
```

### Guides Sidebar

```typescript
function sidebarGuides() {
  return [
    {
      text: 'Tutorials',
      items: [
        { text: 'Building a REST API', link: '/guides/rest-api' },
        { text: 'Authentication', link: '/guides/authentication' },
        { text: 'Database Integration', link: '/guides/database' },
        { text: 'Testing', link: '/guides/testing' },
        { text: 'Deployment', link: '/guides/deployment' },
      ],
    },
    {
      text: 'Migration',
      items: [
        { text: 'From v2 to v3', link: '/guides/migration-v2' },
        { text: 'From Express', link: '/guides/migration-express' },
        { text: 'From Koa', link: '/guides/migration-koa' },
      ],
    },
    {
      text: 'Advanced',
      items: [
        { text: 'Custom Middleware', link: '/guides/custom-middleware' },
        { text: 'Plugin Development', link: '/guides/plugin-development' },
        { text: 'Performance Tuning', link: '/guides/performance' },
      ],
    },
  ];
}
```

### Packages Sidebar

```typescript
function sidebarPackages() {
  return [
    {
      text: 'Core Packages',
      items: [
        { text: '@nextrush/core', link: '/packages/core' },
        { text: '@nextrush/router', link: '/packages/router' },
        { text: '@nextrush/types', link: '/packages/types' },
      ],
    },
    {
      text: 'Middleware',
      items: [
        { text: '@nextrush/body-parser', link: '/packages/body-parser' },
        { text: '@nextrush/cors', link: '/packages/cors' },
        { text: '@nextrush/helmet', link: '/packages/helmet' },
        { text: '@nextrush/rate-limit', link: '/packages/rate-limit' },
        { text: '@nextrush/compression', link: '/packages/compression' },
        { text: '@nextrush/cookies', link: '/packages/cookies' },
        { text: '@nextrush/request-id', link: '/packages/request-id' },
        { text: '@nextrush/timer', link: '/packages/timer' },
      ],
    },
    {
      text: 'Plugins',
      items: [
        { text: '@nextrush/logger', link: '/packages/logger' },
        { text: '@nextrush/static', link: '/packages/static' },
        { text: '@nextrush/template', link: '/packages/template' },
        { text: '@nextrush/websocket', link: '/packages/websocket' },
      ],
    },
    {
      text: 'Advanced',
      items: [
        { text: '@nextrush/di', link: '/packages/di' },
        { text: '@nextrush/decorators', link: '/packages/decorators' },
      ],
    },
  ];
}
```

### API Sidebar

```typescript
function sidebarAPI() {
  return [
    {
      text: 'API Reference',
      items: [
        { text: 'Context', link: '/api/context' },
        { text: 'Application', link: '/api/application' },
        { text: 'Router', link: '/api/router' },
        { text: 'Middleware', link: '/api/middleware' },
        { text: 'Plugin', link: '/api/plugin' },
      ],
    },
    {
      text: 'Types',
      items: [
        { text: 'Core Types', link: '/api/types' },
        { text: 'HTTP Types', link: '/api/http-types' },
      ],
    },
  ];
}
```

### Examples Sidebar

```typescript
function sidebarExamples() {
  return [
    {
      text: 'Examples',
      items: [
        { text: 'Hello World', link: '/examples/hello-world' },
        { text: 'REST CRUD', link: '/examples/rest-crud' },
        { text: 'Real-time Chat', link: '/examples/real-time-chat' },
        { text: 'File Upload', link: '/examples/file-upload' },
        { text: 'JWT Authentication', link: '/examples/jwt-auth' },
      ],
    },
  ];
}
```

---

## Homepage Configuration

```markdown
<!-- apps/docs/src/index.md -->
---
layout: home

hero:
  name: NextRush
  text: Minimal. Modular. Blazing Fast.
  tagline: A Node.js framework built for the modern web
  image:
    src: /logo.svg
    alt: NextRush
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started/introduction
    - theme: alt
      text: View on GitHub
      link: https://github.com/0xtanzim/nextrush

features:
  - icon: ⚡
    title: Blazing Fast
    details: 30,000+ requests per second. Radix tree routing. Zero overhead middleware.
  - icon: 📦
    title: Modular
    details: Use only what you need. Every feature is a separate package. Core under 3,000 LOC.
  - icon: 🔒
    title: Type-Safe
    details: Full TypeScript support. Zero any types. Perfect IntelliSense.
  - icon: 🧩
    title: Extensible
    details: Plugin system for endless customization. Build your own middleware in minutes.
---
```

---

## Custom Theme Setup

```typescript
// apps/docs/.vitepress/theme/index.ts

import { h } from 'vue';
import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import './style.css';

// Import custom components if needed
// import CustomComponent from './components/CustomComponent.vue';

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      // Add custom slots here
      // 'nav-bar-title-after': () => h(Badge, { text: 'v3' }),
    });
  },
  enhanceApp({ app, router, siteData }) {
    // Register global components
    // app.component('CustomComponent', CustomComponent);
  },
} satisfies Theme;
```

---

## Custom Styles

```css
/* apps/docs/.vitepress/theme/style.css */

:root {
  /* Brand colors */
  --vp-c-brand-1: #646cff;
  --vp-c-brand-2: #747bff;
  --vp-c-brand-3: #8b93ff;
  --vp-c-brand-soft: rgba(100, 108, 255, 0.14);

  /* Custom properties */
  --nextrush-code-bg: #1a1a2e;
}

.dark {
  --vp-c-brand-1: #747bff;
  --vp-c-brand-2: #8b93ff;
  --vp-c-brand-3: #a3a9ff;
}

/* Code block customization */
.vp-doc div[class*='language-'] {
  border-radius: 8px;
}

/* Custom container styles */
.custom-block.tip {
  border-color: var(--vp-c-brand-1);
}

/* Home page customization */
.VPHome .name {
  background: linear-gradient(120deg, var(--vp-c-brand-1) 30%, var(--vp-c-brand-3));
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Sidebar customization */
.VPSidebar .VPSidebarItem.level-0 > .item > .text {
  font-weight: 600;
}
```

---

## Package.json

```json
{
  "name": "@nextrush/docs",
  "version": "3.0.0-alpha.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vitepress dev src",
    "build": "vitepress build src",
    "preview": "vitepress preview src",
    "lint": "prettier --check src/**/*.md"
  },
  "devDependencies": {
    "vitepress": "^1.5.0",
    "vue": "^3.5.0",
    "prettier": "^3.3.0"
  }
}
```

---

## Search Configuration

### Local Search (Default)

```typescript
// In themeConfig
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
```

### Algolia Search (Production)

```typescript
// For larger documentation sites
search: {
  provider: 'algolia',
  options: {
    appId: 'YOUR_APP_ID',
    apiKey: 'YOUR_SEARCH_API_KEY',
    indexName: 'nextrush',
    searchParameters: {
      facetFilters: ['version:v3'],
    },
  },
},
```

---

## Build and Deploy

### GitHub Actions

```yaml
# .github/workflows/docs.yml
name: Deploy Docs

on:
  push:
    branches: [main]
    paths:
      - 'apps/docs/**'
      - '.github/workflows/docs.yml'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install

      - name: Build docs
        run: pnpm --filter @nextrush/docs build

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: apps/docs/dist
```

### Vercel Configuration

```json
// apps/docs/vercel.json
{
  "buildCommand": "pnpm build",
  "outputDirectory": "dist",
  "framework": "vitepress"
}
```

---

## Performance Optimization

### Lazy Loading

```typescript
// For large sidebar configurations
sidebar: {
  '/guides/': () => import('./sidebar-guides').then(m => m.default),
},
```

### Image Optimization

```markdown
<!-- Use responsive images -->
![Middleware flow](./middleware-flow.png){width=800 loading=lazy}

<!-- Or WebP format -->
<picture>
  <source srcset="./middleware-flow.webp" type="image/webp">
  <img src="./middleware-flow.png" alt="Middleware flow" loading="lazy">
</picture>
```

### Preload Critical Resources

```typescript
head: [
  ['link', { rel: 'preload', href: '/logo.svg', as: 'image' }],
  ['link', { rel: 'dns-prefetch', href: 'https://fonts.googleapis.com' }],
],
```

---

## Accessibility

### Required Meta Tags

```typescript
head: [
  ['meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  ['html', { lang: 'en' }],
],
```

### Skip Link

VitePress includes a skip link by default. Ensure it works:

```css
/* Customize skip link if needed */
.VPSkipLink {
  /* Custom styles */
}
```

### Color Contrast

Ensure all custom colors meet WCAG AA standards:

```css
:root {
  /* These colors must have sufficient contrast */
  --vp-c-text-1: #1a1a1a;  /* Main text */
  --vp-c-text-2: #4a4a4a;  /* Secondary text */
}

.dark {
  --vp-c-text-1: #ffffff;
  --vp-c-text-2: #c9c9c9;
}
```

---

## Quality Checklist

Before deploying documentation site:

### Configuration
- [ ] Site title and description set
- [ ] Social links configured
- [ ] Edit links working
- [ ] Search functional
- [ ] Sidebar navigation complete

### Performance
- [ ] Build time < 60 seconds
- [ ] Page load < 3 seconds
- [ ] Lighthouse score > 90

### Accessibility
- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] Color contrast passes WCAG AA
- [ ] All images have alt text

### SEO
- [ ] Sitemap generated
- [ ] OG tags configured
- [ ] Canonical URLs set
- [ ] robots.txt configured
