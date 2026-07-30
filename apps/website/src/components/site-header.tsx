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
      className="inline-flex size-10 items-center justify-center rounded-md text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
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
        aria-label="Toggle site navigation"
        className="inline-flex min-h-10 items-center gap-1 rounded-md border border-fd-border bg-fd-card px-2.5 py-1 text-xs font-medium text-fd-foreground shadow-xs transition-colors hover:bg-fd-accent xl:hidden"
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
                  'flex min-h-10 items-center justify-between rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
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
        <div className="mt-2 flex items-center justify-between border-t border-fd-border px-2 pt-2 text-xs text-fd-muted-foreground">
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
    <header className="[grid-area:header] sticky top-0 z-40 flex h-[var(--fd-nav-height)] items-center gap-1.5 overflow-x-hidden border-b border-fd-border bg-fd-background/95 px-3 backdrop-blur-sm supports-backdrop-filter:bg-fd-background/60 sm:px-4">
      {isDocsRoute && (
        <SidebarTrigger
          className="-ms-1 me-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-md text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="size-5" aria-hidden />
        </SidebarTrigger>
      )}

      <Link href="/" aria-label="NextRush home" className="me-1 inline-flex size-10 shrink-0 items-center justify-center rounded-md text-fd-foreground transition-colors hover:bg-fd-accent">
        <Zap className="size-5 text-[#3b82f6]" aria-hidden />
        <span className="gradient-text ml-2 hidden sm:inline">NextRush</span>
      </Link>

      <MobileNavMenu pathname={pathname} version={version} />

      <nav aria-label="Site navigation" className="ms-2 hidden min-w-0 items-center gap-1 xl:flex">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive(pathname, link.href)
                ? 'text-fd-primary'
                : 'text-fd-muted-foreground hover:text-fd-foreground'
            )}
          >
            {link.text}
          </Link>
        ))}
      </nav>

      <div className="ms-auto flex min-w-0 shrink items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => setOpenSearch(true)}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-fd-border bg-fd-card px-3 text-sm text-fd-muted-foreground transition-colors hover:border-fd-foreground/30 hover:text-fd-foreground"
        >
          <Search className="size-4" aria-hidden />
          <span className="hidden sm:inline">Search docs</span>
        </button>
        <Link
          href="https://github.com/0xTanzim/nextrush"
          target="_blank"
          rel="noreferrer"
          aria-label="GitHub"
          className="hidden size-10 items-center justify-center rounded-md text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground sm:inline-flex"
        >
          <GitFork className="size-4" aria-hidden />
        </Link>
        <ThemeToggle />
        <AskAiTrigger />
        <span className="hidden min-h-10 items-center rounded-md border border-fd-border px-2 text-xs font-medium text-fd-muted-foreground sm:inline-flex">
          v{version}
        </span>
      </div>
    </header>
  );
}

