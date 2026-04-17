import { appConfig } from '@/config/appConfig';
import { skillsSource } from '@/lib/source';
import { getMDXComponents } from '@/mdx-components';
import { ChevronRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

const DIFFICULTY_STYLES: Record<string, string> = {
  beginner: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/25',
  intermediate: 'bg-amber-500/15 text-amber-800 dark:text-amber-400 ring-1 ring-amber-500/25',
  advanced: 'bg-red-500/15 text-red-700 dark:text-red-400 ring-1 ring-red-500/25',
};

export default async function SkillPage(props: PageProps<'/skills/[slug]'>) {
  const params = await props.params;
  const page = skillsSource.getPage([params.slug]);
  if (!page) notFound();

  const MDX = page.data.body;
  const difficulty = (page.data.difficulty as string) ?? 'intermediate';
  const pkg = page.data.package as string | undefined;
  const tags = (page.data.tags as string[]) ?? [];
  const skillName = page.data.skillName as string;

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col items-stretch bg-fd-background">
      <div className="border-b border-fd-border/80 bg-[color-mix(in_srgb,var(--color-fd-muted)_30%,var(--color-fd-background))]">
        <div className="mx-auto w-full max-w-4xl px-5 py-4 sm:px-8">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-fd-muted-foreground">
            <Link href="/" className="hover:text-fd-foreground">
              Home
            </Link>
            <ChevronRight className="size-4 shrink-0 opacity-60" aria-hidden />
            <Link href="/skills" className="hover:text-fd-foreground">
              Skills
            </Link>
            <ChevronRight className="size-4 shrink-0 opacity-60" aria-hidden />
            <span className="font-medium text-fd-foreground">{page.data.title}</span>
          </nav>
        </div>
      </div>

      <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 md:py-14">
        <header className="mb-10">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-fd-primary/12 px-3 py-1 text-xs font-semibold text-fd-primary ring-1 ring-fd-primary/25">
              Skill
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${DIFFICULTY_STYLES[difficulty] ?? DIFFICULTY_STYLES.intermediate}`}
            >
              {DIFFICULTY_LABELS[difficulty] ?? 'Intermediate'}
            </span>
            {pkg ? (
              <span className="rounded-full bg-fd-secondary px-3 py-1 text-xs font-medium text-fd-muted-foreground">
                @nextrush/{pkg}
              </span>
            ) : null}
          </div>
          <h1 className="mb-4 text-balance text-3xl font-bold tracking-tight text-fd-foreground md:text-4xl">
            {page.data.title}
          </h1>
          <p className="text-pretty text-lg leading-relaxed text-fd-muted-foreground">{page.data.description}</p>
          {tags.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-fd-border bg-fd-card px-2.5 py-1 text-xs text-fd-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </header>

        <article
          className="prose dark:prose-invert prose-lg max-w-none prose-headings:scroll-mt-24 prose-headings:font-semibold prose-p:leading-relaxed prose-a:text-fd-primary prose-code:rounded-md prose-code:bg-fd-muted/80 prose-code:px-1 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none prose-pre:bg-[var(--code-bg)] prose-pre:border prose-pre:border-[var(--code-border)]"
        >
          <MDX components={getMDXComponents({})} />
        </article>

        <aside className="mt-14 rounded-xl border border-fd-border bg-fd-card p-6 shadow-sm">
          <h2 className="mb-2 text-base font-semibold text-fd-foreground">Use with an AI assistant</h2>
          <p className="mb-4 text-sm leading-relaxed text-fd-muted-foreground">
            This page follows the{' '}
            <a
              href="https://agentskills.io/specification"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-fd-primary underline underline-offset-4"
            >
              Agent Skills
            </a>{' '}
            format. Install the repo skill, or open the catalog at{' '}
            <Link href={appConfig.paths.skillsJson} className="font-medium text-fd-primary underline underline-offset-4">
              {appConfig.paths.skillsJson}
            </Link>
            .
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <div className="inline-flex min-h-[44px] flex-1 items-center gap-2 rounded-lg border border-fd-border bg-[color-mix(in_srgb,var(--color-fd-muted)_35%,var(--color-fd-background))] px-3 py-2 font-mono text-xs sm:text-sm">
              <span className="text-fd-muted-foreground">$</span>
              <code className="min-w-0 flex-1 break-all">npx skills add 0xTanzim/nextrush</code>
            </div>
            <div className="inline-flex min-h-[44px] flex-1 items-center gap-2 rounded-lg border border-fd-border bg-[color-mix(in_srgb,var(--color-fd-muted)_35%,var(--color-fd-background))] px-3 py-2 font-mono text-xs sm:text-sm">
              <span className="text-fd-muted-foreground">$</span>
              <code className="min-w-0 flex-1 break-all">
                copilot plugin marketplace add 0xTanzim/nextrush
              </code>
            </div>
          </div>
          <p className="mt-4 text-xs text-fd-muted-foreground">
            Source:{' '}
            <a
              href={`${appConfig.repositoryUrl}/blob/main/skills/${skillName}/SKILL.md`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-fd-primary underline underline-offset-4"
            >
              skills/{skillName}/SKILL.md
            </a>
          </p>
        </aside>
      </main>
    </div>
  );
}

export function generateStaticParams() {
  return skillsSource.getPages().map((page) => ({
    slug: page.slugs[0],
  }));
}

export async function generateMetadata(props: PageProps<'/skills/[slug]'>): Promise<Metadata> {
  const params = await props.params;
  const page = skillsSource.getPage([params.slug]);
  if (!page) notFound();

  return {
    title: `${page.data.title} — NextRush Skill`,
    description: page.data.description,
  };
}
