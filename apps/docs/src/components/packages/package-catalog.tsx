'use client';

import { PackageCard } from '@/components/packages/package-card';
import { getPackageLinks } from '@/lib/package-links';
import type { PackageCategory, PackageEntry, PackageTypeBadge } from '@/lib/package-registry-types';
import { Search } from 'lucide-react';
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

const TYPES: readonly PackageTypeBadge[] = ['Core', 'Middleware', 'Extension', 'Adapter', 'Tool'];

interface PackageCatalogProps {
  readonly packages: readonly PackageEntry[];
}

/**
 * Client-side filterable/searchable grid over the full package registry.
 * All filtering happens in-memory against the 35-entry registry passed in
 * from the server component — no network round-trip needed at this scale.
 */
export function PackageCatalog({ packages }: PackageCatalogProps) {
  const [category, setCategory] = useState<PackageCategory | 'All'>('All');
  const [type, setType] = useState<PackageTypeBadge | 'All'>('All');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return packages.filter((pkg) => {
      if (category !== 'All' && pkg.category !== category) return false;
      if (type !== 'All' && pkg.type !== type) return false;
      if (!normalizedQuery) return true;
      return (
        pkg.name.toLowerCase().includes(normalizedQuery) ||
        pkg.summary.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [packages, category, type, query]);

  return (
    <div>
      <div className="mb-6 flex items-center gap-2 rounded-lg border border-fd-border bg-fd-card px-3 py-2">
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

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterPill label="All categories" active={category === 'All'} onClick={() => setCategory('All')} />
        {CATEGORIES.map((c) => (
          <FilterPill key={c} label={c} active={category === c} onClick={() => setCategory(c)} />
        ))}
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        <FilterPill label="All types" active={type === 'All'} onClick={() => setType('All')} />
        {TYPES.map((t) => (
          <FilterPill key={t} label={t} active={type === t} onClick={() => setType(t)} />
        ))}
      </div>

      <p className="mb-4 text-sm text-fd-muted-foreground">
        {filtered.length} of {packages.length} packages
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-fd-border bg-fd-card/50 px-6 py-16 text-center">
          <p className="text-fd-muted-foreground">No packages match these filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((pkg) => {
            const links = getPackageLinks(pkg.name);
            return (
              <PackageCard key={pkg.name} pkg={pkg} guideHref={links.guide} referenceHref={links.reference} />
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  readonly label: string;
  readonly active: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'border-fd-primary bg-fd-primary/10 text-fd-primary'
          : 'border-fd-border bg-fd-card text-fd-muted-foreground hover:text-fd-foreground'
      }`}
    >
      {label}
    </button>
  );
}
