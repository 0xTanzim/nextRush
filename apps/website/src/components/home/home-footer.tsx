import Image from 'next/image';
import Link from 'next/link';
import { Logo } from '@/components/logo';

const runtimeLinks = [
  { name: 'Node.js', icon: '/icons/nodejs.svg', href: '/docs/getting-started' },
  { name: 'Bun', icon: '/icons/bun.svg', href: '/docs/getting-started' },
  { name: 'Deno', icon: '/icons/deno-svgrepo-com.svg', href: '/docs/getting-started' },
  { name: 'Edge', icon: '/icons/azure-edge-management.svg', href: '/docs/getting-started' },
] as const;

const footerColumns = [
  {
    heading: 'Documentation',
    links: [
      ['Getting started', '/docs/getting-started'],
      ['Framework overview', '/docs/getting-started/overview'],
      ['Guides', '/docs/guides'],
      ['API reference', '/docs/reference'],
      ['Benchmarks', '/docs/performance'],
      ['Blog', '/blog'],
    ],
  },
  {
    heading: 'Packages',
    links: [
      ['All packages', '/packages'],
      ['nextrush', 'https://www.npmjs.com/package/nextrush'],
      ['@nextrush/class', 'https://www.npmjs.com/package/@nextrush/class'],
      ['create-nextrush', 'https://www.npmjs.com/package/create-nextrush'],
    ],
  },
  {
    heading: 'Community',
    links: [
      ['GitHub', 'https://github.com/0xTanzim/nextrush'],
      ['Wiki', 'https://github.com/0xTanzim/nextrush/wiki'],
      ['Issues', 'https://github.com/0xTanzim/nextrush/issues'],
      ['Contributing', 'https://github.com/0xTanzim/nextrush/blob/main/CONTRIBUTING.md'],
    ],
  },
] as const;

function isInternalLink(href: string): boolean {
  return href.startsWith('/');
}

export function HomeFooter() {
  return (
    <footer className="relative bg-fd-background py-14 md:py-16">
      <hr className="section-divider absolute inset-x-0 top-0" />
      <div className="container mx-auto px-4">
        <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <div className="mb-4 flex items-center gap-2.5">
              <Logo className="size-6 shrink-0" aria-hidden="true" />
              <span className="text-base font-bold">NextRush</span>
            </div>
            <p className="mb-4 max-w-xs text-sm text-fd-muted-foreground">
              Composable, TypeScript-first HTTP framework for Node.js, Bun, Deno, and Edge.
            </p>
            <div className="flex flex-wrap gap-2">
              {runtimeLinks.map((runtime) => (
                <Link
                  key={runtime.name}
                  href={runtime.href}
                  className="inline-flex items-center gap-1.5 rounded-full border border-fd-border px-2.5 py-1 text-xs text-fd-muted-foreground transition-colors hover:border-[var(--brand-link)]/40 hover:text-fd-foreground"
                >
                  <Image src={runtime.icon} alt="" width={14} height={14} className="size-3.5" aria-hidden="true" />
                  {runtime.name}
                </Link>
              ))}
            </div>
          </div>

          {footerColumns.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h3 className="mb-3 text-sm font-semibold text-fd-foreground">{column.heading}</h3>
              <ul className="space-y-2">
                {column.links.map(([label, href]) => (
                  <li key={label}>
                    {isInternalLink(href) ? (
                      <Link href={href} className="text-sm text-fd-muted-foreground transition-colors hover:text-fd-foreground">
                        {label}
                      </Link>
                    ) : (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-fd-muted-foreground transition-colors hover:text-fd-foreground"
                      >
                        {label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mx-auto mt-14 flex max-w-6xl flex-col items-center justify-between gap-4 border-t border-fd-border pt-6 sm:flex-row">
          <p className="text-sm text-fd-muted-foreground">© {new Date().getFullYear()} NextRush. MIT License.</p>
          <div className="flex items-center gap-5">
            <a
              href="https://github.com/0xTanzim/nextrush/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-fd-muted-foreground transition-colors hover:text-fd-foreground"
            >
              Releases
            </a>
            <a
              href="https://github.com/0xTanzim/nextrush/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-fd-muted-foreground transition-colors hover:text-fd-foreground"
            >
              License
            </a>
            <p className="text-sm text-fd-muted-foreground">Built by Tanzim Hossain</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
