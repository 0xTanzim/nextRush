import { appConfig } from '@/config/appConfig';
import { SiteHeader } from '@/components/site-header';
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

/**
 * Shared nav/layout options consumed by every top-level route group
 * ((home), docs, skills, blog) — see apps/docs/src/app/**\/layout.tsx.
 *
 * `nav.component` replaces Fumadocs' default navbar entirely (the documented "Replace
 * Navbar" extension point — fumadocs.dev/docs/ui/layouts/nav#replace-navbar) with
 * `SiteHeader` (src/components/site-header.tsx). This is a deliberate rewrite, not the
 * original Phase 1 nav shell (T7): a UX audit found Fumadocs' default `DocsLayout` has
 * no persistent top navbar — `nav.links` renders inside the sidebar `<aside>` at every
 * viewport, worst on mobile where there's no header to separate "global site nav" from
 * "this page's doc tree". Documentation, Packages, Reference, Blog, Skills, and GitHub
 * now all live exclusively inside `SiteHeader`'s real `<header>` DOM, never the sidebar
 * — `links`/`githubUrl` on `BaseLayoutProps` are intentionally unset here since Fumadocs
 * ignores both when a custom `nav.component` is set. `--fd-nav-height` must stay accurate
 * to `SiteHeader`'s real height (see global.css) or Fumadocs' internal layout math breaks.
 */
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      // `nav.title` is unused by SiteHeader (nav.component fully replaces the navbar),
      // but Fumadocs' DocsLayout sidebar still renders an internal `navTitle` slot from
      // this same context — leaving it unset produces an empty, unlabeled <a href="/">
      // in the sidebar (a real WCAG 2.2 AA link-name violation, confirmed via axe-core).
      title: 'NextRush',
      component: <SiteHeader version={appConfig.version} />,
    },
  };
}
