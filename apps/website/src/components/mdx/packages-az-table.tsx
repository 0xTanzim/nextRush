'use client';

import { getPackageLinks } from '@/lib/package-links';
import type { PackageCategory, PackageEntry, PackageStatus } from '@/lib/package-registry-types';
import { BookOpen, FileText, PackageSearch, Search } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

const CATEGORIES: readonly PackageCategory[] = [
  'Core',
  'Class Runtime',
  'Security',
  'Request Data',
  'Responses',
  'Observability',
  'Real-time & Events',
  'Adapters',
  'Tooling',
];

interface PackagesAZTableProps {
  readonly packages: readonly PackageEntry[];
}

/**
 * Filterable, category-grouped lookup for the Reference "All Packages"
 * index. Renders straight from `packageRegistry` — the same source
 * `/packages` and the sidebar clusters read from — so it can never drift
 * out of sync with the real package set the way the prior hand-authored
 * markdown table did.
 *
 * Grouped-by-category sections (rather than one flat 35-row table) give
 * the page scannable rhythm — a reader locates "Security" as a labeled
 * block instead of scanning every row's category cell (Hick's/Miller's
 * Law). Each row surfaces status, version, and both the guide + reference
 * links the registry already carries, which the prior table discarded.
 */
export function PackagesAZTable({ packages }: PackagesAZTableProps) {
  const [category, setCategory] = useState<PackageCategory | 'All'>('All');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return packages.filter((pkg) => {
      if (category !== 'All' && pkg.category !== category) return false;
      if (!normalizedQuery) return true;
      return (
        pkg.name.toLowerCase().includes(normalizedQuery) ||
        pkg.summary.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [packages, category, query]);

  const grouped = useMemo(() => {
    const byCategory = new Map<PackageCategory, PackageEntry[]>();
    for (const pkg of filtered) {
      const bucket = byCategory.get(pkg.category) ?? [];
      bucket.push(pkg);
      byCategory.set(pkg.category, bucket);
    }
    for (const bucket of byCategory.values()) {
      bucket.sort((a, b) => a.name.localeCompare(b.name));
    }
    return CATEGORIES.filter((c) => byCategory.has(c)).map((c) => ({
      category: c,
      entries: byCategory.get(c)!,
    }));
  }, [filtered]);

  return (
    <div className="not-prose my-6">
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-fd-border bg-fd-card px-3.5 py-2.5 shadow-sm transition-colors focus-within:border-fd-primary/50">
        <Search className="size-4 shrink-0 text-fd-muted-foreground" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search packages by name or summary…"
          aria-label="Search packages"
          className="w-full bg-transparent text-sm outline-none placeholder:text-fd-muted-foreground"
        />
      </div>

      <div className="mb-5 flex flex-wrap gap-1.5">
        <FilterPill label="All" count={packages.length} active={category === 'All'} onClick={() => setCategory('All')} />
        {CATEGORIES.map((c) => (
          <FilterPill
            key={c}
            label={c}
            count={packages.filter((p) => p.category === c).length}
            active={category === c}
            onClick={() => setCategory(c)}
          />
        ))}
      </div>

      <p className="mb-4 text-sm text-fd-muted-foreground">
        Showing <span className="font-medium text-fd-foreground">{filtered.length}</span> of{' '}
        {packages.length} packages
      </p>

      {grouped.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-fd-border bg-fd-card/50 px-6 py-16 text-center">
          <PackageSearch className="size-8 text-fd-muted-foreground/50" aria-hidden />
          <p className="text-fd-muted-foreground">No packages match &ldquo;{query}&rdquo;.</p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setCategory('All');
            }}
            className="text-sm font-medium text-fd-primary hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {grouped.map((group) => (
            <CategorySection key={group.category} category={group.category} entries={group.entries} />
          ))}
        </div>
      )}
    </div>
  );
}

function CategorySection({
  category,
  entries,
}: {
  readonly category: PackageCategory;
  readonly entries: readonly PackageEntry[];
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline gap-2">
        <h3 className="text-sm font-semibold tracking-wide text-fd-foreground">{category}</h3>
        <span className="text-xs text-fd-muted-foreground">
          {entries.length} package{entries.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="overflow-hidden rounded-xl border border-fd-border">
        {entries.map((pkg, i) => (
          <PackageRow key={pkg.name} pkg={pkg} isLast={i === entries.length - 1} />
        ))}
      </div>
    </section>
  );
}

function PackageRow({ pkg, isLast }: { readonly pkg: PackageEntry; readonly isLast: boolean }) {
  const links = getPackageLinks(pkg.name);
  return (
    <div
      className={`flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-fd-muted/40 sm:flex-row sm:items-center sm:gap-4 ${
        isLast ? '' : 'border-b border-fd-border'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <code className="text-sm font-medium text-fd-foreground">{pkg.name}</code>
          <StatusBadge status={pkg.status} />
          <span className="text-xs text-fd-muted-foreground">v{pkg.sinceVersion}</span>
        </div>
        <p className="mt-0.5 text-sm text-fd-muted-foreground">{pkg.summary}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3 sm:justify-end">
        {links.guide && (
          <Link
            href={links.guide}
            className="inline-flex items-center gap-1 text-sm font-medium text-fd-muted-foreground hover:text-fd-primary"
          >
            <BookOpen className="size-3.5" aria-hidden />
            Guide
          </Link>
        )}
        {links.reference ? (
          <Link
            href={links.reference}
            className="inline-flex items-center gap-1 text-sm font-medium text-fd-primary hover:underline"
          >
            <FileText className="size-3.5" aria-hidden />
            Reference
          </Link>
        ) : (
          <span className="text-sm text-fd-muted-foreground/60">No reference page</span>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { readonly status: PackageStatus }) {
  if (status === 'Stable') return null;
  const styles =
    status === 'New'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
      : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400';
  return (
    <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${styles}`}>
      {status}
    </span>
  );
}

function FilterPill({
  label,
  count,
  active,
  onClick,
}: {
  readonly label: string;
  readonly count: number;
  readonly active: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'border-fd-primary bg-fd-primary/10 text-fd-primary'
          : 'border-fd-border bg-fd-card text-fd-muted-foreground hover:text-fd-foreground'
      }`}
    >
      {label}
      <span className={`tabular-nums ${active ? 'text-fd-primary/70' : 'text-fd-muted-foreground/60'}`}>
        {count}
      </span>
    </button>
  );
}
