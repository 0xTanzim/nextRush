/**
 * NextRush Documentation Theme
 *
 * Custom VitePress theme with NextRush branding.
 * Mermaid support is provided by vitepress-plugin-mermaid via withMermaid() wrapper.
 */

import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import { h } from 'vue';
import './style.css';

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      // Custom slots can be added here
      // 'nav-bar-title-after': () => h(Badge, { text: 'v3' }),
    });
  },
  enhanceApp({ app, router, siteData }) {
    // Mermaid component is auto-registered by vitepress-plugin-mermaid
  },
} satisfies Theme;
