import { StatusBadge, TypeBadge } from '@/components/packages/badges';
import type { PackageEntry } from '@/lib/package-registry-types';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface PackageCardProps {
  readonly pkg: PackageEntry;
  readonly guideHref?: string;
  readonly referenceHref?: string;
}

/**
 * A single package's card in the /packages catalog grid. Renders "Guide"
 * and "Reference" links only when a real destination was supplied —
 * omitting a link is preferred over pointing it at a page that doesn't
 * exist yet.
 */
export function PackageCard({ pkg, guideHref, referenceHref }: PackageCardProps) {
  const isDeprecated = pkg.status === 'Deprecated';

  return (
    <div
      className={`flex flex-col rounded-xl border bg-fd-card p-5 shadow-sm transition-shadow hover:shadow-md ${
        isDeprecated ? 'border-red-500/30' : 'border-fd-border'
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <TypeBadge type={pkg.type} />
        <StatusBadge status={pkg.status} />
      </div>

      <h2 className="mb-1 break-all font-mono text-sm font-semibold text-fd-foreground">{pkg.name}</h2>
      <p className="mb-3 text-xs text-fd-muted-foreground">{pkg.category}</p>

      <p className="mb-4 flex-1 text-sm leading-relaxed text-fd-muted-foreground">{pkg.summary}</p>

      <div className="mb-4 flex items-center gap-2 rounded-lg border border-fd-border bg-fd-muted/40 px-3 py-2 font-mono text-xs">
        <span className="shrink-0 text-fd-muted-foreground">$</span>
        <code className="min-w-0 flex-1 break-all">pnpm add {pkg.name}</code>
      </div>

      {guideHref || referenceHref ? (
        <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
          {guideHref ? (
            <Link
              href={guideHref}
              className="inline-flex items-center gap-1 text-fd-primary hover:underline"
            >
              Guide <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          ) : null}
          {referenceHref ? (
            <Link
              href={referenceHref}
              className="inline-flex items-center gap-1 text-fd-primary hover:underline"
            >
              Reference <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
