import { skillsSource } from '@/lib/source';
import { getMDXComponents } from '@/mdx-components';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export default async function SkillPage(props: PageProps<'/skills/[slug]'>) {
  const params = await props.params;
  const page = skillsSource.getPage([params.slug]);
  if (!page) notFound();

  const MDX = page.data.body;
  const difficulty = (page.data.difficulty as string) ?? 'intermediate';
  const pkg = page.data.package as string | undefined;
  const tags = (page.data.tags as string[]) ?? [];

  return (
    <main className="container max-w-3xl py-12 md:py-16">
      <div className="mb-8">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-fd-primary/10 px-3 py-1 text-xs font-medium text-fd-primary">
            Skill
          </span>
          <span className="rounded-full bg-fd-secondary px-3 py-1 text-xs font-medium text-fd-muted-foreground">
            {DIFFICULTY_LABELS[difficulty] ?? 'Intermediate'}
          </span>
          {pkg ? (
            <span className="rounded-full bg-fd-secondary px-3 py-1 text-xs font-medium text-fd-muted-foreground">
              @nextrush/{pkg}
            </span>
          ) : null}
        </div>
        <h1 className="mb-3 text-3xl font-bold">{page.data.title}</h1>
        <p className="text-lg text-fd-muted-foreground">{page.data.description}</p>
        {tags.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md border px-2 py-0.5 text-xs text-fd-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <hr className="mb-8" />

      <article className="prose dark:prose-invert max-w-none">
        <MDX components={getMDXComponents({})} />
      </article>

      <div className="mt-12 rounded-xl border bg-fd-card p-5">
        <h2 className="mb-2 text-base font-semibold">Use this skill with AI</h2>
        <p className="mb-3 text-sm text-fd-muted-foreground">
          This skill follows the{' '}
          <a
            href="https://agentskills.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-fd-primary underline underline-offset-4"
          >
            Agent Skills
          </a>{' '}
          open standard. Install it in your AI coding assistant:
        </p>
        <div className="inline-flex items-center gap-2 rounded-lg border bg-fd-background px-4 py-2 font-mono text-sm">
          <span className="text-fd-muted-foreground">$</span>
          <code>copilot skill install nextrush-{page.data.skillName as string}</code>
        </div>
      </div>
    </main>
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
