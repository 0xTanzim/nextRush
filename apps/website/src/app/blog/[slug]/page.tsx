import { blogSource } from '@/lib/source';
import { getMDXComponents } from '@/mdx-components';
import { ChevronRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default async function BlogPostPage(props: PageProps<'/blog/[slug]'>) {
  const params = await props.params;
  const page = blogSource.getPage([params.slug]);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col items-stretch bg-fd-background">
      <div className="border-b border-fd-border/80 bg-[color-mix(in_srgb,var(--color-fd-muted)_30%,var(--color-fd-background))]">
        <div className="mx-auto w-full max-w-3xl px-5 py-4 sm:px-8">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-fd-muted-foreground">
            <Link href="/" className="hover:text-fd-foreground">
              Home
            </Link>
            <ChevronRight className="size-4 shrink-0 opacity-60" aria-hidden />
            <Link href="/blog" className="hover:text-fd-foreground">
              Blog
            </Link>
            <ChevronRight className="size-4 shrink-0 opacity-60" aria-hidden />
            <span className="font-medium text-fd-foreground">{page.data.title}</span>
          </nav>
        </div>
      </div>

      <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 md:py-14">
        <header className="mb-10">
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-fd-muted-foreground">
            <time dateTime={page.data.date}>{formatDate(page.data.date)}</time>
            <span aria-hidden>·</span>
            <span>{page.data.author}</span>
          </div>
          <h1 className="mb-4 text-balance text-3xl font-bold tracking-tight text-fd-foreground md:text-4xl">
            {page.data.title}
          </h1>
          <p className="text-pretty text-lg leading-relaxed text-fd-muted-foreground">{page.data.description}</p>
          {page.data.tags.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {page.data.tags.map((tag) => (
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

        <div className="mt-14 border-t border-fd-border pt-8">
          <Link href="/blog" className="text-sm font-medium text-fd-primary underline underline-offset-4">
            ← Back to all posts
          </Link>
        </div>
      </main>
    </div>
  );
}

export function generateStaticParams() {
  return blogSource.getPages().map((page) => ({
    slug: page.slugs[0],
  }));
}

export async function generateMetadata(props: PageProps<'/blog/[slug]'>): Promise<Metadata> {
  const params = await props.params;
  const page = blogSource.getPage([params.slug]);
  if (!page) notFound();

  return {
    title: `${page.data.title} — NextRush Blog`,
    description: page.data.description,
  };
}
