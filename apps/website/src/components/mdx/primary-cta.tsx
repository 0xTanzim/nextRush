import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';

interface PrimaryCTAProps {
  /** Destination URL */
  href: string;
  /** CTA label, e.g. "Build your first API" */
  children: ReactNode;
  /** Optional one-line context shown above the button, e.g. "Recommended next" */
  label?: ReactNode;
  /** Optional hint shown below the button, e.g. "~40 min · beginner" */
  hint?: ReactNode;
  /** Open in a new tab (for external links) */
  external?: boolean;
}

/**
 * PrimaryCTA — the single most prominent action on an onboarding page.
 *
 * Onboarding pages should end with momentum, not fade into navigation (feedback
 * create-nextrush/doc2.md #3, #9: "success section is buried" / "missing finish
 * CTA"). This is one large, brand-accented button that says
 * "this is where I go next" — everything else (need-more accordions, warning,
 * secondary cards) sits below or around it, never competing with it.
 *
 * One primary CTA per page. If you need a second action, make it secondary
 * (a plain link or a `<Card>`), never a second `<PrimaryCTA>`.
 *
 * @example
 * ```mdx
 * <PrimaryCTA href="/docs/getting-started/quick-start" label="Recommended next">
 *   Build your first API
 * </PrimaryCTA>
 * ```
 */
export function PrimaryCTA({ href, children, label, hint, external }: PrimaryCTAProps) {
  return (
    <div className="primary-cta not-prose my-8 flex flex-col items-center gap-2 text-center">
      {label ? (
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--text-subtle)]">
          {label}
        </p>
      ) : null}
      <a
        href={href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className="primary-cta__button group inline-flex items-center gap-2 rounded-full bg-[var(--rush-blue)] px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-[color-mix(in_srgb,var(--rush-blue)_30%,transparent)] transition-all hover:bg-[color-mix(in_srgb,var(--rush-blue)_88%,black)] hover:shadow-xl hover:shadow-[color-mix(in_srgb,var(--rush-blue)_40%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rush-blue)]"
      >
        <span>{children}</span>
        <ArrowRight
          className="size-5 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </a>
      {hint ? (
        <p className="text-sm text-[var(--text-secondary)]">{hint}</p>
      ) : null}
    </div>
  );
}
