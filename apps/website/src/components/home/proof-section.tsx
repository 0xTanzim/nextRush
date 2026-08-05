/**
 * Proof layer — seamless hero continuation.
 * Quiet eyebrow → title on the code → balanced trust evidence (no runtime pill wall).
 */

import { HeroCodeExample } from '@/components/home/hero-code-example';

/** Equal visual weight; no long fourth line; no hero-badge duplication. */
const trustItems = [
  { label: 'Zero runtime dependencies' },
  { label: 'Web-standard APIs' },
  { label: 'Multi-runtime ready' },
  { label: 'MIT Licensed' },
] as const;

export function ProofSection() {
  return (
    <section aria-labelledby="hello-nextrush-heading" className="relative">
      {/* Tighter bottom so Install follows without a huge gap */}
      <div className="container mx-auto px-4 pb-8 md:pb-10">
        <div className="mx-auto flex w-full max-w-[800px] flex-col items-center text-center">
          {/* Quiet entry — slightly more air so code feels introduced, not abrupt */}
          <div className="mb-4 flex w-full max-w-[14rem] items-center" aria-hidden="true">
            <span className="h-px w-full bg-gradient-to-r from-transparent via-fd-border to-transparent" />
          </div>

          <p className="mb-2 text-[12px] font-medium text-fd-muted-foreground/55 animate-fade-up">
            Quick example
          </p>

          <h2
            id="hello-nextrush-heading"
            className="mb-4 flex items-center gap-2 text-[1.25rem] font-semibold tracking-tight text-fd-foreground animate-fade-up sm:text-[1.375rem]"
          >
            <span className="font-mono text-sm font-medium text-[var(--code-punctuation)]" aria-hidden="true">
              &lt;/&gt;
            </span>
            Hello, NextRush
          </h2>

          <HeroCodeExample />

          {/* Trust tight under code — single row on desktop */}
          <ul
            aria-label="Framework guarantees"
            className="mt-4 flex w-full max-w-[800px] flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-fd-muted-foreground animate-fade-up sm:gap-x-6 md:flex-nowrap"
          >
            {trustItems.map((item) => (
              <li key={item.label} className="inline-flex shrink-0 items-center gap-1.5">
                <span className="text-[var(--success)]" aria-hidden="true">
                  ✓
                </span>
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
