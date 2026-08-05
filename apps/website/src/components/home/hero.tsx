import { ArrowRight, GitFork } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { DOCS_GETTING_STARTED } from '@/lib/docs-links';

/**
 * Identity layer — badge, brand, value, CTA.
 * Ends at the CTA. Proof lives in ProofSection as the hero continuation.
 */
export function Hero() {
  return (
    <section aria-label="Why NextRush" className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/4 size-[600px] rounded-full bg-[var(--brand-link)]/15 blur-[120px] dark:bg-[var(--brand-link)]/20" />
        <div className="absolute right-1/3 top-0 size-[500px] rounded-full bg-[var(--learning-middleware)]/10 blur-[120px] dark:bg-[var(--learning-middleware)]/15" />
        <div className="absolute -bottom-20 left-1/2 size-[400px] rounded-full bg-[var(--learning-context)]/8 blur-[120px] dark:bg-[var(--learning-context)]/10" />
      </div>

      {/* Final weight pass: logo +8–12%, title +4%, CTA +4%; pb for proof breathing room */}
      <div className="container mx-auto px-4 pt-6 pb-7 md:pt-7 md:pb-8">
        <div className="mx-auto flex max-w-[720px] flex-col items-center text-center">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-fd-border bg-fd-card/50 px-4 py-1.5 backdrop-blur-md animate-fade-up">
            <span className="relative flex size-2" role="status" aria-label="Live">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--success)] opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-[var(--success)]" />
            </span>
            <span className="text-sm text-fd-muted-foreground">
              Node.js 22+ &middot; Bun &middot; Deno &middot; Edge
            </span>
          </div>

          <div className="relative mb-6 flex items-center gap-3.5 animate-fade-up animate-delay-100">
            <div
              aria-hidden
              className="absolute -inset-x-8 -inset-y-5 -z-10 rounded-full bg-[radial-gradient(ellipse_at_center,color-mix(in_srgb,var(--brand-500)_20%,transparent)_0%,transparent_68%)]"
            />
            {/* Logo ~+10% (36→40 / 56→60) */}
            <Logo className="size-10 md:size-[3.75rem]" aria-hidden="true" />
            {/* Wordmark ~+4% */}
            <h1 className="text-[3.15rem] font-bold leading-none text-[#F16913] md:text-[3.9rem]">NextRush</h1>
          </div>

          <p className="mb-5 text-[1.5rem] font-semibold tracking-tight text-fd-foreground md:text-[1.8rem] animate-fade-up animate-delay-200">
            TypeScript-first backend framework
          </p>

          <p className="mb-4 text-xl font-medium text-fd-foreground/75 animate-fade-up animate-delay-200">
            Explicit architecture. Zero hidden behavior.
          </p>

          <p className="mb-8 max-w-[40rem] text-base leading-[1.6] text-fd-muted-foreground md:text-lg animate-fade-up animate-delay-300">
            Build composable HTTP APIs with explicit routing and middleware.
            <br className="hidden sm:block" />
            Start with a small core and scale without hidden framework behavior.
          </p>

          {/* CTA ~+4% height (44→48) */}
          <div className="flex flex-col gap-3 sm:flex-row animate-fade-up animate-delay-400">
            <Link
              href={DOCS_GETTING_STARTED}
              className="btn-primary inline-flex min-h-12 items-center justify-center gap-2 px-7 text-lg transition-shadow hover:shadow-[0_0_24px_-4px_var(--brand-link)]"
            >
              Get started
              <ArrowRight className="size-5" aria-hidden="true" />
            </Link>
            <a
              href="https://github.com/0xTanzim/nextrush"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline inline-flex min-h-12 items-center justify-center gap-2 px-7 text-base"
            >
              <GitFork className="size-5" aria-hidden="true" />
              View on GitHub
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
