import { PackageCatalog } from '@/components/packages/package-catalog';
import { packageRegistry } from '@/lib/package-registry';
import { Package } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Packages',
  description: 'Browse all 35 NextRush packages by category, type, and status.',
};

/**
 * Real top-level Packages/Ecosystem directory (T13, Phase 2,
 * docs/documentation-rebuild/PLAN.md). Renders every entry in the
 * package registry (the same registry the Docs Hub's featured-packages
 * section reads from) so this catalog can never drift from the real 35
 * published packages.
 */
export default function PackagesPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-fd-border bg-fd-card/80 px-3 py-1 text-xs font-medium text-fd-muted-foreground">
        <Package className="size-3.5 text-[var(--rush-cyan)]" aria-hidden />
        {packageRegistry.length} packages
      </div>
      <h1 className="mb-4 text-3xl font-bold tracking-tight">Packages</h1>
      <p className="mb-10 max-w-2xl text-fd-muted-foreground">
        Every published NextRush package — core, class runtime, middleware, extensions,
        adapters, and tooling. Install only what you need.
      </p>

      <PackageCatalog packages={packageRegistry} />
    </main>
  );
}
