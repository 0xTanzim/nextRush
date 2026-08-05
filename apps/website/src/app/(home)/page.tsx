import { Features } from '@/components/home/features';
import { Hero } from '@/components/home/hero';
import { HomeExplore } from '@/components/home/home-explore';
import { HomeFooter } from '@/components/home/home-footer';
import { Principles } from '@/components/home/principles';
import { ProofSection } from '@/components/home/proof-section';
import { QuickInstall } from '@/components/home/quick-install';

/**
 * Homepage spine (wireframe):
 *   Header → Hero (identity) → Proof (hero continuation) → Install (learn)
 *   → Principles → Architecture → Next steps → Packages → Footer
 *
 * Funnel widths: hero 760 → proof 920 → content ~1180
 */
export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-fd-background text-fd-foreground">
      {/* Layers 1–2: identity + immediate proof (one visual unit) */}
      <div className="relative">
        <Hero />
        <ProofSection />
      </div>

      {/* Layer 3: learn — install, principles, stack, explore */}
      <QuickInstall />
      <Principles />
      <Features />
      <HomeExplore />
      <HomeFooter />
    </div>
  );
}
