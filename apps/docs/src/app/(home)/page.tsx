import { Features, Hero, QuickInstall } from '@/components/home';
import { ArrowRight, BookOpen, Code, Rocket } from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex flex-col min-h-screen bg-fd-background text-fd-foreground">
      <Hero />
      <Features />
      <QuickInstall />

      {/* Call to Action Section */}
      <section className="relative py-24">
        <hr className="section-divider absolute top-0 left-0 right-0" />
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to dive in?</h2>
            <p className="text-lg text-fd-muted-foreground max-w-2xl mx-auto">
              Start with the getting started guide, explore core concepts, or jump straight into
              examples.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Link
              href="/docs/getting-started"
              className="group p-6 rounded-xl card-glow card-gradient-border"
            >
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--rush-blue)]/10 border border-[var(--rush-blue)]/20 mb-4">
                <Rocket className="size-5 text-[var(--rush-blue)]" />
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-[var(--rush-blue)] transition-colors">
                Quick Start
              </h3>
              <p className="text-fd-muted-foreground mb-4">
                Build your first API in under 5 minutes.
              </p>
              <span className="inline-flex items-center gap-1 text-[var(--rush-blue)] font-medium">
                Get started{' '}
                <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>

            <Link href="/docs" className="group p-6 rounded-xl card-glow card-gradient-border">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--rush-purple)]/10 border border-[var(--rush-purple)]/20 mb-4">
                <BookOpen className="size-5 text-[var(--rush-purple)]" />
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-[var(--rush-purple)] transition-colors">
                Documentation
              </h3>
              <p className="text-fd-muted-foreground mb-4">Explore the complete API and guides.</p>
              <span className="inline-flex items-center gap-1 text-[var(--rush-purple)] font-medium">
                Read docs{' '}
                <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>

            <Link
              href="/docs/examples"
              className="group p-6 rounded-xl card-glow card-gradient-border"
            >
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--rush-cyan)]/10 border border-[var(--rush-cyan)]/20 mb-4">
                <Code className="size-5 text-[var(--rush-cyan)]" />
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-[var(--rush-cyan)] transition-colors">
                Examples
              </h3>
              <p className="text-fd-muted-foreground mb-4">Working examples for common patterns.</p>
              <span className="inline-flex items-center gap-1 text-[var(--rush-cyan)] font-medium">
                View examples{' '}
                <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-12">
        <hr className="section-divider absolute top-0 left-0 right-0" />
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-fd-muted-foreground text-sm">
              © {new Date().getFullYear()} NextRush. MIT License.
            </p>
            <div className="flex items-center gap-6">
              <a
                href="https://github.com/0xtanzim/nextrush"
                target="_blank"
                rel="noopener noreferrer"
                className="text-fd-muted-foreground hover:text-fd-foreground transition-colors text-sm"
              >
                GitHub
              </a>
              <a
                href="https://github.com/0xtanzim/nextrush/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="text-fd-muted-foreground hover:text-fd-foreground transition-colors text-sm"
              >
                Releases
              </a>
              <a
                href="https://github.com/0xtanzim/nextrush/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
                className="text-fd-muted-foreground hover:text-fd-foreground transition-colors text-sm"
              >
                License
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
