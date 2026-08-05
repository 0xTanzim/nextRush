'use client';

import { AskAiTrigger } from '@/components/ask-ai-trigger';
import { Logo } from '@/components/logo';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/cn';
import { useSearchContext } from 'fumadocs-ui/contexts/search';
import { SidebarTrigger } from 'fumadocs-ui/layouts/docs/slots/sidebar';
import { ChevronDown, GitFork, Menu, Moon, Search, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';

function subscribeNoop() {
  return () => {};
}

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
    return (
      pathname === '/docs' ||
      (pathname.startsWith('/docs/') && !pathname.startsWith('/docs/reference'))
    );
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
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
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
  const activeLabel = activeLink ? activeLink.text : 'Menu';

  return (
    <Popover>
      <PopoverTrigger
        aria-label="Open site navigation"
        className={cn(
          'inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-fd-border bg-fd-card px-2.5 text-sm font-medium text-fd-foreground shadow-xs transition-colors hover:bg-fd-accent lg:hidden'
        )}
      >
        <Menu className="size-4 text-fd-muted-foreground sm:hidden" aria-hidden />
        <span className="hidden max-w-[7.5rem] truncate sm:inline">{activeLabel}</span>
        <ChevronDown className="size-3.5 text-fd-muted-foreground" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1.5">
        <div className="flex flex-col gap-0.5">
          {NAV_LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex min-h-10 items-center justify-between rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-fd-primary/10 text-fd-primary'
                    : 'text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-foreground'
                )}
              >
                <span>{link.text}</span>
                {active ? <span className="size-1.5 rounded-full bg-fd-primary" aria-hidden /> : null}
              </Link>
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-fd-border px-2 pt-2 text-xs text-fd-muted-foreground">
          <span>Version</span>
          <span className="font-mono text-fd-foreground">v{version}</span>
        </div>
        <Link
          href="https://github.com/0xTanzim/nextrush"
          target="_blank"
          rel="noreferrer"
          className="mt-1 flex min-h-10 items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-foreground sm:hidden"
        >
          <GitFork className="size-4" aria-hidden />
          GitHub
        </Link>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Shared site header for home + docs + packages/blog/skills.
 *
 * Layout (CSS grid, three equal-priority zones):
 *   [ logo / sidebar ]  ·  [ primary nav centered ]  ·  [ search + tools ]
 *
 * Using `1fr · auto · 1fr` keeps the nav optically centered even when the
 * left and right zones have different widths (logo vs search cluster).
 */
export function SiteHeader({ version }: { version: string }) {
  const pathname = usePathname();
  const { setOpenSearch } = useSearchContext();
  const isDocsRoute = pathname.startsWith('/docs');

  return (
    <header
      className={cn(
        '[grid-area:header] sticky top-0 z-40',
        /* Three-zone flex: brand | nav (flex-1, centered) | tools.
           Nav centers in the *remaining* space so it never collides with
           Search on the narrower docs content header. */
        'flex h-[var(--fd-nav-height)] w-full items-center gap-2 sm:gap-3',
        'overflow-x-hidden border-b border-fd-border/70 bg-[var(--surface-page)]',
        'px-3 sm:px-4 lg:px-5'
      )}
    >
      {/* ── Zone 1: brand (start) ── */}
      <div className="flex shrink-0 items-center justify-start gap-1 sm:gap-1.5">
        {isDocsRoute ? (
          <SidebarTrigger
            className="-ms-1 inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground lg:hidden"
            aria-label="Open documentation sidebar"
          >
            <Menu className="size-5" aria-hidden />
          </SidebarTrigger>
        ) : null}

        <Link
          href="/"
          aria-label="NextRush home"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg px-0.5 py-1 text-fd-foreground transition-colors hover:bg-fd-accent sm:px-1"
        >
          <Logo className="size-5 shrink-0" aria-hidden />
          {/* Home: always show wordmark. Docs: hide at lg+ (sidebar already brands)
              and on the tightest phones so two menu buttons don't crush "NextRush". */}
          <span
            className={cn(
              'text-sm font-semibold tracking-tight text-fd-foreground',
              isDocsRoute ? 'hidden sm:inline lg:hidden' : 'inline'
            )}
          >
            NextRush
          </span>
        </Link>
      </div>

      {/* ── Zone 2: primary nav (grows, centers within free space) ── */}
      <nav
        aria-label="Site navigation"
        className="hidden h-full min-w-0 flex-1 items-stretch justify-center gap-0.5 lg:flex"
      >
        {NAV_LINKS.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'relative inline-flex shrink-0 items-center whitespace-nowrap px-2 text-sm font-medium transition-colors xl:px-3',
                active
                  ? 'text-fd-primary'
                  : 'text-fd-muted-foreground hover:text-fd-foreground'
              )}
            >
              {link.text}
              {active ? (
                <span
                  aria-hidden
                  className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-fd-primary xl:inset-x-3"
                />
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* Spacer when desktop nav is hidden so tools stay right-aligned */}
      <div className="min-w-0 flex-1 lg:hidden" aria-hidden />

      {/* ── Zone 3: tools (end) ── */}
      <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-1.5">
        <button
          type="button"
          onClick={() => setOpenSearch(true)}
          aria-label="Search"
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-lg border border-fd-border bg-fd-card',
            'px-2 text-sm text-fd-muted-foreground shadow-xs transition-colors',
            'hover:border-fd-foreground/25 hover:text-fd-foreground',
            'sm:px-2.5'
          )}
        >
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="hidden md:inline">Search</span>
          <kbd className="pointer-events-none hidden select-none items-center gap-0.5 rounded border border-fd-border bg-fd-muted/50 px-1 font-mono text-[0.65rem] text-fd-muted-foreground xl:inline-flex">
            ⌘K
          </kbd>
        </button>

        <Link
          href="https://github.com/0xTanzim/nextrush"
          target="_blank"
          rel="noreferrer"
          aria-label="GitHub"
          className="hidden size-9 shrink-0 items-center justify-center rounded-lg text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground sm:inline-flex"
        >
          <GitFork className="size-4" aria-hidden />
        </Link>

        <ThemeToggle />
        <AskAiTrigger />

        <span className="hidden h-9 shrink-0 items-center rounded-lg border border-fd-border px-2 font-mono text-xs font-medium text-fd-muted-foreground xl:inline-flex">
          v{version}
        </span>

        {/* Mobile / tablet site nav — with tools so brand stays clean on the left */}
        <MobileNavMenu pathname={pathname} version={version} />
      </div>
    </header>
  );
}
