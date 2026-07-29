'use client';

import { AskAiTrigger } from '@/components/ask-ai-trigger';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/cn';
import { useSearchContext } from 'fumadocs-ui/contexts/search';
import { SidebarTrigger } from 'fumadocs-ui/layouts/docs/slots/sidebar';
import { ChevronDown, GitFork, Menu, Moon, Search, Sun, Zap } from 'lucide-react';
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
 */
function useIsMounted(): boolean {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

const NAV_LINKS = [
  { text: 'Documentation', href: '/docs' },
  { text: 'Packages', href: '/packages' },
  { text: 'Reference', href: '/docs/reference' },
  { text: 'Blog', href: '/blog' },
  { text: 'Skills', href: '/skills' },
] as const;

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

function MobileNavMenu({ pathname, version }: { pathname: string; version: string }) {
  const activeLink = NAV_LINKS.find((link) => isActive(pathname, link.href));
  const activeLabel = activeLink ? activeLink.text : 'Navigation';

  return (
    <Popover>
      <PopoverTrigger
        aria-label="Toggle Site Navigation"
        className="inline-flex items-center gap-1 rounded-md border border-fd-border bg-fd-card px-2.5 py-1 text-xs font-medium text-fd-foreground shadow-xs transition-colors hover:bg-fd-accent md:hidden"
      >
        <span>{activeLabel}</span>
        <ChevronDown className="size-3.5 text-fd-muted-foreground" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1.5">
        <div className="flex flex-col gap-0.5">
          {NAV_LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center justify-between rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-fd-primary/10 text-fd-primary'
                    : 'text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-foreground'
                )}
              >
                <span>{link.text}</span>
                {active && <span className="size-1.5 rounded-full bg-fd-primary" />}
              </Link>
            );
          })}
        </div>
        <div className="mt-2 border-t border-fd-border pt-2 flex items-center justify-between px-2 text-xs text-fd-muted-foreground">
          <span>Version</span>
          <span className="font-mono text-fd-foreground">v{version}</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function SiteHeader({ version }: { version: string }) {
  const pathname = usePathname();
  const { setOpenSearch } = useSearchContext();
  const isDocsRoute = pathname.startsWith('/docs');

  return (
    <header className="[grid-area:header] sticky top-0 z-40 flex h-[var(--fd-nav-height)] items-center gap-2 overflow-x-hidden border-b border-fd-border bg-fd-background/95 px-3 backdrop-blur-sm supports-backdrop-filter:bg-fd-background/60 sm:px-4">
      {/* Docs page-tree sidebar trigger — mobile only, docs routes only */}
      {isDocsRoute && (
        <SidebarTrigger
          className="-ms-1 me-0.5 shrink-0 rounded-md p-1.5 text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground lg:hidden"
          aria-label="Open Sidebar"
        >
          <Menu className="size-5" aria-hidden />
        </SidebarTrigger>
      )}

      <Link href="/" className="flex shrink-0 items-center gap-2 font-bold me-1">
        <Zap className="size-5 text-[#3b82f6]" aria-hidden />
        <span className="gradient-text hidden sm:inline">NextRush</span>
      </Link>

      {/* Mobile Site Nav Popover Dropdown */}
      <MobileNavMenu pathname={pathname} version={version} />

      {/* Desktop Site Nav */}
      <nav
        aria-label="Site Navigation"
        className="hidden md:flex ms-2 items-center gap-1 min-w-0"
      >
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
              isActive(pathname, link.href)
                ? 'text-fd-primary'
                : 'text-fd-muted-foreground hover:text-fd-foreground'
            )}
          >
            {link.text}
          </Link>
        ))}
      </nav>

      <div className="ms-auto flex min-w-0 shrink items-center gap-1 sm:gap-1.5">
        <button
          type="button"
          onClick={() => setOpenSearch(true)}
          aria-label="Open Search"
          className="inline-flex items-center gap-1.5 rounded-md p-1.5 text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
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

