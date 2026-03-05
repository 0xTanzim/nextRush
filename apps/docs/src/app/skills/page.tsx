import { skillsSource } from '@/lib/source';
import type { Metadata } from 'next';
import Link from 'next/link';

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'bg-green-500/10 text-green-600 dark:text-green-400',
  intermediate: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  advanced: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

export const metadata: Metadata = {
  title: 'Skills Directory',
  description:
    'Browse agent skills for NextRush. Each skill is a self-contained guide that AI agents can use to help you build with NextRush.',
};

export default function SkillsPage() {
  const pages = skillsSource.getPages();

  return (
    <main className="container max-w-6xl py-12 md:py-16">
      <div className="mb-12 text-center">
        <h1 className="mb-4 text-4xl font-bold">Skills Directory</h1>
        <p className="mx-auto max-w-2xl text-lg text-fd-muted-foreground">
          Agent skills for NextRush. Each skill is a self-contained guide compatible with the{' '}
          <a
            href="https://agentskills.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-fd-primary underline underline-offset-4"
          >
            Agent Skills
          </a>{' '}
          open standard — usable by Claude, GitHub Copilot, Cursor, and more.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pages.map((page) => {
          const difficulty = (page.data.difficulty as string) ?? 'intermediate';
          const pkg = page.data.package as string | undefined;
          const tags = (page.data.tags as string[]) ?? [];

          return (
            <Link
              key={page.url}
              href={page.url}
              className="group flex flex-col rounded-xl border bg-fd-card p-5 transition-colors hover:bg-fd-accent hover:border-fd-primary/40"
            >
              <h2 className="mb-2 text-lg font-semibold group-hover:text-fd-primary">
                {page.data.title}
              </h2>
              <p className="mb-4 flex-1 text-sm text-fd-muted-foreground line-clamp-2">
                {page.data.description}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${DIFFICULTY_COLORS[difficulty] ?? DIFFICULTY_COLORS.intermediate}`}
                >
                  {difficulty}
                </span>
                {pkg ? (
                  <span className="rounded-full bg-fd-primary/10 px-2.5 py-0.5 text-xs font-medium text-fd-primary">
                    @nextrush/{pkg}
                  </span>
                ) : null}
                {tags.slice(0, 2).map((tag) => (
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

      <div className="mt-12 rounded-xl border bg-fd-card p-6 text-center">
        <h2 className="mb-2 text-lg font-semibold">Use with AI Agents</h2>
        <p className="mx-auto mb-4 max-w-xl text-sm text-fd-muted-foreground">
          Install NextRush skills in your AI coding assistant. Skills follow the{' '}
          <a
            href="https://agentskills.io/specification"
            target="_blank"
            rel="noopener noreferrer"
            className="text-fd-primary underline underline-offset-4"
          >
            agentskills.io
          </a>{' '}
          standard and are compatible with Claude, GitHub Copilot, Cursor, and other tools.
        </p>
        <div className="inline-flex items-center gap-2 rounded-lg border bg-fd-background px-4 py-2 font-mono text-sm">
          <span className="text-fd-muted-foreground">$</span>
          <code>copilot plugin marketplace add 0xTanzim/nextrush</code>
        </div>
      </div>
    </main>
  );
}
