import { appConfig } from '@/config/appConfig';
import { skillsSource } from '@/lib/source';
import { BookOpen, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/25',
  intermediate:
    'bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/25',
  advanced: 'bg-red-500/15 text-red-600 dark:text-red-400 ring-1 ring-red-500/25',
};

export const metadata: Metadata = {
  title: 'Skills Directory',
  description:
    'Browse agent skills for NextRush. Each skill is a self-contained guide that AI agents can use to help you build with NextRush.',
};

export default function SkillsPage() {
  const pages = skillsSource.getPages();
  const count = pages.length;

  const gridClassName =
    count <= 1
      ? 'mx-auto grid w-full max-w-lg grid-cols-1 gap-5'
      : count === 2
        ? 'mx-auto grid w-full max-w-4xl grid-cols-1 gap-5 sm:grid-cols-2'
        : 'grid w-full grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3';

  return (
    <main className="min-h-[80vh] bg-fd-background">
      <div className="relative border-b border-fd-border/80 bg-[color-mix(in_srgb,var(--color-fd-muted)_35%,var(--color-fd-background))]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,color-mix(in_srgb,var(--rush-blue)_22%,transparent),transparent)]"
        />
        <div className="relative mx-auto w-full max-w-4xl px-4 py-14 text-center sm:px-6 md:py-20">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-fd-border bg-fd-card/80 px-3 py-1 text-xs font-medium text-fd-muted-foreground backdrop-blur-sm">
            <Sparkles className="size-3.5 text-[var(--rush-cyan)]" aria-hidden />
            Agent Skills
          </div>
          <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">Skills directory</h1>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-fd-muted-foreground">
            Self-contained guides compatible with the{' '}
            <a
              href="https://agentskills.io"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-fd-primary underline decoration-[color-mix(in_srgb,var(--color-fd-primary)_40%,transparent)] underline-offset-4 hover:text-fd-foreground"
            >
              Agent Skills
            </a>{' '}
            open standard — use them in Claude, GitHub Copilot, Cursor, and other tools.
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 md:py-16">
        {count === 0 ? (
          <div className="rounded-xl border border-dashed border-fd-border bg-fd-card/50 px-6 py-16 text-center">
            <BookOpen className="mx-auto mb-3 size-10 text-fd-muted-foreground opacity-80" />
            <p className="text-fd-muted-foreground">No skills are published yet. Check back soon.</p>
          </div>
        ) : (
          <div className={gridClassName}>
            {pages.map((page) => {
              const difficulty = (page.data.difficulty as string) ?? 'intermediate';
              const pkg = page.data.package as string | undefined;
              const tags = (page.data.tags as string[]) ?? [];

              return (
                <Link
                  key={page.url}
                  href={page.url}
                  className="group flex min-h-[180px] flex-col rounded-xl border border-fd-border bg-fd-card p-6 text-left shadow-sm transition-all hover:border-[color-mix(in_srgb,var(--rush-blue)_35%,var(--color-fd-border))] hover:shadow-[0_12px_40px_-16px_color-mix(in_srgb,var(--rush-blue)_18%,transparent)]"
                >
                  <h2 className="mb-2 text-lg font-semibold leading-snug text-fd-foreground group-hover:text-fd-primary">
                    {page.data.title}
                  </h2>
                  <p className="mb-4 flex-1 text-sm leading-relaxed text-fd-muted-foreground line-clamp-4">
                    {page.data.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${DIFFICULTY_COLORS[difficulty] ?? DIFFICULTY_COLORS.intermediate}`}
                    >
                      {difficulty}
                    </span>
                    {pkg ? (
                      <span className="rounded-full bg-fd-primary/12 px-2.5 py-0.5 text-xs font-medium text-fd-primary ring-1 ring-fd-primary/20">
                        @nextrush/{pkg}
                      </span>
                    ) : null}
                    {tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-fd-secondary px-2.5 py-0.5 text-xs text-fd-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <div className="mt-14 space-y-5">
          <div className="rounded-xl border border-fd-border bg-fd-card p-6 shadow-sm md:p-8">
            <h2 className="mb-2 text-lg font-semibold">Install in your assistant</h2>
            <p className="mx-auto mb-6 max-w-2xl text-center text-sm leading-relaxed text-fd-muted-foreground">
              Skills follow the{' '}
              <a
                href="https://agentskills.io/specification"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-fd-primary underline underline-offset-4"
              >
                Agent Skills
              </a>{' '}
              spec. Each tool installs files into a different folder — follow your client&apos;s docs for
              paths.
            </p>
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center sm:gap-4">
              <div className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-fd-border bg-[color-mix(in_srgb,var(--color-fd-muted)_40%,var(--color-fd-background))] px-4 py-2.5 font-mono text-sm sm:max-w-md">
                <span className="shrink-0 text-fd-muted-foreground">$</span>
                <code className="min-w-0 break-all text-left">npx skills add 0xTanzim/nextrush</code>
              </div>
              <span className="hidden text-fd-muted-foreground sm:grid sm:place-items-center">or</span>
              <div className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-fd-border bg-[color-mix(in_srgb,var(--color-fd-muted)_40%,var(--color-fd-background))] px-4 py-2.5 font-mono text-sm sm:max-w-md">
                <span className="shrink-0 text-fd-muted-foreground">$</span>
                <code className="min-w-0 break-all text-left">
                  copilot plugin marketplace add 0xTanzim/nextrush
                </code>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-fd-border bg-[color-mix(in_srgb,var(--color-fd-muted)_25%,var(--color-fd-card))] p-6 md:p-8">
            <h2 className="mb-2 text-lg font-semibold">Source and contributions</h2>
            <p className="text-sm leading-relaxed text-fd-muted-foreground">
              Skill sources live in the monorepo under{' '}
              <code className="rounded-md bg-fd-muted px-1.5 py-0.5 text-xs text-fd-foreground">
                skills/&lt;name&gt;/
              </code>{' '}
              (for example{' '}
              <a
                href={`${appConfig.skillsSourceRootUrl}/nextrush`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-fd-primary underline underline-offset-4"
              >
                skills/nextrush
              </a>
              ). Open a PR to propose changes. The catalog endpoint{' '}
              <Link href={appConfig.paths.skillsJson} className="font-medium text-fd-primary underline underline-offset-4">
                {appConfig.paths.skillsJson}
              </Link>{' '}
              lists the same skills as this page.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
