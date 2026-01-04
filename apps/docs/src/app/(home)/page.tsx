import { Features, Hero, QuickInstall } from '@/components/home';
import { ArrowRight, BookOpen, Code, Rocket } from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex flex-col min-h-screen bg-[#09090b]">
      <Hero />
      <Features />
      <QuickInstall />

      {/* Call to Action Section */}
      <section className="py-24 border-t border-[#27272a]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to dive in?</h2>
            <p className="text-lg text-[#a1a1aa] max-w-2xl mx-auto">
              Start with the getting started guide, explore core concepts, or jump straight into
              examples.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Link
              href="/docs/getting-started"
              className="group p-6 rounded-xl border border-[#27272a] bg-[#18181b]/50 hover:border-[#3b82f6] transition-all duration-200 card-hover"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-[#3b82f6]/20 mb-4">
                <Rocket className="size-6 text-[#3b82f6]" />
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-[#3b82f6] transition-colors">
                Quick Start
              </h3>
              <p className="text-[#a1a1aa] mb-4">
                Build your first API in under 5 minutes.
              </p>
              <span className="inline-flex items-center gap-1 text-[#3b82f6] font-medium">
                Get started <ArrowRight className="size-4" />
              </span>
            </Link>

            <Link
              href="/docs"
              className="group p-6 rounded-xl border border-[#27272a] bg-[#18181b]/50 hover:border-[#8b5cf6] transition-all duration-200 card-hover"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-[#8b5cf6]/20 mb-4">
                <BookOpen className="size-6 text-[#8b5cf6]" />
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-[#8b5cf6] transition-colors">
                Documentation
              </h3>
              <p className="text-[#a1a1aa] mb-4">
                Explore the complete API and guides.
              </p>
              <span className="inline-flex items-center gap-1 text-[#8b5cf6] font-medium">
                Read docs <ArrowRight className="size-4" />
              </span>
            </Link>

            <a
              href="https://github.com/0xtanzim/nextrush/tree/main/apps/playground"
              target="_blank"
              rel="noopener noreferrer"
              className="group p-6 rounded-xl border border-[#27272a] bg-[#18181b]/50 hover:border-[#22d3ee] transition-all duration-200 card-hover"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-[#22d3ee]/20 mb-4">
                <Code className="size-6 text-[#22d3ee]" />
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-[#22d3ee] transition-colors">
                Examples
              </h3>
              <p className="text-[#a1a1aa] mb-4">
                Working examples for common patterns.
              </p>
              <span className="inline-flex items-center gap-1 text-[#22d3ee] font-medium">
                View examples <ArrowRight className="size-4" />
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-[#27272a]">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-[#71717a] text-sm">
              © {new Date().getFullYear()} NextRush. MIT License.
            </p>
            <div className="flex items-center gap-6">
              <a
                href="https://github.com/0xtanzim/nextrush"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#71717a] hover:text-[#fafafa] transition-colors text-sm"
              >
                GitHub
              </a>
              <a
                href="https://github.com/0xtanzim/nextrush/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#71717a] hover:text-[#fafafa] transition-colors text-sm"
              >
                Releases
              </a>
              <a
                href="https://github.com/0xtanzim/nextrush/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#71717a] hover:text-[#fafafa] transition-colors text-sm"
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
