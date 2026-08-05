import { Rocket } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Showcase',
  description: 'Real projects built with NextRush.',
};

/**
 * Showcase directory (T20, Phase 4, docs/documentation-rebuild/PLAN.md — optional,
 * lower priority than the blog). NextRush is a genuinely new framework with no public
 * production users to list yet, so this page states that honestly instead of inventing
 * company names or testimonials to fill the grid. When a real project wants to be
 * listed, add an entry to `entries` below with a name, URL, and one-sentence
 * description that can be verified (e.g. a public repo using `nextrush` as a
 * dependency) — never a name that can't be checked against a real source.
 */
type ShowcaseEntry = {
  readonly name: string;
  readonly url: string;
  readonly description: string;
};

// Intentionally empty: no fabricated projects. Populate only with verifiable public
// projects (real repo/site, real name) as they appear.
const entries: readonly ShowcaseEntry[] = [];

export default function ShowcasePage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6">
      <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-fd-border bg-fd-card/80 px-3 py-1 text-xs font-medium text-fd-muted-foreground">
        <Rocket className="size-3.5 text-[var(--learning-context)]" aria-hidden />
        Showcase
      </div>
      <h1 className="mb-4 text-3xl font-bold tracking-tight">Built with NextRush</h1>
      <p className="mb-10 max-w-2xl text-fd-muted-foreground">
        NextRush is a new framework. There are no public projects listed here yet — this
        page will grow as real, verifiable projects adopt it. We won&apos;t fabricate
        entries to fill this space.
      </p>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-fd-border bg-fd-card/50 px-6 py-16 text-center">
          <Rocket className="mx-auto mb-3 size-10 text-fd-muted-foreground opacity-80" />
          <p className="mb-2 text-fd-muted-foreground">No showcase entries yet.</p>
          <p className="text-sm text-fd-muted-foreground">
            Shipping something with NextRush?{' '}
            <a
              href="https://github.com/0xTanzim/nextRush/discussions"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-fd-primary underline underline-offset-4"
            >
              Tell us on GitHub Discussions
            </a>
            {' '}and we&apos;ll add it here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {entries.map((entry) => (
            <a
              key={entry.url}
              href={entry.url}
              target="_blank"
              rel="noreferrer"
              className="group flex flex-col rounded-xl border border-fd-border bg-fd-card p-6 shadow-sm transition-all hover:border-[color-mix(in_srgb,var(--brand-link)_35%,var(--color-fd-border))]"
            >
              <h2 className="mb-2 text-lg font-semibold text-fd-foreground group-hover:text-fd-primary">
                {entry.name}
              </h2>
              <p className="text-sm leading-relaxed text-fd-muted-foreground">{entry.description}</p>
            </a>
          ))}
        </div>
      )}

      <p className="mt-10 text-sm text-fd-muted-foreground">
        Looking for the release notes instead? See the{' '}
        <Link href="/blog" className="font-medium text-fd-primary underline underline-offset-4">
          blog
        </Link>
        .
      </p>
    </main>
  );
}
