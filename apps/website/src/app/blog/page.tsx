import { blogSource } from '@/lib/source';
import { toAbsoluteUrl } from '@/config/appConfig';
import { BookOpen, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Release notes and design-decision deep dives for NextRush.',
  alternates: {
    canonical: toAbsoluteUrl('/blog'),
  },
};

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Real Fumadocs blog listing (T20, Phase 4, docs/documentation-rebuild/PLAN.md) — reads
 * every post from the `blog` collection (see source.config.ts / lib/source.ts), so this
 * page can never drift from what's actually published under content/blog/. Replaces the
 * Phase 1 nav-shell placeholder that lived at this same route.
 */
export default function BlogPage() {
  const pages = blogSource
    .getPages()
    .slice()
    .sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime());
  const count = pages.length;

  return (
    <main className="min-h-[80vh] bg-fd-background">
      <div className="relative border-b border-fd-border/80 bg-[color-mix(in_srgb,var(--color-fd-muted)_35%,var(--color-fd-background))]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,color-mix(in_srgb,var(--brand-link)_22%,transparent),transparent)]"
        />
        <div className="relative mx-auto w-full max-w-4xl px-4 py-14 text-center sm:px-6 md:py-20">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-fd-border bg-fd-card/80 px-3 py-1 text-xs font-medium text-fd-muted-foreground backdrop-blur-sm">
            <Sparkles className="size-3.5 text-[var(--learning-context)]" aria-hidden />
            Blog
          </div>
          <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
            Release notes &amp; design decisions
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-fd-muted-foreground">
            What changed, why it changed, and how it maps to the code in this repository.
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 md:py-16">
        {count === 0 ? (
          <div className="rounded-xl border border-dashed border-fd-border bg-fd-card/50 px-6 py-16 text-center">
            <BookOpen className="mx-auto mb-3 size-10 text-fd-muted-foreground opacity-80" />
            <p className="text-fd-muted-foreground">No posts published yet. Check back soon.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {pages.map((page) => (
              <Link
                key={page.url}
                href={page.url}
                className="group flex flex-col rounded-xl border border-fd-border bg-fd-card p-6 text-left shadow-sm transition-all hover:border-[color-mix(in_srgb,var(--brand-link)_35%,var(--color-fd-border))] hover:shadow-[0_12px_40px_-16px_color-mix(in_srgb,var(--brand-link)_18%,transparent)]"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-fd-muted-foreground">
                  <time dateTime={page.data.date}>{formatDate(page.data.date)}</time>
                  <span aria-hidden>·</span>
                  <span>{page.data.author}</span>
                </div>
                <h2 className="mb-2 text-xl font-semibold leading-snug text-fd-foreground group-hover:text-fd-primary">
                  {page.data.title}
                </h2>
                <p className="mb-3 text-sm leading-relaxed text-fd-muted-foreground">
                  {page.data.description}
                </p>
                {page.data.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {page.data.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-fd-secondary px-2.5 py-0.5 text-xs text-fd-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
