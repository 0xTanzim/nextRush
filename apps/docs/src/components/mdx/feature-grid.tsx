import type { ReactNode } from 'react';

interface FeatureProps {
  icon: ReactNode;
  title: string;
  description: string;
}

interface FeatureGridProps {
  children: ReactNode;
}

/**
 * Feature - A single feature card for the FeatureGrid
 *
 * @example
 * ```mdx
 * <Feature icon="⚡" title="High Performance" description="35,000+ RPS target" />
 * ```
 */
export function Feature({ icon, title, description }: FeatureProps) {
  return (
    <div className="p-6 rounded-xl border border-[var(--bg-border)] bg-[var(--bg-card)] hover:border-[var(--rush-blue)]/50 transition-colors">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="text-lg font-semibold mb-2 text-[var(--text-primary)]">{title}</h3>
      <p className="text-[var(--text-secondary)] text-sm">{description}</p>
    </div>
  );
}

/**
 * FeatureGrid - A responsive grid for Feature components
 *
 * @example
 * ```mdx
 * <FeatureGrid>
 *   <Feature icon="⚡" title="Fast" description="High performance" />
 *   <Feature icon="🎯" title="Type Safe" description="Full TypeScript" />
 *   <Feature icon="📦" title="Modular" description="Install what you need" />
 * </FeatureGrid>
 * ```
 */
export function FeatureGrid({ children }: FeatureGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 my-8">{children}</div>
  );
}
