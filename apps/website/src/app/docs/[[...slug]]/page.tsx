import { AlertTriangle } from 'lucide-react';
import { FeedbackWidget } from '@/components/feedback-widget';
import { LLMCopyButton, ViewOptions } from '@/components/page-actions';
import { toAbsoluteUrl } from '@/config/appConfig';
import { getPageImage, source } from '@/lib/source';
import { getMDXComponents } from '@/mdx-components';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

const GITHUB_REPO_URL = 'https://github.com/0xTanzim/nextRush';
const GITHUB_BRANCH = process.env.NEXTRUSH_REPO_BRANCH ?? 'main';
const CONTENT_BASE = 'apps/website/content/docs';
const DOCS_BASE_PATH = (() => {
  const basePath = process.env.NEXTRUSH_DOCS_BASE_PATH ?? '';

  if (!basePath || basePath === '/') return '';

  return basePath.startsWith('/') ? basePath : `/${basePath}`;
})();

export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const slugPath = page.slugs.join('/');
  const markdownPath = slugPath.length > 0 ? slugPath : 'index';
  const markdownUrl = `${DOCS_BASE_PATH}/api/mdx/${markdownPath}.md`;
  const llmsUrl = `${DOCS_BASE_PATH}/llms.txt`;
  const githubUrl = `${GITHUB_REPO_URL}/blob/${GITHUB_BRANCH}/${CONTENT_BASE}/${page.path}`;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      {page.data.package ? (
        <code className="mb-1.5 inline-block w-fit rounded-md border border-[var(--color-fd-border)] bg-[var(--color-fd-muted)] px-2 py-0.5 font-mono text-xs text-[var(--color-fd-muted-foreground)]">
          {page.data.package}
        </code>
      ) : null}
      {/* Page actions live top-right beside the title — one toolbar, anchored to what
          it acts on (this page). A second copy at the page foot read as duplicated and
          left readers asking "what am I copying, and why twice?" (proximity + recognition). */}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <DocsTitle>{page.data.title}</DocsTitle>
        <div className="not-prose flex max-w-full flex-wrap items-center gap-1 rounded-lg border border-[var(--color-fd-border)] bg-[color-mix(in_srgb,var(--color-fd-muted)_45%,var(--color-fd-card))] p-0.5">
          <LLMCopyButton markdownUrl={markdownUrl} />
          <ViewOptions markdownUrl={markdownUrl} githubUrl={githubUrl} llmsUrl={llmsUrl} />
        </div>
      </div>
      {page.data.status === 'deprecated' ? (
        <div className="not-prose mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <div>
            <strong className="font-semibold">Deprecated</strong> — This page documents a deprecated feature. It may be removed in a future major version.
          </div>
        </div>
      ) : null}
      <DocsDescription className="mb-4 max-w-[70ch] text-base">{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            // this allows you to link to other pages with relative file paths
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
      <FeedbackWidget />
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: PageProps<'/docs/[[...slug]]'>): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const canonicalPath = `/docs/${page.slugs.join('/')}`.replace(/\/$/, '') || '/docs';

  return {
    title: page.data.title,
    description: page.data.description,
    alternates: {
      // English is the only shipped locale today (design.md D8 — i18n-ready, not
      // i18n-complete); `en` + `x-default` is the correct minimal hreflang baseline
      // for a single-locale site, and the shape a future locale extends rather than
      // introduces from scratch. hideLocale: 'default-locale' in lib/i18n.ts means
      // this canonical path never gains an /en prefix.
      canonical: toAbsoluteUrl(canonicalPath),
      languages: {
        en: toAbsoluteUrl(canonicalPath),
        'x-default': toAbsoluteUrl(canonicalPath),
      },
    },
    openGraph: {
      images: getPageImage(page).url,
    },
  };
}
