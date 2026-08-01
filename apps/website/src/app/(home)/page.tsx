import { Features } from '@/components/home/features';
import { Hero } from '@/components/home/hero';
import { HomeExplore } from '@/components/home/home-explore';
import { HomeFooter } from '@/components/home/home-footer';
import { QuickInstall } from '@/components/home/quick-install';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-fd-background text-fd-foreground">
      <Hero />
      <Features />
      <QuickInstall />
      <HomeExplore />
      <HomeFooter />
    </div>
  );
}
