'use client';

import { AskAiTrigger } from '@/components/ask-ai-trigger';
import { cn } from '@/lib/cn';
import { useSearchContext } from 'fumadocs-ui/contexts/search';
import { SidebarTrigger } from 'fumadocs-ui/layouts/docs/slots/sidebar';
import { GitFork, Menu, Moon, Search, Sun, Zap } from 'lucide-react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';

/** No-op subscribe: this store never changes, it only differs between server and client snapshots. */
function subscribeNoop() {
  return () => {};
}

/**
 * Hydration-safe "has the client mounted yet" check via `useSyncExternalStore`
 * (the React-blessed pattern for this exact case — a plain `useEffect(() =>
 * setMounted(true), [])` trips the `react-hooks/set-state-in-effect` lint rule,
 * and rendering `resolvedTheme` directly on the server causes a real hydration
 * mismatch since `next-themes` only resolves the real theme client-side).
 */
function useIsMounted(): boolean {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

/**
 * Real, persistent site header — replaces Fumadocs' default `nav.component` for
 * `DocsLayout`/`baseOptions()`.
 *
 * Why this exists: Fumadocs' standard `DocsLayout` renders `nav.links` (Documentation,
 * Packages, Reference, Blog, Skills) as children of the sidebar `<aside>` at every
 * viewport — there is no persistent top navbar for `DocsLayout`, only a mobile-only
 * header per Fumadocs' own docs. Global site navigation now lives here, in real
 * `<header>` DOM, on every viewport — the sidebar (`docs/layout.tsx`) is exclusively the
 * current page's doc tree + version + Ask AI.
 *
 * `SidebarTrigger` opens the DOCS PAGE-TREE drawer and requires `SidebarContext`, which
 * only exists inside `<DocsLayout>` (docs/layout.tsx). This header is shared across 6
 * route groups via `baseOptions()` ((home), docs, skills, blog, packages, showcase) —
 * only `docs/layout.tsx` wraps children in `DocsLayout`. Rendering `SidebarTrigger`
 * unconditionally throws "Missing SidebarContext" on every non-docs route, so it is
 * gated to `/docs/*` paths only — correct behavior anyway, since there is no page-tree
 * sidebar to toggle on the marketing/blog/skills pages.
 *
 * `version` is a required prop (not read from `@/config/appConfig` here) because that
 * module does a `readFileSync('node:fs')` at module scope to read the real version from
 * `packages/nextrush/package.json` — safe in a server component, but it broke Turbopack's
 * client bundling ("chunking context does not support external modules (request:
 * node:fs)") the moment this file (a `'use client'` component) reached it transitively
 * through the old `VersionSwitcher`, which imported `appConfig` directly. Root-caused via
 * additive bisection (adding one import at a time to a clean, passing baseline) rather
 * than the initial, wrong hypothesis that `SearchTrigger`/`ThemeSwitch`/`SidebarTrigger`
 * were the culprits — none of those actually were. `layout.shared.tsx` (a server module)
 * now resolves `appConfig.version` and passes it down as a prop instead.
 *
 * Search uses `useSearchContext` directly rather than Fumadocs' `SearchTrigger`, and
 * theme uses a local `next-themes` toggle rather than Fumadocs' `ThemeSwitch` — both
 * swaps predate the real fix above and are kept because they work and match this
 * codebase's pattern of small, purpose-built controls.
 */

const NAV_LINKS = [
  { text: 'Documentation', href: '/docs' },
  { text: 'Packages', href: '/packages' },
  { text: 'Reference', href: '/docs/reference' },
  { text: 'Blog', href: '/blog' },
  { text: 'Skills', href: '/skills' },
] as const;

/**
 * "Documentation" is active for any /docs/* path NOT claimed by a more specific link
 * (currently only "Reference" -> /docs/reference is both a nav link and a docs subpath).
 * Every other link is active on an exact match or its own subpath.
 */
function isActive(pathname: string, href: string): boolean {
  if (href === '/docs') {
    return pathname === '/docs' || (pathname.startsWith('/docs/') && !pathname.startsWith('/docs/reference'));
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useIsMounted();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      aria-label="Toggle theme"
      className="inline-flex items-center rounded-md p-1.5 text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
    >
      {mounted && resolvedTheme === 'dark' ? (
        <Sun className="size-4" aria-hidden />
      ) : (
        <Moon className="size-4" aria-hidden />
      )}
    </button>
  );
}

export function SiteHeader({ version }: { version: string }) {
  const pathname = usePathname();
  const { setOpenSearch } = useSearchContext();
  const isDocsRoute = pathname.startsWith('/docs');

  return (
    <header className="sticky top-0 z-40 flex h-[var(--fd-nav-height)] items-center gap-2 overflow-x-hidden border-b border-fd-border bg-fd-background/95 px-3 backdrop-blur-sm supports-backdrop-filter:bg-fd-background/60 sm:px-4">
      {/* Docs page-tree sidebar trigger — mobile only, docs routes only (requires
          SidebarContext from DocsLayout, which only wraps /docs/* pages). */}
      {isDocsRoute && (
        <SidebarTrigger
          className="-ms-1 me-0.5 shrink-0 rounded-md p-1.5 text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground lg:hidden"
          aria-label="Open Sidebar"
        >
          <Menu className="size-5" aria-hidden />
        </SidebarTrigger>
      )}

      <Link href="/" className="flex shrink-0 items-center gap-2 font-bold">
        <Zap className="size-5 text-[#3b82f6]" aria-hidden />
        <span className="gradient-text hidden sm:inline">NextRush</span>
      </Link>

      {/* Single row at every viewport — scrolls horizontally rather than wrapping or
          stacking a second bar, so there is exactly one nav-height to reason about and
          no absolute-positioning/z-index risk. */}
      <nav
        aria-label="Site"
        className="ms-1 flex max-w-[45vw] min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [mask-image:linear-gradient(to_right,black_calc(100%-24px),transparent)] sm:ms-3 sm:max-w-[60vw] sm:gap-1 sm:[mask-image:none]"
      >
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'shrink-0 whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-medium transition-colors sm:px-2.5',
              isActive(pathname, link.href)
                ? 'text-fd-primary'
                : 'text-fd-muted-foreground hover:text-fd-foreground'
            )}
          >
            {link.text}
          </Link>
        ))}
      </nav>

      <div className="ms-auto flex min-w-0 shrink items-center gap-0.5 sm:gap-1.5">
        <button
          type="button"
          onClick={() => setOpenSearch(true)}
          aria-label="Open Search"
          className="hidden items-center gap-1.5 rounded-md p-1.5 text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground sm:inline-flex"
        >
          <Search className="size-4" aria-hidden />
        </button>
        <span className="hidden items-center rounded-md border border-fd-border px-2 py-1 text-xs font-medium text-fd-muted-foreground sm:inline-flex">
          v{version}
        </span>
        <AskAiTrigger />
        <ThemeToggle />
        <Link
          href="https://github.com/0xTanzim/nextrush"
          target="_blank"
          rel="noreferrer"
          aria-label="GitHub"
          className="hidden rounded-md p-1.5 text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground sm:inline-flex"
        >
          <GitFork className="size-4" aria-hidden />
        </Link>
      </div>
    </header>
  );
}
